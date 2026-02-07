"use client";
import { useState, useEffect, useCallback } from "react";
import { 
  RefreshCw, 
  Loader2,
  TrendingUp,
  BarChart3,
  PieChart,
  Target,
  Zap,
  Star,
  Award,
  Activity,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelPerformance {
  totalMemos: number;
  performanceByThesisType: Record<string, { count: number; avgInvestability: number; avgQuality: number }>;
  performanceByPortfolioRole: Record<string, { count: number; avgInvestability: number }>;
  performanceByRiskCategory: Record<string, { count: number; avgInvestability: number }>;
}

interface QuintilePerformance {
  totalMemos: number;
  quintilePerformance: {
    quality: Record<number, { count: number; avgInvestability: number; tickers: string[] }>;
    momentum: Record<number, { count: number; avgInvestability: number; tickers: string[] }>;
    turnaround: Record<number, { count: number; avgInvestability: number; tickers: string[] }>;
    piotroski: Record<number, { count: number; avgInvestability: number; tickers: string[] }>;
    composite: Record<number, { count: number; avgInvestability: number; tickers: string[] }>;
  };
}

interface TopOpportunity {
  ticker: string;
  companyName: string;
  investabilityScore: number;
  qualityScore: number;
  qualityQuintile: number;
  compositeScore: number;
  compositeQuintile: number;
  thesisPrimaryType: string;
  portfolioRole: string;
  riskCategory: string;
  catalystType: string;
  catalystStrength: string;
  asymmetryScore: number;
  expectedReturn: number;
  recommendation: string;
  conviction: number;
  memoId: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://159.203.86.246:3001';

const getScoreColor = (score: number, max: number = 100): string => {
  const pct = score / max;
  if (pct >= 0.8) return 'text-green-500';
  if (pct >= 0.6) return 'text-green-400';
  if (pct >= 0.4) return 'text-yellow-500';
  if (pct >= 0.2) return 'text-orange-400';
  return 'text-red-500';
};

const getQuintileColor = (quintile: number): string => {
  if (quintile === 5) return 'bg-green-500';
  if (quintile === 4) return 'bg-green-400';
  if (quintile === 3) return 'bg-yellow-500';
  if (quintile === 2) return 'bg-orange-400';
  return 'bg-red-500';
};

export function LearningLoopInsights() {
  const [modelPerformance, setModelPerformance] = useState<ModelPerformance | null>(null);
  const [quintilePerformance, setQuintilePerformance] = useState<QuintilePerformance | null>(null);
  const [topOpportunities, setTopOpportunities] = useState<TopOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'quintiles' | 'opportunities'>('overview');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [modelRes, quintileRes, opportunitiesRes] = await Promise.all([
        fetch(`${API_BASE}/api/learning-loop/model-performance`),
        fetch(`${API_BASE}/api/learning-loop/quintile-performance`),
        fetch(`${API_BASE}/api/learning-loop/top-opportunities?limit=20&min_investability=60`),
      ]);

      const modelData = await modelRes.json();
      const quintileData = await quintileRes.json();
      const opportunitiesData = await opportunitiesRes.json();

      setModelPerformance(modelData);
      setQuintilePerformance(quintileData);
      setTopOpportunities(opportunitiesData.opportunities || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderOverview = () => {
    if (!modelPerformance) return null;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <BarChart3 className="w-4 h-4" />
              <span className="text-sm">Total Analyzed</span>
            </div>
            <div className="text-2xl font-bold">{modelPerformance.totalMemos}</div>
          </div>
          
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Layers className="w-4 h-4" />
              <span className="text-sm">Thesis Types</span>
            </div>
            <div className="text-2xl font-bold">
              {Object.keys(modelPerformance.performanceByThesisType).length}
            </div>
          </div>
          
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Activity className="w-4 h-4" />
              <span className="text-sm">Risk Categories</span>
            </div>
            <div className="text-2xl font-bold">
              {Object.keys(modelPerformance.performanceByRiskCategory).length}
            </div>
          </div>
        </div>

        {/* Performance by Portfolio Role */}
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Investability by Portfolio Role
          </h3>
          <div className="space-y-4">
            {Object.entries(modelPerformance.performanceByPortfolioRole)
              .sort((a, b) => b[1].avgInvestability - a[1].avgInvestability)
              .map(([role, data]) => (
                <div key={role} className="flex items-center gap-4">
                  <div className="w-32 text-sm capitalize">{role.replace('_', ' ')}</div>
                  <div className="flex-1">
                    <div className="h-8 bg-muted rounded-full overflow-hidden relative">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${data.avgInvestability}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-medium">
                        {data.avgInvestability.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm text-muted-foreground">
                    {data.count} memos
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Performance by Risk Category */}
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Investability by Risk Category
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(modelPerformance.performanceByRiskCategory)
              .sort((a, b) => b[1].avgInvestability - a[1].avgInvestability)
              .map(([category, data]) => (
                <div key={category} className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium capitalize">{category}</span>
                    <span className="text-xs text-muted-foreground">{data.count} memos</span>
                  </div>
                  <div className={cn("text-2xl font-bold", getScoreColor(data.avgInvestability))}>
                    {data.avgInvestability.toFixed(1)}
                  </div>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full", 
                        data.avgInvestability >= 65 ? 'bg-green-500' :
                        data.avgInvestability >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      )}
                      style={{ width: `${data.avgInvestability}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  };

  const renderQuintiles = () => {
    if (!quintilePerformance) return null;

    const scores = ['quality', 'momentum', 'turnaround', 'piotroski', 'composite'] as const;
    const scoreLabels = {
      quality: 'Quality Score',
      momentum: 'Momentum Score',
      turnaround: 'Turnaround Score',
      piotroski: 'Piotroski F-Score',
      composite: 'Composite Score',
    };

    return (
      <div className="space-y-6">
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Star className="w-5 h-5" />
            Investability Score by Quintile
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            This analysis shows which factors are most predictive of high investability.
            Higher scores in Q5 indicate stronger predictive power.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium">Score</th>
                  <th className="px-4 py-3 text-center font-medium">Q1 (Worst)</th>
                  <th className="px-4 py-3 text-center font-medium">Q2</th>
                  <th className="px-4 py-3 text-center font-medium">Q3</th>
                  <th className="px-4 py-3 text-center font-medium">Q4</th>
                  <th className="px-4 py-3 text-center font-medium">Q5 (Best)</th>
                  <th className="px-4 py-3 text-center font-medium">Spread (Q5-Q1)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {scores.map((score) => {
                  const data = quintilePerformance.quintilePerformance[score];
                  const q1 = data[1]?.avgInvestability || 0;
                  const q5 = data[5]?.avgInvestability || 0;
                  const spread = q5 - q1;

                  return (
                    <tr key={score} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{scoreLabels[score]}</td>
                      {[1, 2, 3, 4, 5].map((q) => (
                        <td key={q} className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center">
                            <span className={cn("font-medium", getScoreColor(data[q]?.avgInvestability || 0))}>
                              {(data[q]?.avgInvestability || 0).toFixed(1)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({data[q]?.count || 0})
                            </span>
                          </div>
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          "font-bold",
                          spread > 5 ? 'text-green-500' :
                          spread > 0 ? 'text-yellow-500' : 'text-red-500'
                        )}>
                          {spread >= 0 ? '+' : ''}{spread.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quintile Distribution Visualization */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scores.slice(0, 3).map((score) => {
            const data = quintilePerformance.quintilePerformance[score];
            return (
              <div key={score} className="bg-card rounded-lg border p-4">
                <h4 className="text-sm font-medium mb-3">{scoreLabels[score]}</h4>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((q) => (
                    <div key={q} className="flex items-center gap-2">
                      <span className="w-8 text-xs text-muted-foreground">Q{q}</span>
                      <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                        <div 
                          className={cn("h-full", getQuintileColor(q))}
                          style={{ width: `${data[q]?.avgInvestability || 0}%` }}
                        />
                      </div>
                      <span className="w-12 text-xs text-right">
                        {(data[q]?.avgInvestability || 0).toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderOpportunities = () => {
    return (
      <div className="space-y-6">
        <div className="bg-card rounded-lg border p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Award className="w-5 h-5" />
            Top Investment Opportunities
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Ranked by Investability Score (minimum 60). These represent the best risk-adjusted opportunities in the universe.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium">#</th>
                  <th className="px-4 py-3 text-left font-medium">Ticker</th>
                  <th className="px-4 py-3 text-left font-medium">Company</th>
                  <th className="px-4 py-3 text-right font-medium">Investability</th>
                  <th className="px-4 py-3 text-right font-medium">Quality</th>
                  <th className="px-4 py-3 text-right font-medium">Composite</th>
                  <th className="px-4 py-3 text-center font-medium">Role</th>
                  <th className="px-4 py-3 text-center font-medium">Risk</th>
                  <th className="px-4 py-3 text-right font-medium">Exp. Return</th>
                  <th className="px-4 py-3 text-center font-medium">Conviction</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topOpportunities.map((opp, index) => (
                  <tr key={opp.memoId} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                    <td className="px-4 py-3 font-medium">{opp.ticker}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[150px] truncate">
                      {opp.companyName}
                    </td>
                    <td className={cn("px-4 py-3 text-right font-bold", getScoreColor(opp.investabilityScore))}>
                      {opp.investabilityScore.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span>{opp.qualityScore.toFixed(1)}</span>
                      <span className={cn("ml-1 text-xs", 
                        opp.qualityQuintile === 5 ? 'text-green-500' : 'text-muted-foreground'
                      )}>
                        Q{opp.qualityQuintile}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span>{opp.compositeScore.toFixed(1)}</span>
                      <span className={cn("ml-1 text-xs", 
                        opp.compositeQuintile === 5 ? 'text-green-500' : 'text-muted-foreground'
                      )}>
                        Q{opp.compositeQuintile}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full capitalize",
                        opp.portfolioRole === 'core' ? 'bg-blue-500/20 text-blue-500' :
                        opp.portfolioRole === 'opportunistic' ? 'bg-purple-500/20 text-purple-500' :
                        'bg-gray-500/20 text-gray-500'
                      )}>
                        {opp.portfolioRole?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs capitalize">{opp.riskCategory}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={opp.expectedReturn >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {opp.expectedReturn >= 0 ? '+' : ''}{opp.expectedReturn.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center">
                        <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${opp.conviction}%` }}
                          />
                        </div>
                        <span className="ml-2 text-xs">{opp.conviction}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === 'overview' ? 'bg-background shadow' : 'hover:bg-background/50'
            )}
          >
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4" />
              Overview
            </div>
          </button>
          <button
            onClick={() => setActiveTab('quintiles')}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === 'quintiles' ? 'bg-background shadow' : 'hover:bg-background/50'
            )}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Quintile Analysis
            </div>
          </button>
          <button
            onClick={() => setActiveTab('opportunities')}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === 'opportunities' ? 'bg-background shadow' : 'hover:bg-background/50'
            )}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Top Opportunities
            </div>
          </button>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4 text-destructive">
          Error: {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'quintiles' && renderQuintiles()}
          {activeTab === 'opportunities' && renderOpportunities()}
        </>
      )}
    </div>
  );
}
