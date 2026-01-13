"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { TrendingUp, TrendingDown, DollarSign, PieChart, AlertTriangle, Shield, Target, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function PortfolioPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [breakdown, setBreakdown] = useState<{ by_sector: Record<string, number>; by_style: Record<string, number> } | null>(null);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'positions' | 'risk'>('overview');

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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
                {positions.length} positions
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Portfolio construction, risk analysis, and performance tracking
            </p>
          </div>

          {/* Tabs */}
          <div className="px-8 pb-4">
            <div className="flex items-center gap-1">
              {(['overview', 'positions', 'risk'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2 text-sm rounded-md transition-calm capitalize",
                    activeTab === tab
                      ? "bg-secondary text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 py-8">
          <div className="max-w-6xl mx-auto px-8">
            {activeTab === 'overview' && (
              <OverviewTab 
                summary={summary} 
                breakdown={breakdown} 
                positions={positions}
                alerts={alerts}
              />
            )}
            {activeTab === 'positions' && (
              <PositionsTab positions={positions} />
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

interface OverviewTabProps {
  summary: PortfolioSummary | null;
  breakdown: { by_sector: Record<string, number>; by_style: Record<string, number> } | null;
  positions: Position[];
  alerts: RiskAlert[];
}

function OverviewTab({ summary, breakdown, positions, alerts }: OverviewTabProps) {
  if (!summary || positions.length === 0) {
    return (
      <div className="text-center py-16">
        <PieChart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">No portfolio positions yet.</p>
        <p className="text-sm text-muted-foreground/60 mt-2">
          Complete Lane B research and add positions to build your portfolio.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Total Value</span>
          </div>
          <p className="text-2xl font-medium text-foreground">
            ${summary.total_value.toLocaleString()}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            {summary.total_pnl >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className="text-sm">Total P&L</span>
          </div>
          <p className={cn(
            "text-2xl font-medium",
            summary.total_pnl >= 0 ? "text-emerald-400" : "text-red-400"
          )}>
            {summary.total_pnl >= 0 ? '+' : ''}{summary.total_pnl_percent.toFixed(2)}%
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Target className="w-4 h-4" />
            <span className="text-sm">Avg Conviction</span>
          </div>
          <p className="text-2xl font-medium text-foreground">
            {summary.avg_conviction.toFixed(1)}/10
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-sm">Cash</span>
          </div>
          <p className="text-2xl font-medium text-foreground">
            {summary.cash_percent.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div 
              key={i}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg",
                alert.level === 'warning' && "bg-amber-500/10 border border-amber-500/20",
                alert.level === 'info' && "bg-blue-500/10 border border-blue-500/20"
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
      )}

      {/* Style breakdown */}
      {breakdown && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Style Allocation</h3>
            <div className="space-y-3">
              {Object.entries(breakdown.by_style).map(([style, count]) => {
                const weight = positions
                  .filter(p => p.style === style)
                  .reduce((sum, p) => sum + p.weight_percent, 0);
                return (
                  <div key={style} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn("px-2 py-0.5 rounded text-xs", styleColors[style])}>
                        {styleLabels[style] || style}
                      </span>
                      <span className="text-sm text-muted-foreground">{count} positions</span>
                    </div>
                    <span className="text-sm font-medium text-foreground">{weight.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Top Positions</h3>
            <div className="space-y-3">
              {positions.slice(0, 5).map((pos) => (
                <div key={pos.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-foreground">{pos.ticker}</span>
                    <span className="text-xs text-muted-foreground">{pos.company_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-sm",
                      pos.pnl_percent >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {pos.pnl_percent >= 0 ? '+' : ''}{pos.pnl_percent.toFixed(1)}%
                    </span>
                    <span className="text-sm text-muted-foreground">{pos.weight_percent.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PositionsTabProps {
  positions: Position[];
}

function PositionsTab({ positions }: PositionsTabProps) {
  if (positions.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">No positions in portfolio.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 gap-4 px-4 py-3 bg-secondary/30 border-b border-border text-sm font-medium text-muted-foreground">
        <div className="col-span-2">Position</div>
        <div>Weight</div>
        <div>P&L</div>
        <div>Conviction</div>
        <div>Style</div>
        <div>Entry Date</div>
      </div>

      <div className="divide-y divide-border/50">
        {positions.map((pos) => (
          <div key={pos.id} className="grid grid-cols-7 gap-4 px-4 py-3 text-sm hover:bg-secondary/10">
            <div className="col-span-2">
              <span className="font-mono font-medium text-foreground">{pos.ticker}</span>
              <span className="text-muted-foreground ml-2">{pos.company_name}</span>
            </div>
            <div className="text-foreground">{pos.weight_percent.toFixed(1)}%</div>
            <div className={cn(
              pos.pnl_percent >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {pos.pnl_percent >= 0 ? '+' : ''}{pos.pnl_percent.toFixed(2)}%
            </div>
            <div className={cn(
              pos.conviction >= 8 ? "text-emerald-400" :
              pos.conviction >= 6 ? "text-amber-400" : "text-muted-foreground"
            )}>
              {pos.conviction}/10
            </div>
            <div>
              <span className={cn("px-2 py-0.5 rounded text-xs", styleColors[pos.style])}>
                {styleLabels[pos.style] || pos.style}
              </span>
            </div>
            <div className="text-muted-foreground">
              {new Date(pos.entry_date).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface RiskTabProps {
  metrics: RiskMetrics | null;
  alerts: RiskAlert[];
  positions: Position[];
}

function RiskTab({ metrics, alerts, positions }: RiskTabProps) {
  if (!metrics) {
    return (
      <div className="text-center py-16">
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
    </div>
  );
}
