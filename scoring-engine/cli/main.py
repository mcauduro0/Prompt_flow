#!/usr/bin/env python3
"""
ARC Scoring Engine - CLI
Command-line interface for running scoring operations.
"""

import argparse
import sys
import os
import yaml
import json
import uuid
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from data_layer.loaders import (
    load_prices, load_fundamentals, load_estimates, load_ic_memos
)
from feature_engineering.contrarian import compute_all_contrarian_signals
from feature_engineering.turnaround import compute_all_turnaround_signals
from feature_engineering.piotroski import compute_all_piotroski_signals
from feature_engineering.quality import compute_all_quality_signals
from scoring.normalizer import normalize_all_signals
from scoring.aggregator import compute_all_scores, add_quintiles
from governance.governance import (
    setup_logging, VersionManager, AuditLogger, ScoreValidator, RegressionTester
)

import pandas as pd


def load_config(config_path: str) -> dict:
    """Load configuration from YAML file."""
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)


def run_full_pipeline(
    tickers: list,
    start_date: str,
    end_date: str,
    config_path: str,
    output_dir: str,
    version_name: str = None,
    save_baseline: bool = False
) -> pd.DataFrame:
    """
    Run the full scoring pipeline.
    
    Args:
        tickers: List of ticker symbols
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        config_path: Path to configuration file
        output_dir: Directory for output files
        version_name: Optional version name
        save_baseline: Whether to save as baseline
        
    Returns:
        DataFrame with all scores
    """
    # Setup
    logger = setup_logging()
    run_id = str(uuid.uuid4())[:8]
    logger.info(f"Starting run {run_id} for {len(tickers)} tickers")
    
    # Load config
    config = load_config(config_path)
    
    # Version management
    version_mgr = VersionManager()
    version_id = version_mgr.save_version(
        config,
        version_name=version_name,
        metadata={'tickers': tickers[:10], 'date_range': [start_date, end_date]}
    )
    
    # Audit logging
    audit = AuditLogger()
    
    try:
        # =================================================================
        # LAYER 1: DATA LOADING
        # =================================================================
        logger.info("Loading data...")
        
        df_prices = load_prices(tickers, start_date, end_date)
        logger.info(f"Loaded {len(df_prices)} price records")
        
        df_fundamentals = load_fundamentals(tickers, start_date, end_date)
        logger.info(f"Loaded {len(df_fundamentals)} fundamental records")
        
        df_estimates = load_estimates(tickers)
        logger.info(f"Loaded {len(df_estimates)} estimate records")
        
        df_ic_memos = load_ic_memos(tickers)
        logger.info(f"Loaded {len(df_ic_memos)} IC Memo records")
        
        # =================================================================
        # LAYER 2: FEATURE ENGINEERING (Raw Signals)
        # =================================================================
        logger.info("Computing raw signals...")
        
        all_signals = []
        
        # Contrarian signals
        contrarian_signals = compute_all_contrarian_signals(
            df_prices, df_fundamentals, df_estimates
        )
        all_signals.append(contrarian_signals)
        logger.info(f"Computed {len(contrarian_signals)} contrarian signals")
        
        # Turnaround signals
        turnaround_signals = compute_all_turnaround_signals(
            df_prices, df_fundamentals, df_estimates
        )
        all_signals.append(turnaround_signals)
        logger.info(f"Computed {len(turnaround_signals)} turnaround signals")
        
        # Piotroski signals
        piotroski_signals = compute_all_piotroski_signals(df_fundamentals)
        all_signals.append(piotroski_signals)
        logger.info(f"Computed {len(piotroski_signals)} piotroski signals")
        
        # Quality signals
        quality_signals = compute_all_quality_signals(
            df_fundamentals, df_prices, df_ic_memos
        )
        all_signals.append(quality_signals)
        logger.info(f"Computed {len(quality_signals)} quality signals")
        
        # Combine all signals
        df_signals = pd.concat(all_signals, ignore_index=True)
        logger.info(f"Total signals: {len(df_signals)}")
        
        # =================================================================
        # LAYER 3: NORMALIZATION
        # =================================================================
        logger.info("Normalizing signals...")
        
        df_normalized = normalize_all_signals(df_signals, config)
        logger.info(f"Normalized {len(df_normalized)} signals")
        
        # =================================================================
        # LAYER 4: AGGREGATION
        # =================================================================
        logger.info("Computing scores...")
        
        # Create empty risk DataFrame (can be enhanced later)
        df_risk = pd.DataFrame(columns=['ticker', 'date'])
        
        df_scores = compute_all_scores(df_normalized, df_risk, config)
        logger.info(f"Computed {len(df_scores)} scores")
        
        # Add quintiles
        df_scores = add_quintiles(df_scores, reference_block='contrarian')
        logger.info("Added quintiles")
        
        # =================================================================
        # VALIDATION
        # =================================================================
        logger.info("Validating scores...")
        
        validator = ScoreValidator()
        
        score_validation = validator.validate_scores(df_scores)
        logger.info(f"Score validation: {score_validation['valid']}")
        
        quintile_validation = validator.validate_quintile_distribution(df_scores)
        logger.info(f"Quintile distribution: {quintile_validation['distribution']}")
        
        # =================================================================
        # OUTPUT
        # =================================================================
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Save scores
        scores_file = output_path / f"scores_{run_id}.parquet"
        df_scores.to_parquet(scores_file)
        logger.info(f"Saved scores to {scores_file}")
        
        # Save signals
        signals_file = output_path / f"signals_{run_id}.parquet"
        df_normalized.to_parquet(signals_file)
        logger.info(f"Saved signals to {signals_file}")
        
        # Save summary CSV
        summary_file = output_path / f"summary_{run_id}.csv"
        summary = df_scores.pivot_table(
            index=['ticker', 'date'],
            columns='block',
            values='score_adjusted'
        ).reset_index()
        summary.to_csv(summary_file, index=False)
        logger.info(f"Saved summary to {summary_file}")
        
        # Save baseline if requested
        if save_baseline:
            regression_tester = RegressionTester()
            regression_tester.save_baseline(df_scores, version_id)
        
        # Log audit
        audit.log_run(
            run_id=run_id,
            version_id=version_id,
            tickers=tickers,
            date_range=(start_date, end_date),
            status='success',
            metrics={
                'signals_count': len(df_normalized),
                'scores_count': len(df_scores),
                'validation': score_validation['statistics']
            }
        )
        
        logger.info(f"Run {run_id} completed successfully")
        
        return df_scores
        
    except Exception as e:
        logger.error(f"Run {run_id} failed: {str(e)}")
        audit.log_run(
            run_id=run_id,
            version_id=version_id,
            tickers=tickers,
            date_range=(start_date, end_date),
            status='failed',
            metrics={'error': str(e)}
        )
        raise


def run_single_ticker(
    ticker: str,
    date: str,
    config_path: str
) -> dict:
    """
    Run scoring for a single ticker/date.
    
    Args:
        ticker: Ticker symbol
        date: Date (YYYY-MM-DD)
        config_path: Path to configuration file
        
    Returns:
        Dict with scores
    """
    df_scores = run_full_pipeline(
        tickers=[ticker],
        start_date=date,
        end_date=date,
        config_path=config_path,
        output_dir='/tmp/arc_scoring'
    )
    
    result = {}
    for _, row in df_scores.iterrows():
        result[row['block']] = {
            'score': row['score_adjusted'],
            'quintile': row.get('quintile')
        }
    
    return result


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description='ARC Scoring Engine CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run full pipeline for all tickers
  python main.py run --config config/weights.yaml --start 2024-01-01 --end 2024-12-31

  # Run for specific tickers
  python main.py run --tickers AAPL,MSFT,GOOGL --config config/weights.yaml

  # Score a single ticker
  python main.py score --ticker AAPL --date 2024-12-31 --config config/weights.yaml

  # List versions
  python main.py versions

  # Compare to baseline
  python main.py compare --baseline v1.0_20240101 --config config/weights.yaml
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Run command
    run_parser = subparsers.add_parser('run', help='Run full scoring pipeline')
    run_parser.add_argument('--tickers', type=str, help='Comma-separated list of tickers')
    run_parser.add_argument('--tickers-file', type=str, help='File with tickers (one per line)')
    run_parser.add_argument('--config', type=str, required=True, help='Path to config file')
    run_parser.add_argument('--start', type=str, required=True, help='Start date (YYYY-MM-DD)')
    run_parser.add_argument('--end', type=str, required=True, help='End date (YYYY-MM-DD)')
    run_parser.add_argument('--output', type=str, default='./output', help='Output directory')
    run_parser.add_argument('--version-name', type=str, help='Version name')
    run_parser.add_argument('--save-baseline', action='store_true', help='Save as baseline')
    
    # Score command
    score_parser = subparsers.add_parser('score', help='Score a single ticker')
    score_parser.add_argument('--ticker', type=str, required=True, help='Ticker symbol')
    score_parser.add_argument('--date', type=str, required=True, help='Date (YYYY-MM-DD)')
    score_parser.add_argument('--config', type=str, required=True, help='Path to config file')
    
    # Versions command
    versions_parser = subparsers.add_parser('versions', help='List configuration versions')
    
    # Compare command
    compare_parser = subparsers.add_parser('compare', help='Compare to baseline')
    compare_parser.add_argument('--baseline', type=str, required=True, help='Baseline version ID')
    compare_parser.add_argument('--config', type=str, required=True, help='Path to config file')
    compare_parser.add_argument('--tickers', type=str, help='Comma-separated list of tickers')
    compare_parser.add_argument('--start', type=str, required=True, help='Start date')
    compare_parser.add_argument('--end', type=str, required=True, help='End date')
    
    args = parser.parse_args()
    
    if args.command == 'run':
        # Get tickers
        if args.tickers:
            tickers = [t.strip() for t in args.tickers.split(',')]
        elif args.tickers_file:
            with open(args.tickers_file, 'r') as f:
                tickers = [line.strip() for line in f if line.strip()]
        else:
            print("Error: Must specify --tickers or --tickers-file")
            sys.exit(1)
        
        run_full_pipeline(
            tickers=tickers,
            start_date=args.start,
            end_date=args.end,
            config_path=args.config,
            output_dir=args.output,
            version_name=args.version_name,
            save_baseline=args.save_baseline
        )
        
    elif args.command == 'score':
        result = run_single_ticker(
            ticker=args.ticker,
            date=args.date,
            config_path=args.config
        )
        print(json.dumps(result, indent=2))
        
    elif args.command == 'versions':
        version_mgr = VersionManager()
        versions = version_mgr.list_versions()
        for v in versions:
            print(f"{v['version_id']} ({v['timestamp']})")
            
    elif args.command == 'compare':
        # Get tickers
        if args.tickers:
            tickers = [t.strip() for t in args.tickers.split(',')]
        else:
            print("Error: Must specify --tickers")
            sys.exit(1)
        
        # Run current pipeline
        df_scores = run_full_pipeline(
            tickers=tickers,
            start_date=args.start,
            end_date=args.end,
            config_path=args.config,
            output_dir='/tmp/arc_scoring'
        )
        
        # Compare to baseline
        regression_tester = RegressionTester()
        report = regression_tester.compare_to_baseline(df_scores, args.baseline)
        print(json.dumps(report, indent=2))
        
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
