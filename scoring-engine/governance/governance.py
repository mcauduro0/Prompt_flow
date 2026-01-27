"""
ARC Scoring Engine - Governance Layer
Versioning, logging, audit trails, and validation.
"""

import pandas as pd
import numpy as np
import json
import hashlib
import logging
from datetime import datetime
from typing import Dict, Optional, List, Any
from pathlib import Path
import yaml


# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================

def setup_logging(log_dir: str = '/home/ubuntu/arc-scoring-engine/logs') -> logging.Logger:
    """
    Setup logging for the scoring engine.
    
    Args:
        log_dir: Directory for log files
        
    Returns:
        Configured logger
    """
    Path(log_dir).mkdir(parents=True, exist_ok=True)
    
    log_file = Path(log_dir) / f"scoring_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s | %(levelname)s | %(module)s | %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler()
        ]
    )
    
    return logging.getLogger('arc_scoring')


# =============================================================================
# VERSION CONTROL
# =============================================================================

class VersionManager:
    """Manages versioning of scoring configurations and runs."""
    
    def __init__(self, version_dir: str = '/home/ubuntu/arc-scoring-engine/versions'):
        self.version_dir = Path(version_dir)
        self.version_dir.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger('arc_scoring.version')
    
    def compute_config_hash(self, config: Dict) -> str:
        """
        Compute hash of configuration for versioning.
        
        Args:
            config: Configuration dictionary
            
        Returns:
            SHA256 hash string
        """
        config_str = json.dumps(config, sort_keys=True)
        return hashlib.sha256(config_str.encode()).hexdigest()[:12]
    
    def save_version(
        self,
        config: Dict,
        version_name: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        Save a configuration version.
        
        Args:
            config: Configuration dictionary
            version_name: Optional human-readable name
            metadata: Optional metadata
            
        Returns:
            Version ID
        """
        config_hash = self.compute_config_hash(config)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        version_id = f"{timestamp}_{config_hash}"
        
        if version_name:
            version_id = f"{version_name}_{version_id}"
        
        version_data = {
            'version_id': version_id,
            'config_hash': config_hash,
            'timestamp': timestamp,
            'config': config,
            'metadata': metadata or {}
        }
        
        version_file = self.version_dir / f"{version_id}.json"
        with open(version_file, 'w') as f:
            json.dump(version_data, f, indent=2, default=str)
        
        self.logger.info(f"Saved version: {version_id}")
        
        return version_id
    
    def load_version(self, version_id: str) -> Dict:
        """
        Load a configuration version.
        
        Args:
            version_id: Version ID to load
            
        Returns:
            Version data including config
        """
        version_file = self.version_dir / f"{version_id}.json"
        
        if not version_file.exists():
            raise FileNotFoundError(f"Version not found: {version_id}")
        
        with open(version_file, 'r') as f:
            return json.load(f)
    
    def list_versions(self) -> List[Dict]:
        """
        List all available versions.
        
        Returns:
            List of version summaries
        """
        versions = []
        
        for version_file in sorted(self.version_dir.glob('*.json'), reverse=True):
            with open(version_file, 'r') as f:
                data = json.load(f)
                versions.append({
                    'version_id': data['version_id'],
                    'timestamp': data['timestamp'],
                    'config_hash': data['config_hash'],
                    'metadata': data.get('metadata', {})
                })
        
        return versions


# =============================================================================
# AUDIT TRAIL
# =============================================================================

class AuditLogger:
    """Logs all scoring operations for audit purposes."""
    
    def __init__(self, audit_dir: str = '/home/ubuntu/arc-scoring-engine/audit'):
        self.audit_dir = Path(audit_dir)
        self.audit_dir.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger('arc_scoring.audit')
    
    def log_run(
        self,
        run_id: str,
        version_id: str,
        tickers: List[str],
        date_range: tuple,
        status: str,
        metrics: Optional[Dict] = None
    ):
        """
        Log a scoring run.
        
        Args:
            run_id: Unique run identifier
            version_id: Configuration version used
            tickers: List of tickers processed
            date_range: Tuple of (start_date, end_date)
            status: Run status (success/failed/partial)
            metrics: Optional run metrics
        """
        audit_entry = {
            'run_id': run_id,
            'version_id': version_id,
            'timestamp': datetime.now().isoformat(),
            'tickers_count': len(tickers),
            'tickers': tickers[:10],  # First 10 for brevity
            'date_range': {
                'start': str(date_range[0]),
                'end': str(date_range[1])
            },
            'status': status,
            'metrics': metrics or {}
        }
        
        audit_file = self.audit_dir / f"run_{run_id}.json"
        with open(audit_file, 'w') as f:
            json.dump(audit_entry, f, indent=2)
        
        self.logger.info(f"Audit logged: run={run_id}, status={status}")
    
    def log_score_change(
        self,
        ticker: str,
        date: str,
        block: str,
        old_score: float,
        new_score: float,
        reason: str
    ):
        """
        Log a score change for audit.
        
        Args:
            ticker: Ticker symbol
            date: Date of score
            block: Score block
            old_score: Previous score
            new_score: New score
            reason: Reason for change
        """
        change_entry = {
            'timestamp': datetime.now().isoformat(),
            'ticker': ticker,
            'date': date,
            'block': block,
            'old_score': old_score,
            'new_score': new_score,
            'change': new_score - old_score if pd.notna(old_score) and pd.notna(new_score) else None,
            'reason': reason
        }
        
        changes_file = self.audit_dir / 'score_changes.jsonl'
        with open(changes_file, 'a') as f:
            f.write(json.dumps(change_entry) + '\n')


# =============================================================================
# VALIDATION
# =============================================================================

class ScoreValidator:
    """Validates scores and signals for quality assurance."""
    
    def __init__(self):
        self.logger = logging.getLogger('arc_scoring.validator')
    
    def validate_signals(
        self,
        df_signals: pd.DataFrame,
        required_signals: List[str],
        min_coverage: float = 0.7
    ) -> Dict:
        """
        Validate signal coverage.
        
        Args:
            df_signals: DataFrame with signals
            required_signals: List of required signal names
            min_coverage: Minimum coverage ratio
            
        Returns:
            Validation report
        """
        report = {
            'valid': True,
            'coverage': {},
            'missing_signals': [],
            'warnings': []
        }
        
        available_signals = set(df_signals['signal_name'].unique())
        required_set = set(required_signals)
        
        missing = required_set - available_signals
        if missing:
            report['missing_signals'] = list(missing)
            report['warnings'].append(f"Missing signals: {missing}")
        
        # Check coverage per ticker
        for ticker in df_signals['ticker'].unique():
            ticker_signals = df_signals[df_signals['ticker'] == ticker]
            ticker_available = set(ticker_signals['signal_name'].unique())
            coverage = len(ticker_available & required_set) / len(required_set) if required_set else 0
            report['coverage'][ticker] = coverage
            
            if coverage < min_coverage:
                report['warnings'].append(f"Low coverage for {ticker}: {coverage:.1%}")
        
        if report['missing_signals'] or any(c < min_coverage for c in report['coverage'].values()):
            report['valid'] = False
        
        return report
    
    def validate_scores(
        self,
        df_scores: pd.DataFrame,
        expected_range: tuple = (0, 100)
    ) -> Dict:
        """
        Validate score values.
        
        Args:
            df_scores: DataFrame with scores
            expected_range: Expected (min, max) range
            
        Returns:
            Validation report
        """
        report = {
            'valid': True,
            'out_of_range': [],
            'null_scores': [],
            'statistics': {}
        }
        
        for block in df_scores['block'].unique():
            block_scores = df_scores[df_scores['block'] == block]['score_adjusted']
            
            # Check for nulls
            null_count = block_scores.isna().sum()
            if null_count > 0:
                report['null_scores'].append({
                    'block': block,
                    'count': int(null_count)
                })
            
            # Check range
            valid_scores = block_scores.dropna()
            out_of_range = valid_scores[
                (valid_scores < expected_range[0]) | 
                (valid_scores > expected_range[1])
            ]
            
            if len(out_of_range) > 0:
                report['out_of_range'].append({
                    'block': block,
                    'count': len(out_of_range),
                    'min': float(out_of_range.min()),
                    'max': float(out_of_range.max())
                })
                report['valid'] = False
            
            # Statistics
            report['statistics'][block] = {
                'mean': float(valid_scores.mean()) if len(valid_scores) > 0 else None,
                'std': float(valid_scores.std()) if len(valid_scores) > 0 else None,
                'min': float(valid_scores.min()) if len(valid_scores) > 0 else None,
                'max': float(valid_scores.max()) if len(valid_scores) > 0 else None,
                'count': len(valid_scores)
            }
        
        return report
    
    def validate_quintile_distribution(
        self,
        df_scores: pd.DataFrame,
        expected_pct: float = 0.20,
        tolerance: float = 0.10
    ) -> Dict:
        """
        Validate quintile distribution.
        
        Args:
            df_scores: DataFrame with scores and quintiles
            expected_pct: Expected percentage per quintile
            tolerance: Tolerance for deviation
            
        Returns:
            Validation report
        """
        report = {
            'valid': True,
            'distribution': {},
            'warnings': []
        }
        
        if 'quintile' not in df_scores.columns:
            report['valid'] = False
            report['warnings'].append("No quintile column found")
            return report
        
        quintile_counts = df_scores['quintile'].value_counts(normalize=True)
        
        for q in range(1, 6):
            pct = quintile_counts.get(q, 0)
            report['distribution'][f'Q{q}'] = float(pct)
            
            if abs(pct - expected_pct) > tolerance:
                report['warnings'].append(
                    f"Q{q} has {pct:.1%} (expected ~{expected_pct:.1%})"
                )
        
        return report


# =============================================================================
# REGRESSION TESTING
# =============================================================================

class RegressionTester:
    """Tests for score regressions between versions."""
    
    def __init__(self, baseline_dir: str = '/home/ubuntu/arc-scoring-engine/baselines'):
        self.baseline_dir = Path(baseline_dir)
        self.baseline_dir.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger('arc_scoring.regression')
    
    def save_baseline(
        self,
        df_scores: pd.DataFrame,
        version_id: str
    ):
        """
        Save scores as baseline for future comparison.
        
        Args:
            df_scores: DataFrame with scores
            version_id: Version identifier
        """
        baseline_file = self.baseline_dir / f"baseline_{version_id}.parquet"
        df_scores.to_parquet(baseline_file)
        self.logger.info(f"Saved baseline: {version_id}")
    
    def compare_to_baseline(
        self,
        df_scores: pd.DataFrame,
        baseline_version: str,
        tolerance: float = 5.0
    ) -> Dict:
        """
        Compare current scores to baseline.
        
        Args:
            df_scores: Current scores
            baseline_version: Baseline version to compare against
            tolerance: Maximum allowed score difference
            
        Returns:
            Comparison report
        """
        baseline_file = self.baseline_dir / f"baseline_{baseline_version}.parquet"
        
        if not baseline_file.exists():
            return {'error': f"Baseline not found: {baseline_version}"}
        
        baseline = pd.read_parquet(baseline_file)
        
        report = {
            'baseline_version': baseline_version,
            'regressions': [],
            'improvements': [],
            'statistics': {}
        }
        
        # Merge on ticker, date, block
        merged = df_scores.merge(
            baseline,
            on=['ticker', 'date', 'block'],
            suffixes=('_new', '_baseline')
        )
        
        merged['diff'] = merged['score_adjusted_new'] - merged['score_adjusted_baseline']
        
        # Find regressions (significant decreases)
        regressions = merged[merged['diff'] < -tolerance]
        for _, row in regressions.iterrows():
            report['regressions'].append({
                'ticker': row['ticker'],
                'date': str(row['date']),
                'block': row['block'],
                'old_score': float(row['score_adjusted_baseline']),
                'new_score': float(row['score_adjusted_new']),
                'diff': float(row['diff'])
            })
        
        # Find improvements
        improvements = merged[merged['diff'] > tolerance]
        for _, row in improvements.iterrows():
            report['improvements'].append({
                'ticker': row['ticker'],
                'date': str(row['date']),
                'block': row['block'],
                'old_score': float(row['score_adjusted_baseline']),
                'new_score': float(row['score_adjusted_new']),
                'diff': float(row['diff'])
            })
        
        # Overall statistics
        report['statistics'] = {
            'total_comparisons': len(merged),
            'regressions_count': len(regressions),
            'improvements_count': len(improvements),
            'mean_diff': float(merged['diff'].mean()),
            'std_diff': float(merged['diff'].std())
        }
        
        return report
