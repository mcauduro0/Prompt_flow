"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  TrendingUp, TrendingDown, DollarSign, PieChart, AlertTriangle, 
  Shield, Target, Activity, Settings, Play, BarChart3, 
  RefreshCw, Download, BookOpen, Zap, Scale
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PositionsTab } from "@/components/portfolio/PositionsTab";

// ============================================================================
// TYPES
// ============================================================================

interface Position {
  id: string;
  ticker: string;
  company_name: string;
  weight_percent: number;
  pnl_percent: number;
  conviction: number;
  style: string;
  entry_date: string;
}

interface PortfolioSummary {
  total_value: number;
  total_pnl: number;
  total_pnl_percent: number;
  positions_count: number;
  cash_percent: number;
  top_sector: string;
  avg_conviction: number;
}

interface RiskMetrics {
  concentration_risk: number;
  diversification_score: number;
  avg_conviction: number;
  high_conviction_weight: number;
  winners_count: number;
  losers_count: number;
  win_rate: number;
}

interface RiskAlert {
  level: string;
  message: string;
}

interface SystematicPosition {
  ticker: string;
  companyName: string;
  conviction: number;
  recommendation: string;
  scoreOptimized: number;
  weight: number;
  quintile: string;
}

interface SystematicPortfolio {
  portfolio: SystematicPosition[];
  summary: {
    totalPositions: number;
    avgConviction: number;
    avgScore: number;
    strategy: string;
    weightingMethod: string;
    quintileDistribution: Record<string, number>;
    totalWeight: number;
  };
  config: {
    strategy: string;
    weightingMethod: string;
    maxPositions: number;
    maxSingleWeight: number;
    rebalanceFrequency: string;
  };
  rules: {
    selectionRule: string;
    weightingRule: string;
    maxWeight: string;
    rebalance: string;
  };
}

interface BacktestResult {
  params: {
    strategy: string;
    period: string;
    winsorization: number;
    minLiquidity: number;
    riskFreeRate: number;
  };
  result: {
    totalReturn: number;
    annualReturn: number;
    volatility: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    calmarRatio: number;
    winRate: number;
    positionsCount: number;
    periodDays: number;
  };
  confidence: {
    sharpeCI95: [number, number];
    monteCarloPercentile: number;
    pValue: number;
  };
}

interface SensitivityData {
  sensitivity: {
    thresholdSensitivity: Array<{
      threshold: string;
      nStocks: number;
      annualReturn: number;
      sharpe: number;
      maxDD: number;
    }>;
    winsorizationSensitivity: Array<{
      level: string;
      annualReturn: number;
      sharpe: number;
      maxDD: number;
    }>;
    periodSensitivity: Array<{
      period: string;
      annualReturn: number;
      sharpe: number;
      maxDD: number;
    }>;
    stressTests: Array<{
      event: string;
      days: number;
      return: number;
    }>;
    monteCarloResults: {
      q5Sharpe: number;
      randomMeanSharpe: number;
      randomStdSharpe: number;
      percentile: number;
      pValue: number;
    };
  };
  conclusion: {
    robustness: string;
    recommendation: string;
    keyFindings: string[];
  };
}

// ============================================================================
// STYLE MAPPINGS
// ============================================================================

const styleColors: Record<string, string> = {
  quality_compounder: 'bg-emerald-500/20 text-emerald-400',
  garp: 'bg-blue-500/20 text-blue-400',
  cigar_butt: 'bg-amber-500/20 text-amber-400',
  turnaround: 'bg-purple-500/20 text-purple-400',
  special_situation: 'bg-pink-500/20 text-pink-400',
};

const styleLabels: Record<string, string> = {
  quality_compounder: 'Quality',
  garp: 'GARP',
  cigar_butt: 'Deep Value',
  turnaround: 'Turnaround',
  special_situation: 'Special',
};

const quintileColors: Record<string, string> = {
  Q5: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Q4: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Q3: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Q2: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Q1: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PortfolioPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [breakdown, setBreakdown] = useState<{ by_sector: Record<string, number>; by_style: Record<string, number> } | null>(null);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'systematic' | 'backtest' | 'positions' | 'risk'>('systematic');

  // Systematic portfolio state
  const [systematicPortfolio, setSystematicPortfolio] = useState<SystematicPortfolio | null>(null);
  const [systematicLoading, setSystematicLoading] = useState(false);
  const [systematicConfig, setSystematicConfig] = useState({
    strategy: 'q5_only',
    weighting: 'equal',
    maxPositions: 25,
    maxWeight: 10,
  });

  // Backtest state
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestParams, setBacktestParams] = useState({
    strategy: 'q5_only',
    period: '10y',
    winsorization: 5,
    minLiquidity: 1000000,
    riskFreeRate: 0.02,
  });

  // Sensitivity state
  const [sensitivityData, setSensitivityData] = useState<SensitivityData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch portfolio overview
        const portfolioRes = await fetch('/api/portfolio');
        if (portfolioRes.ok) {
          const data = await portfolioRes.json();
          setPositions(data.positions || []);
          setSummary(data.summary || null);
          setBreakdown(data.breakdown || null);
        }

        // Fetch risk metrics
        const riskRes = await fetch('/api/portfolio/risk');
        if (riskRes.ok) {
          const data = await riskRes.json();
          setRiskMetrics(data.risk_metrics || null);
          setAlerts(data.alerts || []);
        }

        // Fetch systematic portfolio
        await fetchSystematicPortfolio();

        // Fetch sensitivity data
        const sensitivityRes = await fetch('/api/portfolio/systematic/sensitivity');
        if (sensitivityRes.ok) {
          const data = await sensitivityRes.json();
          setSensitivityData(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const fetchSystematicPortfolio = useCallback(async () => {
    setSystematicLoading(true);
    try {
      const params = new URLSearchParams({
        strategy: systematicConfig.strategy,
        weighting: systematicConfig.weighting,
        maxPositions: systematicConfig.maxPositions.toString(),
        maxWeight: systematicConfig.maxWeight.toString(),
      });
      const res = await fetch(`/api/portfolio/systematic?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSystematicPortfolio(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSystematicLoading(false);
    }
  }, [systematicConfig]);

  const runBacktest = async () => {
    setBacktestLoading(true);
    try {
      const res = await fetch('/api/portfolio/systematic/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backtestParams),
      });
      if (res.ok) {
        const data = await res.json();
        setBacktestResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBacktestLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground animate-pulse-calm">Loading portfolio...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border">
          <div className="px-8 py-6">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-medium text-foreground tracking-tight">
                Portfolio Hub
              </h1>
              <span className="text-sm text-muted-foreground">
                Systematic Investment Management
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Conviction Score 2.0 based portfolio construction, backtesting, and risk analysis
            </p>
          </div>

          {/* Tabs */}
          <div className="px-8 pb-4">
            <div className="flex items-center gap-1">
              {[
                { id: 'systematic', label: 'Systematic', icon: Zap },
                { id: 'backtest', label: 'Backtest', icon: BarChart3 },
                { id: 'positions', label: 'Positions', icon: PieChart },
                { id: 'risk', label: 'Risk', icon: Shield },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-calm",
                    activeTab === tab.id
                      ? "bg-secondary text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 py-8">
          <div className="max-w-7xl mx-auto px-8">
            {activeTab === 'systematic' && (
              <SystematicTab 
                portfolio={systematicPortfolio}
                loading={systematicLoading}
                config={systematicConfig}
                setConfig={setSystematicConfig}
                onRefresh={fetchSystematicPortfolio}
                sensitivityData={sensitivityData}
              />
            )}
            {activeTab === 'backtest' && (
              <BacktestTab 
                result={backtestResult}
                loading={backtestLoading}
                params={backtestParams}
                setParams={setBacktestParams}
                onRun={runBacktest}
              />
            )}
            {activeTab === 'positions' && (
              <PositionsTab />
            )}
            {activeTab === 'risk' && (
              <RiskTab metrics={riskMetrics} alerts={alerts} positions={positions} />
            )}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}

// ============================================================================
// SYSTEMATIC TAB
// ============================================================================

interface SystematicTabProps {
  portfolio: SystematicPortfolio | null;
  loading: boolean;
  config: {
    strategy: string;
    weighting: string;
    maxPositions: number;
    maxWeight: number;
  };
  setConfig: (config: any) => void;
  onRefresh: () => void;
  sensitivityData: SensitivityData | null;
}

function SystematicTab({ portfolio, loading, config, setConfig, onRefresh, sensitivityData }: SystematicTabProps) {
  return (
    <div className="space-y-8">
      {/* Configuration Panel */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-medium text-foreground">Portfolio Configuration</h2>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Generate Portfolio
          </button>
        </div>

        <div className="grid grid-cols-4 gap-6">
          {/* Strategy Selection */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Strategy
            </label>
            <select
              value={config.strategy}
              onChange={(e) => setConfig({ ...config, strategy: e.target.value })}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="q5_only">Q5 Only (Top 20%)</option>
              <option value="top_40">Top 40% (Q4+Q5)</option>
              <option value="top_60">Top 60% (Q3+Q4+Q5)</option>
            </select>
          </div>

          {/* Weighting Method */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Weighting
            </label>
            <select
              value={config.weighting}
              onChange={(e) => setConfig({ ...config, weighting: e.target.value })}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="equal">Equal Weight</option>
              <option value="conviction_weighted">Conviction Weighted</option>
              <option value="risk_parity">Risk Parity</option>
            </select>
          </div>

          {/* Max Positions */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Max Positions
            </label>
            <input
              type="number"
              value={config.maxPositions}
              onChange={(e) => setConfig({ ...config, maxPositions: parseInt(e.target.value) || 25 })}
              min={5}
              max={50}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Max Weight */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Max Weight (%)
            </label>
            <input
              type="number"
              value={config.maxWeight}
              onChange={(e) => setConfig({ ...config, maxWeight: parseInt(e.target.value) || 10 })}
              min={5}
              max={25}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Portfolio Summary */}
      {portfolio && portfolio.portfolio.length > 0 && (
        <>
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <PieChart className="w-4 h-4" />
                <span className="text-sm">Positions</span>
              </div>
              <p className="text-2xl font-medium text-foreground">
                {portfolio.summary.totalPositions}
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Target className="w-4 h-4" />
                <span className="text-sm">Avg Conviction</span>
              </div>
              <p className="text-2xl font-medium text-foreground">
                {portfolio.summary.avgConviction}/50
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Zap className="w-4 h-4" />
                <span className="text-sm">Avg Score</span>
              </div>
              <p className="text-2xl font-medium text-foreground">
                {portfolio.summary.avgScore.toFixed(1)}
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Scale className="w-4 h-4" />
                <span className="text-sm">Strategy</span>
              </div>
              <p className="text-lg font-medium text-foreground">
                {portfolio.summary.strategy === 'q5_only' ? 'Q5 Only' : 
                 portfolio.summary.strategy === 'top_40' ? 'Top 40%' : 'Top 60%'}
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Activity className="w-4 h-4" />
                <span className="text-sm">Total Weight</span>
              </div>
              <p className="text-2xl font-medium text-foreground">
                {portfolio.summary.totalWeight.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Rules Display */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Active Rules
            </h3>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Selection:</span>
                <p className="text-foreground font-medium">{portfolio.rules.selectionRule}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Weighting:</span>
                <p className="text-foreground font-medium">{portfolio.rules.weightingRule}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Max Weight:</span>
                <p className="text-foreground font-medium">{portfolio.rules.maxWeight}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Rebalance:</span>
                <p className="text-foreground font-medium capitalize">{portfolio.rules.rebalance}</p>
              </div>
            </div>
          </div>

          {/* Portfolio Positions Table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-secondary/30 border-b border-border">
              <h3 className="text-sm font-medium text-foreground">Systematic Portfolio Positions</h3>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <div className="grid grid-cols-7 gap-4 px-4 py-3 bg-secondary/20 border-b border-border text-sm font-medium text-muted-foreground">
              <div>Ticker</div>
              <div className="col-span-2">Company</div>
              <div>Score</div>
              <div>Conviction</div>
              <div>Quintile</div>
              <div>Weight</div>
            </div>
            <div className="divide-y divide-border/50 max-h-96 overflow-y-auto">
              {portfolio.portfolio.map((pos, idx) => (
                <div key={idx} className="grid grid-cols-7 gap-4 px-4 py-3 text-sm hover:bg-secondary/10">
                  <div className="font-mono font-medium text-foreground">{pos.ticker}</div>
                  <div className="col-span-2 text-muted-foreground truncate">{pos.companyName}</div>
                  <div className="text-foreground font-medium">{pos.scoreOptimized.toFixed(1)}</div>
                  <div className={cn(
                    pos.conviction >= 40 ? "text-emerald-400" :
                    pos.conviction >= 30 ? "text-amber-400" : "text-muted-foreground"
                  )}>
                    {pos.conviction}/50
                  </div>
                  <div>
                    <span className={cn("px-2 py-0.5 rounded text-xs border", quintileColors[pos.quintile])}>
                      {pos.quintile}
                    </span>
                  </div>
                  <div className="text-foreground font-medium">{pos.weight.toFixed(2)}%</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {portfolio && portfolio.portfolio.length === 0 && (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <PieChart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No IC Memos with conviction scores found.</p>
          <p className="text-sm text-muted-foreground/60 mt-2">
            Generate IC Memos first to build a systematic portfolio.
          </p>
        </div>
      )}

      {/* Sensitivity Analysis Summary */}
      {sensitivityData && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Robustness Analysis
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Monte Carlo Validation</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-medium text-emerald-400">
                  {sensitivityData.sensitivity.monteCarloResults.percentile.toFixed(0)}%
                </span>
                <span className="text-sm text-muted-foreground">percentile vs random portfolios</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                p-value: {sensitivityData.sensitivity.monteCarloResults.pValue.toFixed(4)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Key Findings</p>
              <ul className="space-y-1">
                {sensitivityData.conclusion.keyFindings.slice(0, 3).map((finding, idx) => (
                  <li key={idx} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-emerald-400 mt-1">✓</span>
                    {finding}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// BACKTEST TAB
// ============================================================================

interface BacktestTabProps {
  result: BacktestResult | null;
  loading: boolean;
  params: {
    strategy: string;
    period: string;
    winsorization: number;
    minLiquidity: number;
    riskFreeRate: number;
  };
  setParams: (params: any) => void;
  onRun: () => void;
}

function BacktestTab({ result, loading, params, setParams, onRun }: BacktestTabProps) {
  return (
    <div className="space-y-8">
      {/* Backtest Configuration */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-medium text-foreground">Backtest Configuration</h2>
          </div>
          <button
            onClick={onRun}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Run Backtest
          </button>
        </div>

        <div className="grid grid-cols-5 gap-6">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Strategy
            </label>
            <select
              value={params.strategy}
              onChange={(e) => setParams({ ...params, strategy: e.target.value })}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="q5_only">Q5 Only (Top 20%)</option>
              <option value="top_40">Top 40%</option>
              <option value="top_60">Top 60%</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Period
            </label>
            <select
              value={params.period}
              onChange={(e) => setParams({ ...params, period: e.target.value })}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="10y">10 Years</option>
              <option value="5y">5 Years</option>
              <option value="3y">3 Years</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Winsorization (%)
            </label>
            <select
              value={params.winsorization}
              onChange={(e) => setParams({ ...params, winsorization: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={1}>1%-99%</option>
              <option value={2.5}>2.5%-97.5%</option>
              <option value={5}>5%-95%</option>
              <option value={10}>10%-90%</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Min Liquidity ($)
            </label>
            <select
              value={params.minLiquidity}
              onChange={(e) => setParams({ ...params, minLiquidity: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={0}>No Filter</option>
              <option value={500000}>$500K+</option>
              <option value={1000000}>$1M+</option>
              <option value={5000000}>$5M+</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Risk-Free Rate (%)
            </label>
            <input
              type="number"
              value={params.riskFreeRate * 100}
              onChange={(e) => setParams({ ...params, riskFreeRate: parseFloat(e.target.value) / 100 || 0.02 })}
              step={0.5}
              min={0}
              max={10}
              className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Backtest Results */}
      {result && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-sm">Annual Return</span>
              </div>
              <p className="text-2xl font-medium text-emerald-400">
                +{result.result.annualReturn.toFixed(2)}%
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Activity className="w-4 h-4" />
                <span className="text-sm">Sharpe Ratio</span>
              </div>
              <p className="text-2xl font-medium text-foreground">
                {result.result.sharpeRatio.toFixed(3)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                95% CI: [{result.confidence.sharpeCI95[0].toFixed(2)}, {result.confidence.sharpeCI95[1].toFixed(2)}]
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-sm">Max Drawdown</span>
              </div>
              <p className="text-2xl font-medium text-red-400">
                {result.result.maxDrawdown.toFixed(2)}%
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Target className="w-4 h-4" />
                <span className="text-sm">Win Rate</span>
              </div>
              <p className="text-2xl font-medium text-foreground">
                {result.result.winRate.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Detailed Metrics */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Performance Metrics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Return</span>
                  <span className="text-sm font-medium text-emerald-400">+{result.result.totalReturn.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Volatility</span>
                  <span className="text-sm font-medium text-foreground">{result.result.volatility.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Sortino Ratio</span>
                  <span className="text-sm font-medium text-foreground">{result.result.sortinoRatio.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Calmar Ratio</span>
                  <span className="text-sm font-medium text-foreground">{result.result.calmarRatio.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Positions</span>
                  <span className="text-sm font-medium text-foreground">{result.result.positionsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Trading Days</span>
                  <span className="text-sm font-medium text-foreground">{result.result.periodDays}</span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Statistical Confidence</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Monte Carlo Percentile</span>
                    <span className="text-sm font-medium text-emerald-400">{result.confidence.monteCarloPercentile}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${result.confidence.monteCarloPercentile}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">p-value (vs random)</span>
                  <span className={cn(
                    "text-sm font-medium",
                    result.confidence.pValue < 0.05 ? "text-emerald-400" : "text-amber-400"
                  )}>
                    {result.confidence.pValue.toFixed(4)}
                  </span>
                </div>
                <div className="mt-4 p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    {result.confidence.pValue < 0.05 
                      ? "✓ Strategy performance is statistically significant (p < 0.05)"
                      : "⚠ Strategy performance may not be statistically significant"
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Configure parameters and run a backtest</p>
          <p className="text-sm text-muted-foreground/60 mt-2">
            Backtests use Conviction Score 2.0 methodology with validated data
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// POSITIONS TAB
// ============================================================================

interface PositionsTabProps {
  positions: Position[];
}

// PositionsTab is now imported from @/components/portfolio/PositionsTab

// ============================================================================
// RISK TAB
// ============================================================================

interface RiskTabProps {
  metrics: RiskMetrics | null;
  alerts: RiskAlert[];
  positions: Position[];
}

function RiskTab({ metrics, alerts, positions }: RiskTabProps) {
  if (!metrics) {
    return (
      <div className="text-center py-16 bg-card border border-border rounded-lg">
        <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">No risk data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Risk metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">Concentration Risk</span>
          </div>
          <p className={cn(
            "text-2xl font-medium",
            metrics.concentration_risk > 20 ? "text-amber-400" : "text-foreground"
          )}>
            {metrics.concentration_risk.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">Max single position</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Shield className="w-4 h-4" />
            <span className="text-sm">Diversification</span>
          </div>
          <p className={cn(
            "text-2xl font-medium",
            metrics.diversification_score >= 70 ? "text-emerald-400" :
            metrics.diversification_score >= 40 ? "text-amber-400" : "text-red-400"
          )}>
            {metrics.diversification_score.toFixed(0)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Score out of 100</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Target className="w-4 h-4" />
            <span className="text-sm">High Conviction</span>
          </div>
          <p className="text-2xl font-medium text-foreground">
            {metrics.high_conviction_weight.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">Weight in 8+ conviction</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-sm">Win Rate</span>
          </div>
          <p className={cn(
            "text-2xl font-medium",
            metrics.win_rate >= 60 ? "text-emerald-400" :
            metrics.win_rate >= 40 ? "text-amber-400" : "text-red-400"
          )}>
            {metrics.win_rate.toFixed(0)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.winners_count}W / {metrics.losers_count}L
          </p>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Risk Alerts</h3>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div 
                key={i}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg",
                  alert.level === 'warning' && "bg-amber-500/10",
                  alert.level === 'info' && "bg-blue-500/10"
                )}
              >
                <AlertTriangle className={cn(
                  "w-4 h-4",
                  alert.level === 'warning' ? "text-amber-400" : "text-blue-400"
                )} />
                <span className="text-sm text-foreground">{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Position risk breakdown */}
      {positions.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Position Risk Analysis</h3>
          <div className="space-y-2">
            {positions.map((pos) => (
              <div key={pos.id} className="flex items-center gap-4">
                <span className="font-mono text-sm text-foreground w-16">{pos.ticker}</span>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full",
                      pos.pnl_percent >= 0 ? "bg-emerald-500" : "bg-red-500"
                    )}
                    style={{ width: `${Math.min(100, Math.abs(pos.pnl_percent) * 2)}%` }}
                  />
                </div>
                <span className={cn(
                  "text-sm w-16 text-right",
                  pos.pnl_percent >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {pos.pnl_percent >= 0 ? '+' : ''}{pos.pnl_percent.toFixed(1)}%
                </span>
                <span className="text-sm text-muted-foreground w-16 text-right">
                  {pos.weight_percent.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
