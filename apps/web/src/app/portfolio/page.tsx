"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  TrendingUp, TrendingDown, DollarSign, PieChart, AlertTriangle, 
  Shield, Target, Activity, Settings, Play, BarChart3, 
  RefreshCw, Download, Zap, Scale, Star, Filter, Briefcase,
  ChevronDown, ChevronUp, Check, Loader2, ArrowUpRight, ArrowDownRight, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================
interface GeneratedPosition {
  ticker: string;
  companyName: string;
  weight: number;
  qualityScore: number | null;
  momentumScore: number | null;
  turnaroundScore: number | null;
  piotroskiScore: number | null;
  compositeScore: number | null;
  compositeQuintile: number | null;
  styleTag: string | null;
}

interface GeneratedPortfolio {
  positions: GeneratedPosition[];
  summary: {
    totalPositions: number;
    avgCompositeScore: number;
    avgQualityScore: number;
    avgMomentumScore: number;
    avgTurnaroundScore: number;
    avgPiotroskiScore: number;
    quintileDistribution: Record<string, number>;
    totalWeight: number;
  };
  config: any;
}

interface BacktestResult {
  config: any;
  metrics: {
    totalReturn: number;
    cagr: number;
    volatility: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    calmarRatio: number;
    alpha: number;
    beta: number;
    informationRatio: number;
    trackingError: number;
    winRate: number;
    avgPositions: number;
  };
  benchmark: {
    totalReturn: number;
    cagr: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  timeSeries: any[];
}

interface ScoreComparison {
  scoreType: string;
  quintile: number;
  totalReturn: number;
  cagr: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  alpha: number;
  beta: number;
}

interface MarketDataItem {
  ticker: string;
  companyName: string;
  currentPrice: number | null;
  previousClose: number | null;
  changePercent: number | null;
  return3M: number | null;
  return12M: number | null;
  peForward: number | null;
  evEbitdaForward: number | null;
  priceTargetBase: number | null;
  priceTargetHigh: number | null;
  priceTargetLow: number | null;
  upsidePercent: number | null;
  lastUpdated: string;
  dataSource: "polygon" | "fmp" | "mixed";
}

type SortField = "ticker" | "changePercent" | "return3M" | "return12M" | "peForward" | "evEbitdaForward" | "upsidePercent";
type SortDirection = "asc" | "desc";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function formatNumber(value: number | null, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return value.toFixed(decimals);
}

function formatPercent(value: number | null, showSign: boolean = true): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatPrice(value: number | null): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return `$${value.toFixed(2)}`;
}

function getChangeColor(value: number | null): string {
  if (value === null || value === undefined) return "text-muted-foreground";
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-muted-foreground";
}

function getUpsideColor(value: number | null): string {
  if (value === null || value === undefined) return "text-muted-foreground";
  if (value > 20) return "text-emerald-400";
  if (value > 0) return "text-blue-400";
  if (value > -10) return "text-amber-400";
  return "text-red-400";
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<"generator" | "market-data" | "backtest" | "analytics">("generator");
  
  // Generator state
  const [scoreType, setScoreType] = useState<string>("composite");
  const [targetQuintile, setTargetQuintile] = useState<number>(5);
  const [weightingMethod, setWeightingMethod] = useState<string>("equal");
  const [maxPositions, setMaxPositions] = useState<number>(25);
  const [portfolio, setPortfolio] = useState<GeneratedPortfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  
  // Backtest state
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [runningBacktest, setRunningBacktest] = useState(false);
  const [comparison, setComparison] = useState<ScoreComparison[]>([]);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://159.203.86.246:3001";

  // ============================================================================
  // GENERATE PORTFOLIO
  // ============================================================================
  const generatePortfolio = useCallback(async () => {
    setGenerating(true);
    try {
      const params = new URLSearchParams({
        scoreType,
        quintile: String(targetQuintile),
        weighting: weightingMethod,
        maxPositions: String(maxPositions),
      });
      
      const response = await fetch(`${API_URL}/api/portfolio/generator/generate?${params}`);
      const data = await response.json();
      setPortfolio(data);
    } catch (error) {
      console.error("Failed to generate portfolio:", error);
    } finally {
      setGenerating(false);
    }
  }, [API_URL, scoreType, targetQuintile, weightingMethod, maxPositions]);

  // ============================================================================
  // RUN BACKTEST
  // ============================================================================
  const runBacktest = useCallback(async () => {
    setRunningBacktest(true);
    try {
      const response = await fetch(`${API_URL}/api/backtest/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scoreType,
          quintile: targetQuintile,
          startDate: "2015-01-01",
          endDate: "2024-12-31",
          initialCapital: 100000,
          rebalanceFrequency: "quarterly",
          benchmark: "SPY",
        }),
      });
      const data = await response.json();
      setBacktestResult(data);
    } catch (error) {
      console.error("Failed to run backtest:", error);
    } finally {
      setRunningBacktest(false);
    }
  }, [API_URL, scoreType, targetQuintile]);

  // ============================================================================
  // LOAD COMPARISON
  // ============================================================================
  const loadComparison = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/backtest/compare?quintile=${targetQuintile}`);
      const data = await response.json();
      setComparison(data.comparison || []);
    } catch (error) {
      console.error("Failed to load comparison:", error);
    }
  }, [API_URL, targetQuintile]);

  useEffect(() => {
    generatePortfolio();
    loadComparison();
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-primary" />
              Portfolio Manager
            </h1>
            <p className="text-muted-foreground mt-1">
              Generate investable portfolios based on quantitative scores and run backtests
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generatePortfolio}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Generate Portfolio
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg w-fit">
          {[
            { id: "generator", label: "Portfolio Generator", icon: Briefcase },
            { id: "market-data", label: "Market Data", icon: DollarSign },
            { id: "backtest", label: "Backtest Engine", icon: BarChart3 },
            { id: "analytics", label: "Risk Analytics", icon: Shield },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md transition-colors",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Configuration Panel */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Portfolio Configuration
          </h3>
          <div className="grid grid-cols-4 gap-6">
            {/* Score Type */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Score Type
              </label>
              <select
                value={scoreType}
                onChange={(e) => setScoreType(e.target.value)}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="composite">Composite Score</option>
                <option value="quality">Quality Score</option>
                <option value="momentum">Momentum Score</option>
                <option value="turnaround">Turnaround Score</option>
                <option value="piotroski">Piotroski F-Score</option>
              </select>
            </div>

            {/* Target Quintile */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Target Quintile
              </label>
              <select
                value={targetQuintile}
                onChange={(e) => setTargetQuintile(Number(e.target.value))}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={5}>Q5 (Top 20%)</option>
                <option value={4}>Q4 (60-80%)</option>
                <option value={3}>Q3 (40-60%)</option>
                <option value={2}>Q2 (20-40%)</option>
                <option value={1}>Q1 (Bottom 20%)</option>
              </select>
            </div>

            {/* Weighting Method */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Weighting Method
              </label>
              <select
                value={weightingMethod}
                onChange={(e) => setWeightingMethod(e.target.value)}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="equal">Equal Weight</option>
                <option value="score_weighted">Score Weighted</option>
              </select>
            </div>

            {/* Max Positions */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Max Positions
              </label>
              <select
                value={maxPositions}
                onChange={(e) => setMaxPositions(Number(e.target.value))}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={10}>10 positions</option>
                <option value={15}>15 positions</option>
                <option value={20}>20 positions</option>
                <option value={25}>25 positions</option>
                <option value={30}>30 positions</option>
                <option value={50}>50 positions</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "generator" && (
          <GeneratorTab 
            portfolio={portfolio} 
            generating={generating}
            onGenerate={generatePortfolio}
          />
        )}
        
        {activeTab === "market-data" && (
          <MarketDataTab 
            portfolio={portfolio}
            apiUrl={API_URL}
          />
        )}
        
        {activeTab === "backtest" && (
          <BacktestTab 
            result={backtestResult}
            running={runningBacktest}
            onRun={runBacktest}
            comparison={comparison}
            scoreType={scoreType}
            quintile={targetQuintile}
          />
        )}
        
        {activeTab === "analytics" && (
          <AnalyticsTab 
            result={backtestResult}
            portfolio={portfolio}
          />
        )}
      </div>
    </AppLayout>
  );
}

// ============================================================================
// GENERATOR TAB
// ============================================================================
function GeneratorTab({ 
  portfolio, 
  generating,
  onGenerate 
}: { 
  portfolio: GeneratedPortfolio | null;
  generating: boolean;
  onGenerate: () => void;
}) {
  if (!portfolio) {
    return (
      <div className="text-center py-16 bg-card border border-border rounded-lg">
        <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">Configure parameters and generate a portfolio</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Target className="w-4 h-4" />
            <span className="text-sm">Positions</span>
          </div>
          <p className="text-2xl font-medium">{portfolio.summary.totalPositions}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Star className="w-4 h-4 text-amber-400" />
            <span className="text-sm">Avg Composite</span>
          </div>
          <p className="text-2xl font-medium text-amber-400">
            {portfolio.summary.avgCompositeScore.toFixed(1)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-sm">Avg Quality</span>
          </div>
          <p className="text-2xl font-medium text-emerald-400">
            {portfolio.summary.avgQualityScore.toFixed(1)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-sm">Avg Momentum</span>
          </div>
          <p className="text-2xl font-medium text-blue-400">
            {portfolio.summary.avgMomentumScore.toFixed(1)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-sm">Avg Piotroski</span>
          </div>
          <p className="text-2xl font-medium text-purple-400">
            {portfolio.summary.avgPiotroskiScore.toFixed(1)}/9
          </p>
        </div>
      </div>

      {/* Positions Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-medium">Generated Portfolio Positions</h3>
          <span className="text-sm text-muted-foreground">
            Total Weight: {portfolio.summary.totalWeight.toFixed(1)}%
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Ticker</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Company</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Weight</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Composite</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Quality</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Momentum</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Turnaround</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Piotroski</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Quintile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {portfolio.positions.map((pos, idx) => (
                <tr key={pos.ticker} className="hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <span className="font-mono font-medium">{pos.ticker}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                    {pos.companyName}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {pos.weight.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-amber-400 font-medium">
                      {pos.compositeScore?.toFixed(1) || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-emerald-400">
                      {pos.qualityScore?.toFixed(1) || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-blue-400">
                      {pos.momentumScore?.toFixed(1) || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-orange-400">
                      {pos.turnaroundScore?.toFixed(1) || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-purple-400">
                      {pos.piotroskiScore || "-"}/9
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-medium",
                      pos.compositeQuintile === 5 ? "bg-emerald-500/20 text-emerald-400" :
                      pos.compositeQuintile === 4 ? "bg-blue-500/20 text-blue-400" :
                      pos.compositeQuintile === 3 ? "bg-amber-500/20 text-amber-400" :
                      "bg-red-500/20 text-red-400"
                    )}>
                      Q{pos.compositeQuintile}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MARKET DATA TAB
// ============================================================================
function MarketDataTab({ 
  portfolio,
  apiUrl
}: { 
  portfolio: GeneratedPortfolio | null;
  apiUrl: string;
}) {
  const [marketData, setMarketData] = useState<MarketDataItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [sortField, setSortField] = useState<SortField>("ticker");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Fetch market data
  const fetchMarketData = useCallback(async () => {
    if (!portfolio || portfolio.positions.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/portfolio/market-data/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positions: portfolio.positions.map(p => ({
            ticker: p.ticker,
            companyName: p.companyName,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch market data: ${response.statusText}`);
      }

      const result = await response.json();
      setMarketData(result.data || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Market data fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch market data");
    } finally {
      setLoading(false);
    }
  }, [portfolio, apiUrl]);

  // Initial fetch when portfolio changes
  useEffect(() => {
    if (portfolio && portfolio.positions.length > 0) {
      fetchMarketData();
    }
  }, [portfolio?.positions.length]);

  // Sort data
  const sortedData = [...marketData].sort((a, b) => {
    let aVal: number | string | null = null;
    let bVal: number | string | null = null;

    switch (sortField) {
      case "ticker":
        aVal = a.ticker;
        bVal = b.ticker;
        break;
      case "changePercent":
        aVal = a.changePercent;
        bVal = b.changePercent;
        break;
      case "return3M":
        aVal = a.return3M;
        bVal = b.return3M;
        break;
      case "return12M":
        aVal = a.return12M;
        bVal = b.return12M;
        break;
      case "peForward":
        aVal = a.peForward;
        bVal = b.peForward;
        break;
      case "evEbitdaForward":
        aVal = a.evEbitdaForward;
        bVal = b.evEbitdaForward;
        break;
      case "upsidePercent":
        aVal = a.upsidePercent;
        bVal = b.upsidePercent;
        break;
    }

    // Handle nulls
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    // Compare
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection === "asc" 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return sortDirection === "asc" 
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  // Handle sort click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Calculate portfolio-level metrics
  const portfolioMetrics = {
    avgChange: marketData.filter(d => d.changePercent !== null).length > 0 
      ? marketData.reduce((sum, d) => sum + (d.changePercent || 0), 0) / marketData.filter(d => d.changePercent !== null).length 
      : null,
    avgReturn3M: marketData.filter(d => d.return3M !== null).length > 0
      ? marketData.reduce((sum, d) => sum + (d.return3M || 0), 0) / marketData.filter(d => d.return3M !== null).length
      : null,
    avgReturn12M: marketData.filter(d => d.return12M !== null).length > 0
      ? marketData.reduce((sum, d) => sum + (d.return12M || 0), 0) / marketData.filter(d => d.return12M !== null).length
      : null,
    avgUpside: marketData.filter(d => d.upsidePercent !== null).length > 0
      ? marketData.reduce((sum, d) => sum + (d.upsidePercent || 0), 0) / marketData.filter(d => d.upsidePercent !== null).length
      : null,
    avgPE: marketData.filter(d => d.peForward !== null).length > 0
      ? marketData.reduce((sum, d) => sum + (d.peForward || 0), 0) / marketData.filter(d => d.peForward !== null).length
      : null,
    avgEVEBITDA: marketData.filter(d => d.evEbitdaForward !== null).length > 0
      ? marketData.reduce((sum, d) => sum + (d.evEbitdaForward || 0), 0) / marketData.filter(d => d.evEbitdaForward !== null).length
      : null,
  };

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1" />
    );
  };

  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">Generate a portfolio to view market data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Market Data Panel
          </h3>
          <p className="text-sm text-muted-foreground">
            Real-time prices, returns, valuations and analyst targets
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchMarketData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-6 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Avg Daily Change</div>
          <p className={cn("text-xl font-bold", getChangeColor(portfolioMetrics.avgChange))}>
            {formatPercent(portfolioMetrics.avgChange)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Avg Return 3M</div>
          <p className={cn("text-xl font-bold", getChangeColor(portfolioMetrics.avgReturn3M))}>
            {formatPercent(portfolioMetrics.avgReturn3M)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Avg Return 12M</div>
          <p className={cn("text-xl font-bold", getChangeColor(portfolioMetrics.avgReturn12M))}>
            {formatPercent(portfolioMetrics.avgReturn12M)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Avg P/E Forward</div>
          <p className="text-xl font-bold">
            {portfolioMetrics.avgPE !== null ? `${formatNumber(portfolioMetrics.avgPE, 1)}x` : "-"}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Avg EV/EBITDA</div>
          <p className="text-xl font-bold">
            {portfolioMetrics.avgEVEBITDA !== null ? `${formatNumber(portfolioMetrics.avgEVEBITDA, 1)}x` : "-"}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Avg Upside</div>
          <p className={cn("text-xl font-bold", getUpsideColor(portfolioMetrics.avgUpside))}>
            {formatPercent(portfolioMetrics.avgUpside)}
          </p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("ticker")}
                >
                  Ticker <SortIcon field="ticker" />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Company
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  Price
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  Prev Close
                </th>
                <th 
                  className="px-4 py-3 text-right text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("changePercent")}
                >
                  Change % <SortIcon field="changePercent" />
                </th>
                <th 
                  className="px-4 py-3 text-right text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("return3M")}
                >
                  Return 3M <SortIcon field="return3M" />
                </th>
                <th 
                  className="px-4 py-3 text-right text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("return12M")}
                >
                  Return 12M <SortIcon field="return12M" />
                </th>
                <th 
                  className="px-4 py-3 text-right text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("peForward")}
                >
                  P/E Fwd <SortIcon field="peForward" />
                </th>
                <th 
                  className="px-4 py-3 text-right text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("evEbitdaForward")}
                >
                  EV/EBITDA <SortIcon field="evEbitdaForward" />
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  Target
                </th>
                <th 
                  className="px-4 py-3 text-right text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("upsidePercent")}
                >
                  Upside % <SortIcon field="upsidePercent" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && marketData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">Loading market data...</p>
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                    No market data available
                  </td>
                </tr>
              ) : (
                sortedData.map((item) => (
                  <tr key={item.ticker} className="hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <span className="font-mono font-medium">{item.ticker}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[150px] truncate">
                      {item.companyName || "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatPrice(item.currentPrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatPrice(item.previousClose)}
                    </td>
                    <td className={cn("px-4 py-3 text-right font-medium", getChangeColor(item.changePercent))}>
                      <span className="flex items-center justify-end gap-1">
                        {item.changePercent !== null && item.changePercent > 0 && (
                          <ArrowUpRight className="w-3 h-3" />
                        )}
                        {item.changePercent !== null && item.changePercent < 0 && (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {formatPercent(item.changePercent)}
                      </span>
                    </td>
                    <td className={cn("px-4 py-3 text-right", getChangeColor(item.return3M))}>
                      {formatPercent(item.return3M)}
                    </td>
                    <td className={cn("px-4 py-3 text-right", getChangeColor(item.return12M))}>
                      {formatPercent(item.return12M)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.peForward !== null ? `${formatNumber(item.peForward, 1)}x` : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.evEbitdaForward !== null ? `${formatNumber(item.evEbitdaForward, 1)}x` : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-medium">{formatPrice(item.priceTargetBase)}</span>
                        {item.priceTargetLow !== null && item.priceTargetHigh !== null && (
                          <span className="text-xs text-muted-foreground">
                            {formatPrice(item.priceTargetLow)} - {formatPrice(item.priceTargetHigh)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={cn("px-4 py-3 text-right font-medium", getUpsideColor(item.upsidePercent))}>
                      {formatPercent(item.upsidePercent)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Source Legend */}
      <div className="flex items-center justify-end gap-4 text-xs text-muted-foreground">
        <span>Data sources: Polygon.io (primary), FMP (fallback)</span>
        <span>•</span>
        <span>Prices may be delayed up to 15 minutes</span>
      </div>
    </div>
  );
}

// ============================================================================
// BACKTEST TAB
// ============================================================================
function BacktestTab({ 
  result, 
  running, 
  onRun,
  comparison,
  scoreType,
  quintile
}: { 
  result: BacktestResult | null;
  running: boolean;
  onRun: () => void;
  comparison: ScoreComparison[];
  scoreType: string;
  quintile: number;
}) {
  return (
    <div className="space-y-6">
      {/* Run Backtest Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Backtest Engine</h3>
          <p className="text-sm text-muted-foreground">
            Run historical backtest for {scoreType.toUpperCase()} Q{quintile} (2015-2024)
          </p>
        </div>
        <button
          onClick={onRun}
          disabled={running}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
          Run Backtest
        </button>
      </div>

      {result && (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="text-sm text-muted-foreground mb-1">Total Return</div>
              <p className={cn(
                "text-3xl font-bold",
                result.metrics.totalReturn > 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {result.metrics.totalReturn > 0 ? "+" : ""}{result.metrics.totalReturn.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                vs SPY: {result.benchmark.totalReturn.toFixed(1)}%
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="text-sm text-muted-foreground mb-1">CAGR</div>
              <p className="text-3xl font-bold text-emerald-400">
                {result.metrics.cagr.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                vs SPY: {result.benchmark.cagr.toFixed(1)}%
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="text-sm text-muted-foreground mb-1">Sharpe Ratio</div>
              <p className={cn(
                "text-3xl font-bold",
                result.metrics.sharpeRatio >= 1 ? "text-emerald-400" : "text-amber-400"
              )}>
                {result.metrics.sharpeRatio.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                vs SPY: {result.benchmark.sharpeRatio.toFixed(2)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="text-sm text-muted-foreground mb-1">Max Drawdown</div>
              <p className="text-3xl font-bold text-red-400">
                {result.metrics.maxDrawdown.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                vs SPY: {result.benchmark.maxDrawdown.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-6 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Alpha</div>
              <p className={cn(
                "text-xl font-bold",
                result.metrics.alpha > 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {result.metrics.alpha > 0 ? "+" : ""}{result.metrics.alpha.toFixed(1)}%
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Beta</div>
              <p className="text-xl font-bold">{result.metrics.beta.toFixed(2)}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Sortino</div>
              <p className="text-xl font-bold text-emerald-400">
                {result.metrics.sortinoRatio.toFixed(2)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Calmar</div>
              <p className="text-xl font-bold">{result.metrics.calmarRatio.toFixed(2)}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Info Ratio</div>
              <p className="text-xl font-bold">{result.metrics.informationRatio.toFixed(2)}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
              <p className="text-xl font-bold">{(result.metrics.winRate * 100).toFixed(0)}%</p>
            </div>
          </div>
        </>
      )}

      {/* Score Comparison Table */}
      {comparison.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-medium">Score Type Comparison (Q{quintile})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Score Type</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Total Return</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">CAGR</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Sharpe</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Sortino</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Max DD</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Alpha</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Beta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {comparison.map((item) => (
                  <tr key={item.scoreType} className={cn(
                    "hover:bg-secondary/30",
                    item.scoreType === scoreType && "bg-primary/10"
                  )}>
                    <td className="px-4 py-3 font-medium capitalize">{item.scoreType}</td>
                    <td className={cn(
                      "px-4 py-3 text-right",
                      item.totalReturn > 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {item.totalReturn > 0 ? "+" : ""}{item.totalReturn.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right">{item.cagr.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right">{item.sharpe.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{item.sortino.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-red-400">{item.maxDrawdown.toFixed(1)}%</td>
                    <td className={cn(
                      "px-4 py-3 text-right",
                      item.alpha > 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {item.alpha > 0 ? "+" : ""}{item.alpha.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right">{item.beta.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ANALYTICS TAB
// ============================================================================
function AnalyticsTab({ 
  result,
  portfolio
}: { 
  result: BacktestResult | null;
  portfolio: GeneratedPortfolio | null;
}) {
  if (!result) {
    return (
      <div className="text-center py-16 bg-card border border-border rounded-lg">
        <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">Run a backtest to view risk analytics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Risk Metrics Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Volatility Analysis */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Volatility Analysis
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Annualized Volatility</span>
                <span className="font-medium">{result.metrics.volatility.toFixed(2)}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-amber-400 h-2 rounded-full" 
                  style={{ width: `${Math.min(result.metrics.volatility / 50 * 100, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Max Drawdown</span>
                <span className="font-medium text-red-400">{result.metrics.maxDrawdown.toFixed(2)}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-red-400 h-2 rounded-full" 
                  style={{ width: `${Math.min(Math.abs(result.metrics.maxDrawdown) / 50 * 100, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Tracking Error</span>
                <span className="font-medium">{result.metrics.trackingError.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Risk-Adjusted Returns */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Scale className="w-5 h-5" />
            Risk-Adjusted Returns
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Sharpe Ratio</span>
                <span className={cn(
                  "font-medium",
                  result.metrics.sharpeRatio >= 1 ? "text-emerald-400" : "text-amber-400"
                )}>
                  {result.metrics.sharpeRatio.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {result.metrics.sharpeRatio >= 1 ? "Excellent" : result.metrics.sharpeRatio >= 0.5 ? "Good" : "Below average"}
              </p>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Sortino Ratio</span>
                <span className="font-medium text-emerald-400">
                  {result.metrics.sortinoRatio.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Downside risk-adjusted return
              </p>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Calmar Ratio</span>
                <span className="font-medium">{result.metrics.calmarRatio.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Return per unit of max drawdown
              </p>
            </div>
          </div>
        </div>

        {/* CAPM Analysis */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            CAPM Analysis
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Alpha (Jensen's)</span>
                <span className={cn(
                  "font-medium",
                  result.metrics.alpha > 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {result.metrics.alpha > 0 ? "+" : ""}{result.metrics.alpha.toFixed(2)}% p.a.
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Excess return above CAPM expected return
              </p>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Beta</span>
                <span className="font-medium">{result.metrics.beta.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {result.metrics.beta > 1 
                  ? "More volatile than market" 
                  : "Less volatile than market"}
              </p>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Information Ratio</span>
                <span className="font-medium">{result.metrics.informationRatio.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Alpha per unit of tracking error
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Interpretation */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="font-medium mb-4">Risk Interpretation</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="p-4 bg-secondary/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              {result.metrics.alpha > 5 ? (
                <Check className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              )}
              <span className="font-medium">Alpha Generation</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {result.metrics.alpha > 5 
                ? `Strong alpha of +${result.metrics.alpha.toFixed(1)}% indicates genuine stock selection skill.`
                : `Moderate alpha of +${result.metrics.alpha.toFixed(1)}% suggests some stock selection value.`}
            </p>
          </div>
          <div className="p-4 bg-secondary/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              {result.metrics.sharpeRatio >= 1 ? (
                <Check className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              )}
              <span className="font-medium">Risk-Adjusted Return</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {result.metrics.sharpeRatio >= 1 
                ? `Excellent Sharpe of ${result.metrics.sharpeRatio.toFixed(2)} indicates strong risk-adjusted performance.`
                : `Sharpe of ${result.metrics.sharpeRatio.toFixed(2)} indicates moderate risk-adjusted performance.`}
            </p>
          </div>
          <div className="p-4 bg-secondary/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              {Math.abs(result.metrics.maxDrawdown) < 25 ? (
                <Check className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400" />
              )}
              <span className="font-medium">Drawdown Risk</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {Math.abs(result.metrics.maxDrawdown) < 25 
                ? `Max drawdown of ${result.metrics.maxDrawdown.toFixed(1)}% is within acceptable range.`
                : `Max drawdown of ${result.metrics.maxDrawdown.toFixed(1)}% indicates significant downside risk.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
