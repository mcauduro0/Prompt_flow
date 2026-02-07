"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Search,
  RefreshCw, 
  Loader2,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Star,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart3,
  PieChart,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Briefcase,
  Shield,
  Rocket,
  Eye,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface DecisionMemo {
  id: string;
  ticker: string;
  company_name: string;
  thesis_primary_type: string | null;
  thesis_time_horizon_months: number | null;
  thesis_style_vector: {
    quality_exposure: number;
    cyclicality_exposure: number;
    structural_risk_exposure: number;
    macro_dependency: number;
    execution_dependency: number;
  } | null;
  investability_score_standalone: number | null;
  quality_score: number | null;
  momentum_score: number | null;
  turnaround_score: number | null;
  piotroski_score: number | null;
  composite_score: number | null;
  conviction: number | null;
  quality_score_quintile: number | null;
  momentum_score_quintile: number | null;
  turnaround_score_quintile: number | null;
  piotroski_score_quintile: number | null;
  composite_score_quintile: number | null;
  asymmetry_score: number | null;
  expected_return_probability_weighted_pct: number | null;
  base_case_upside_pct: number | null;
  bull_case_upside_pct: number | null;
  bear_case_downside_pct: number | null;
  risk_primary_category: string | null;
  industry_structure: string | null;
  catalyst_type: string | null;
  catalyst_strength: string | null;
  catalyst_clarity_score: number | null;
  portfolio_role: string | null;
  suggested_position_size_min_pct: number | null;
  suggested_position_size_max_pct: number | null;
  recommendation: string | null;
  style_tag: string | null;
  // V3 Fields
  moat_strength_score: number | null;
  moat_durability_score: number | null;
  roic_durability_score: number | null;
  capital_efficiency_classification: string | null;
  thesis_cluster_id: number | null;
  thesis_cluster_label: string | null;
  early_warning_indicators: string[] | null;
  created_at: string;
  completed_at: string | null;
  schema_version: string | null;
}

interface DashboardStats {
  total_memos: number;
  averages: {
    investability_score: number;
    asymmetry_score: number;
    quality_score: number;
  };
  distributions: {
    thesis_type: Record<string, number>;
    portfolio_role: Record<string, number>;
    risk_category: Record<string, number>;
    catalyst_type: Record<string, number>;
    cluster?: Record<string, number>;
    capital_efficiency?: Record<string, number>;
  };
  v3_averages?: {
    moat_strength: number;
    moat_durability: number;
    roic_durability: number;
  };
}

type SortField = 'ticker' | 'investabilityScoreStandalone' | 'qualityScore' | 'compositeScore' | 'asymmetryScore' | 'expectedReturnProbabilityWeightedPct' | 'moatStrengthScore';
type SortDirection = 'asc' | 'desc';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://159.203.86.246:3001';

// Utility functions
const formatNumber = (value: number | null, decimals: number = 1): string => {
  if (value === null || value === undefined) return '-';
  return Number(value).toFixed(decimals);
};

const formatPercent = (value: number | null): string => {
  if (value === null || value === undefined) return '-';
  return `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(1)}%`;
};

const getScoreColor = (score: number | null, midpoint: number = 50): string => {
  if (score === null) return 'text-muted-foreground';
  if (Number(score) >= midpoint + 20) return 'text-green-500';
  if (Number(score) >= midpoint) return 'text-lime-500';
  if (Number(score) >= midpoint - 15) return 'text-yellow-500';
  return 'text-red-500';
};

const getQuintileColor = (quintile: number | null): string => {
  if (quintile === null) return 'text-muted-foreground';
  switch (quintile) {
    case 5: return 'text-green-400';
    case 4: return 'text-lime-400';
    case 3: return 'text-emerald-400 font-bold';
    case 2: return 'text-orange-400';
    case 1: return 'text-red-400';
    default: return 'text-muted-foreground';
  }
};

const getMoatColor = (score: number | null): string => {
  if (score === null) return 'text-muted-foreground';
  const s = Number(score);
  if (s >= 7) return 'text-green-400';
  if (s >= 5) return 'text-lime-400';
  if (s >= 3) return 'text-yellow-400';
  return 'text-red-400';
};

const getClusterColor = (clusterId: number | null): string => {
  if (clusterId === null) return 'bg-muted text-muted-foreground';
  const colors = [
    'bg-blue-500/20 text-blue-400',
    'bg-purple-500/20 text-purple-400',
    'bg-green-500/20 text-green-400',
    'bg-orange-500/20 text-orange-400',
    'bg-pink-500/20 text-pink-400',
    'bg-cyan-500/20 text-cyan-400',
    'bg-yellow-500/20 text-yellow-400',
    'bg-red-500/20 text-red-400',
    'bg-indigo-500/20 text-indigo-400',
    'bg-teal-500/20 text-teal-400',
    'bg-amber-500/20 text-amber-400',
    'bg-emerald-500/20 text-emerald-400',
  ];
  return colors[clusterId % colors.length];
};

const getPortfolioRoleIcon = (role: string | null) => {
  switch (role) {
    case 'core': return <Briefcase className="w-4 h-4 text-blue-500" />;
    case 'opportunistic': return <Rocket className="w-4 h-4 text-purple-500" />;
    case 'monitor_only': return <Eye className="w-4 h-4 text-gray-400" />;
    default: return null;
  }
};

const getRiskCategoryIcon = (category: string | null) => {
  switch (category) {
    case 'macro': return <Activity className="w-4 h-4 text-blue-500" />;
    case 'execution': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    case 'structural': return <Shield className="w-4 h-4 text-red-500" />;
    case 'cyclical': return <TrendingUp className="w-4 h-4 text-yellow-500" />;
    case 'regulatory': return <CheckCircle2 className="w-4 h-4 text-purple-500" />;
    case 'financial': return <BarChart3 className="w-4 h-4 text-green-500" />;
    default: return null;
  }
};

export function DecisionDashboard() {
  const [memos, setMemos] = useState<DecisionMemo[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [portfolioRoleFilter, setPortfolioRoleFilter] = useState<string>('all');
  const [riskCategoryFilter, setRiskCategoryFilter] = useState<string>('all');
  const [clusterFilter, setClusterFilter] = useState<string>('all');
  const [minInvestability, setMinInvestability] = useState<number>(0);
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('investabilityScoreStandalone');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const memosUrl = new URL(`${API_BASE}/api/ic-memos/decision-dashboard`);
      memosUrl.searchParams.set('limit', limit.toString());
      memosUrl.searchParams.set('offset', ((page - 1) * limit).toString());
      memosUrl.searchParams.set('sort_by', sortField);
      memosUrl.searchParams.set('sort_order', sortDirection);
      if (portfolioRoleFilter !== 'all') {
        memosUrl.searchParams.set('portfolio_role', portfolioRoleFilter);
      }
      if (riskCategoryFilter !== 'all') {
        memosUrl.searchParams.set('risk_category', riskCategoryFilter);
      }
      if (minInvestability > 0) {
        memosUrl.searchParams.set('min_investability', minInvestability.toString());
      }
      
      const memosRes = await fetch(memosUrl.toString());
      const memosData = await memosRes.json();
      
      const statsRes = await fetch(`${API_BASE}/api/ic-memos/decision-dashboard/stats`);
      const statsData = await statsRes.json();
      
      setMemos(memosData.data || []);
      setStats(statsData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, sortField, sortDirection, portfolioRoleFilter, riskCategoryFilter, minInvestability]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get unique clusters from memos
  const uniqueClusters = useMemo(() => {
    const clusters = new Map<number, string>();
    memos.forEach(m => {
      if (m.thesis_cluster_id !== null && m.thesis_cluster_label) {
        clusters.set(m.thesis_cluster_id, m.thesis_cluster_label);
      }
    });
    return Array.from(clusters.entries()).sort((a, b) => a[0] - b[0]);
  }, [memos]);

  // Filter memos
  const filteredMemos = useMemo(() => {
    let result = memos;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(m => 
        m.ticker.toLowerCase().includes(query) ||
        (m.company_name && m.company_name.toLowerCase().includes(query))
      );
    }
    if (clusterFilter !== 'all') {
      result = result.filter(m => String(m.thesis_cluster_id) === clusterFilter);
    }
    return result;
  }, [memos, searchQuery, clusterFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <BarChart3 className="w-4 h-4" />
              <span className="text-sm">Total Memos</span>
            </div>
            <div className="text-2xl font-bold">{stats.total_memos}</div>
          </div>
          
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Target className="w-4 h-4" />
              <span className="text-sm">Avg Investability</span>
            </div>
            <div className={cn("text-2xl font-bold", getScoreColor(stats.averages.investability_score))}>
              {formatNumber(stats.averages.investability_score)}
            </div>
          </div>
          
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Star className="w-4 h-4" />
              <span className="text-sm">Avg Quality</span>
            </div>
            <div className={cn("text-2xl font-bold", getScoreColor(stats.averages.quality_score))}>
              {formatNumber(stats.averages.quality_score)}
            </div>
          </div>

          {/* V3 Stats - Moat */}
          <div className="bg-card rounded-lg border p-4 ring-1 ring-amber-500/20">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <span className="text-sm">Avg Moat</span>
              <span className="text-[10px] px-1 py-0.5 bg-amber-500/20 text-amber-400 rounded">V3</span>
            </div>
            <div className={cn("text-2xl font-bold", getMoatColor(stats.v3_averages?.moat_strength || null))}>
              {formatNumber(stats.v3_averages?.moat_strength || null)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Durability: {formatNumber(stats.v3_averages?.moat_durability || null)}
            </div>
          </div>

          {/* ROIC Durability */}
          <div className="bg-card rounded-lg border p-4 ring-1 ring-cyan-500/20">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span className="text-sm">Avg ROIC Dur.</span>
              <span className="text-[10px] px-1 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">V3</span>
            </div>
            <div className={cn("text-2xl font-bold", getMoatColor(stats.v3_averages?.roic_durability || null))}>
              {formatNumber(stats.v3_averages?.roic_durability || null)}
            </div>
          </div>

          {/* Clusters */}
          <div className="bg-card rounded-lg border p-4 ring-1 ring-purple-500/20">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span className="text-sm">Clusters</span>
              <span className="text-[10px] px-1 py-0.5 bg-purple-500/20 text-purple-400 rounded">V3</span>
            </div>
            <div className="text-2xl font-bold">
              {stats.distributions.cluster ? Object.keys(stats.distributions.cluster).length : 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Thematic groups</div>
          </div>
        </div>
      )}

      {/* Cluster Distribution - NEW */}
      {stats?.distributions?.cluster && Object.keys(stats.distributions.cluster).length > 0 && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            Thesis Cluster Distribution
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.distributions.cluster)
              .sort(([, a], [, b]) => b - a)
              .map(([label, count], idx) => (
                <button
                  key={label}
                  onClick={() => setClusterFilter(clusterFilter === String(idx) ? 'all' : String(idx))}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full transition-colors",
                    getClusterColor(idx),
                    clusterFilter === String(idx) && "ring-2 ring-white/50"
                  )}
                >
                  {label} ({count})
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap bg-card rounded-lg border p-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search ticker or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-muted rounded-lg border-none focus:ring-2 focus:ring-primary"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={portfolioRoleFilter}
            onChange={(e) => { setPortfolioRoleFilter(e.target.value); setPage(1); }}
            className="text-sm bg-muted rounded-lg px-3 py-2 border-none"
          >
            <option value="all">All Roles</option>
            <option value="core">Core</option>
            <option value="opportunistic">Opportunistic</option>
            <option value="tactical">Tactical</option>
            <option value="monitor_only">Monitor Only</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <select
            value={riskCategoryFilter}
            onChange={(e) => { setRiskCategoryFilter(e.target.value); setPage(1); }}
            className="text-sm bg-muted rounded-lg px-3 py-2 border-none"
          >
            <option value="all">All Risk Categories</option>
            <option value="macro">Macro</option>
            <option value="execution">Execution</option>
            <option value="structural">Structural</option>
            <option value="cyclical">Cyclical</option>
            <option value="regulatory">Regulatory</option>
            <option value="financial">Financial</option>
          </select>
        </div>

        {/* Cluster Filter - NEW */}
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <select
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
            className="text-sm bg-muted rounded-lg px-3 py-2 border-none"
          >
            <option value="all">All Clusters</option>
            {uniqueClusters.map(([id, label]) => (
              <option key={id} value={String(id)}>C{id}: {label}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Min Invest:</span>
          <input
            type="range"
            min="0"
            max="100"
            value={minInvestability}
            onChange={(e) => { setMinInvestability(Number(e.target.value)); setPage(1); }}
            className="w-24"
          />
          <span className="text-sm font-mono">{minInvestability}</span>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-500 text-sm">
          Error: {error}
        </div>
      )}

      {/* Main Table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('ticker')} className="flex items-center gap-1 hover:text-foreground">
                    Ticker <SortIcon field="ticker" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-center">Role</th>
                <th className="px-4 py-3 text-center">Risk</th>
                <th className="px-4 py-3 text-right">
                  <button onClick={() => handleSort('investabilityScoreStandalone')} className="flex items-center gap-1 hover:text-foreground justify-end w-full">
                    Invest. <SortIcon field="investabilityScoreStandalone" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button onClick={() => handleSort('qualityScore')} className="flex items-center gap-1 hover:text-foreground justify-end w-full">
                    Quality <SortIcon field="qualityScore" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button onClick={() => handleSort('compositeScore')} className="flex items-center gap-1 hover:text-foreground justify-end w-full">
                    Composite <SortIcon field="compositeScore" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right bg-amber-500/5">
                  <button onClick={() => handleSort('moatStrengthScore')} className="flex items-center gap-1 hover:text-foreground justify-end w-full">
                    <Shield className="w-3 h-3 text-amber-400" />
                    Moat <SortIcon field="moatStrengthScore" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button onClick={() => handleSort('asymmetryScore')} className="flex items-center gap-1 hover:text-foreground justify-end w-full">
                    Asymm. <SortIcon field="asymmetryScore" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button onClick={() => handleSort('expectedReturnProbabilityWeightedPct')} className="flex items-center gap-1 hover:text-foreground justify-end w-full">
                    E[R] <SortIcon field="expectedReturnProbabilityWeightedPct" />
                  </button>
                </th>
                <th className="px-4 py-3 text-center">Quintiles</th>
                <th className="px-4 py-3 text-center">Cluster</th>
                <th className="px-4 py-3 text-center">Catalyst</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : filteredMemos.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-muted-foreground">
                    No memos found matching filters
                  </td>
                </tr>
              ) : (
                filteredMemos.map((memo) => (
                  <tr key={memo.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold">{memo.ticker}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {memo.company_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {getPortfolioRoleIcon(memo.portfolio_role)}
                        <span className="text-xs capitalize">{memo.portfolio_role?.replace('_', ' ') || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {getRiskCategoryIcon(memo.risk_primary_category)}
                        <span className="text-xs capitalize">{memo.risk_primary_category || '-'}</span>
                      </div>
                    </td>
                    <td className={cn("px-4 py-3 text-right font-medium", getScoreColor(memo.investability_score_standalone))}>
                      {formatNumber(memo.investability_score_standalone)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span>{formatNumber(memo.quality_score)}</span>
                        <span className={cn("text-xs", getQuintileColor(memo.quality_score_quintile))}>
                          Q{memo.quality_score_quintile || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span>{formatNumber(memo.composite_score)}</span>
                        <span className={cn("text-xs", getQuintileColor(memo.composite_score_quintile))}>
                          Q{memo.composite_score_quintile || '-'}
                        </span>
                      </div>
                    </td>
                    {/* Moat - NEW */}
                    <td className="px-4 py-3 text-right bg-amber-500/5">
                      <div className="flex items-center justify-end gap-1">
                        <span className={cn("font-medium", getMoatColor(memo.moat_strength_score))}>
                          {formatNumber(memo.moat_strength_score)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          /{formatNumber(memo.moat_durability_score, 0)}
                        </span>
                      </div>
                    </td>
                    <td className={cn("px-4 py-3 text-right", getScoreColor(memo.asymmetry_score, 50))}>
                      {formatNumber(memo.asymmetry_score)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={memo.expected_return_probability_weighted_pct && Number(memo.expected_return_probability_weighted_pct) >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {formatPercent(memo.expected_return_probability_weighted_pct)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1 text-xs">
                        <span className={getQuintileColor(memo.quality_score_quintile)}>Q{memo.quality_score_quintile || '-'}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className={getQuintileColor(memo.momentum_score_quintile)}>M{memo.momentum_score_quintile || '-'}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className={getQuintileColor(memo.piotroski_score_quintile)}>P{memo.piotroski_score_quintile || '-'}</span>
                      </div>
                    </td>
                    {/* Cluster - NEW */}
                    <td className="px-4 py-3 text-center">
                      {memo.thesis_cluster_label ? (
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap",
                          getClusterColor(memo.thesis_cluster_id)
                        )}>
                          {memo.thesis_cluster_label.length > 18 
                            ? memo.thesis_cluster_label.substring(0, 18) + '...' 
                            : memo.thesis_cluster_label}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          memo.catalyst_strength === 'strong' ? 'bg-green-500/20 text-green-500' :
                          memo.catalyst_strength === 'medium' ? 'bg-yellow-500/20 text-yellow-500' :
                          'bg-gray-500/20 text-gray-500'
                        )}>
                          {memo.catalyst_type || '-'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Showing {filteredMemos.length} of {stats?.total_memos || 0} memos
          {clusterFilter !== 'all' && ' (cluster filtered)'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded-md text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={filteredMemos.length < limit}
            className="px-3 py-1 border rounded-md text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
