"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Eye,
  Filter,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
  Star,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Shield,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout/AppLayout";

// Types
interface ICMemo {
  id: string;
  ticker: string;
  company_name: string | null;
  style_tag: string | null;
  status: "pending" | "generating" | "complete" | "failed";
  progress: number;
  recommendation: string | null;
  conviction: number | null;
  // Quality Score (14 factors)
  quality_score: number | null;
  quality_score_quintile: number | null;
  // Momentum Score (inverted momentum signals)
  momentum_score: number | null;
  momentum_score_quintile: number | null;
  // Turnaround Score (improvement signals)
  turnaround_score: number | null;
  turnaround_score_quintile: number | null;
  // Piotroski F-Score (0-9)
  piotroski_score: number | null;
  piotroski_score_quintile: number | null;
  // Composite Score (equal weights)
  composite_score: number | null;
  composite_score_quintile: number | null;
  // V3 Fields - Moat & Cluster
  moat_strength_score: number | null;
  moat_durability_score: number | null;
  roic_durability_score: number | null;
  capital_efficiency_classification: string | null;
  thesis_cluster_id: number | null;
  thesis_cluster_label: string | null;
  early_warning_indicators: string[] | null;
  // Legacy fields
  score_v4: number | null;
  score_v4_quintile: string | null;
  score_v4_recommendation: string | null;
  approved_at: string | null;
  created_at: string;
  completed_at: string | null;
  has_content: boolean;
}

interface ICMemoStats {
  total: number;
  by_status: {
    pending?: number;
    generating?: number;
    complete?: number;
    failed?: number;
  };
}

type SortField = 'ticker' | 'company_name' | 'style_tag' | 'status' | 'quality_score' | 'momentum_score' | 'turnaround_score' | 'piotroski_score' | 'composite_score' | 'moat_strength_score' | 'approved_at';
type SortDirection = 'asc' | 'desc';

const statusConfig = {
  pending: { 
    icon: Clock, 
    label: "Pending", 
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10"
  },
  generating: { 
    icon: Loader2, 
    label: "Generating", 
    color: "text-blue-500",
    bgColor: "bg-blue-500/10"
  },
  complete: { 
    icon: CheckCircle, 
    label: "Complete", 
    color: "text-green-500",
    bgColor: "bg-green-500/10"
  },
  failed: { 
    icon: XCircle, 
    label: "Failed", 
    color: "text-red-500",
    bgColor: "bg-red-500/10"
  },
};

// Quintile colors - Q3 is the sweet spot (based on backtest)
const getQuintileColor = (quintile: number | null): string => {
  if (quintile === null) return "text-muted-foreground bg-muted";
  switch (quintile) {
    case 5: return "text-green-400 bg-green-500/20";
    case 4: return "text-lime-400 bg-lime-500/15";
    case 3: return "text-emerald-400 bg-emerald-500/25 ring-1 ring-emerald-400"; // Sweet spot!
    case 2: return "text-orange-400 bg-orange-500/15";
    case 1: return "text-red-400 bg-red-500/15";
    default: return "text-muted-foreground bg-muted";
  }
};

// Score color based on value (0-100 scale)
const getScoreColor = (score: number | null): string => {
  if (score === null) return "text-muted-foreground";
  if (score >= 70) return "text-green-400";
  if (score >= 55) return "text-lime-400";
  if (score >= 45) return "text-yellow-400";
  if (score >= 35) return "text-orange-400";
  return "text-red-400";
};

// Piotroski color (0-9 scale)
const getPiotroskiColor = (score: number | null): string => {
  if (score === null) return "text-muted-foreground";
  if (score >= 7) return "text-green-400";
  if (score >= 5) return "text-yellow-400";
  if (score >= 3) return "text-orange-400";
  return "text-red-400";
};

// Moat color (0-10 scale)
const getMoatColor = (score: number | null): string => {
  if (score === null) return "text-muted-foreground";
  if (score >= 7) return "text-green-400";
  if (score >= 5) return "text-lime-400";
  if (score >= 3) return "text-yellow-400";
  return "text-red-400";
};

// Cluster badge colors
const getClusterColor = (clusterId: number | null): string => {
  if (clusterId === null) return "bg-muted text-muted-foreground";
  const colors = [
    "bg-blue-500/20 text-blue-400",
    "bg-purple-500/20 text-purple-400",
    "bg-green-500/20 text-green-400",
    "bg-orange-500/20 text-orange-400",
    "bg-pink-500/20 text-pink-400",
    "bg-cyan-500/20 text-cyan-400",
    "bg-yellow-500/20 text-yellow-400",
    "bg-red-500/20 text-red-400",
    "bg-indigo-500/20 text-indigo-400",
    "bg-teal-500/20 text-teal-400",
    "bg-amber-500/20 text-amber-400",
    "bg-emerald-500/20 text-emerald-400",
  ];
  return colors[clusterId % colors.length];
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Check if ticker is a fund/ETF
const isFundOrETF = (memo: ICMemo): boolean => {
  const fundPatterns = ['ETF', 'FUND', 'INDEX', 'TRUST'];
  const companyName = memo.company_name?.toUpperCase() || '';
  const styleTag = memo.style_tag?.toUpperCase() || '';
  
  return fundPatterns.some(pattern => 
    companyName.includes(pattern) || styleTag.includes(pattern)
  );
};

export default function ICMemoPage() {
  const [memos, setMemos] = useState<ICMemo[]>([]);
  const [stats, setStats] = useState<ICMemoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggeringRun, setTriggeringRun] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [clusterFilter, setClusterFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>('quality_score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const fetchData = useCallback(async () => {
    try {
      const [memosRes, statsRes] = await Promise.all([
        fetch("/api/ic-memos?limit=1000"),
        fetch("/api/ic-memos/stats"),
      ]);

      if (memosRes.ok) {
        const memosData = await memosRes.json();
        setMemos(memosData);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error("Error fetching IC memos:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleTriggerRun = async () => {
    setTriggeringRun(true);
    try {
      const res = await fetch("/api/ic-memos/trigger-run", { method: "POST" });
      if (res.ok) {
        setTimeout(fetchData, 2000);
      }
    } catch (error) {
      console.error("Error triggering run:", error);
    } finally {
      setTriggeringRun(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  // Get unique clusters for filter
  const uniqueClusters = useMemo(() => {
    const clusters = new Map<number, string>();
    memos.forEach(m => {
      if (m.thesis_cluster_id !== null && m.thesis_cluster_label) {
        clusters.set(m.thesis_cluster_id, m.thesis_cluster_label);
      }
    });
    return Array.from(clusters.entries()).sort((a, b) => a[0] - b[0]);
  }, [memos]);

  // Quintile distribution
  const quintileDistribution = useMemo(() => {
    const distribution = {
      quality: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      momentum: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      turnaround: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      composite: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
    
    memos.forEach(memo => {
      if (memo.quality_score_quintile) distribution.quality[memo.quality_score_quintile as 1|2|3|4|5]++;
      if (memo.momentum_score_quintile) distribution.momentum[memo.momentum_score_quintile as 1|2|3|4|5]++;
      if (memo.turnaround_score_quintile) distribution.turnaround[memo.turnaround_score_quintile as 1|2|3|4|5]++;
      if (memo.composite_score_quintile) distribution.composite[memo.composite_score_quintile as 1|2|3|4|5]++;
    });
    
    return distribution;
  }, [memos]);

  // Filter and sort memos
  const filteredMemos = useMemo(() => {
    return memos.filter(memo => {
      if (isFundOrETF(memo)) return false;
      if (statusFilter !== "all" && memo.status !== statusFilter) return false;
      if (clusterFilter !== "all" && String(memo.thesis_cluster_id) !== clusterFilter) return false;
      // Search filter by ticker or company name
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTicker = memo.ticker?.toLowerCase().includes(query);
        const matchesCompany = memo.company_name?.toLowerCase().includes(query);
        if (!matchesTicker && !matchesCompany) return false;
      }
      return true;
    });
  }, [memos, statusFilter, searchQuery, clusterFilter]);

  const sortedAndFilteredMemos = useMemo(() => {
    return [...filteredMemos].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'ticker':
          aVal = a.ticker || '';
          bVal = b.ticker || '';
          break;
        case 'company_name':
          aVal = a.company_name || '';
          bVal = b.company_name || '';
          break;
        case 'style_tag':
          aVal = a.style_tag || '';
          bVal = b.style_tag || '';
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        case 'quality_score':
          aVal = Number(a.quality_score) || 0;
          bVal = Number(b.quality_score) || 0;
          break;
        case 'momentum_score':
          aVal = Number(a.momentum_score) || 0;
          bVal = Number(b.momentum_score) || 0;
          break;
        case 'turnaround_score':
          aVal = Number(a.turnaround_score) || 0;
          bVal = Number(b.turnaround_score) || 0;
          break;
        case 'piotroski_score':
          aVal = Number(a.piotroski_score) || 0;
          bVal = Number(b.piotroski_score) || 0;
          break;
        case 'composite_score':
          aVal = Number(a.composite_score) || 0;
          bVal = Number(b.composite_score) || 0;
          break;
        case 'moat_strength_score':
          aVal = Number(a.moat_strength_score) || 0;
          bVal = Number(b.moat_strength_score) || 0;
          break;
        case 'approved_at':
          aVal = a.approved_at ? new Date(a.approved_at).getTime() : 0;
          bVal = b.approved_at ? new Date(b.approved_at).getTime() : 0;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      if (typeof aVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredMemos, sortField, sortDirection]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6" />
              IC Memos
            </h1>
            <p className="text-muted-foreground mt-1">
              Investment Committee Memos with 4 Factor Scores + Moat &amp; Cluster Analysis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
              Refresh
            </button>
            <button
              onClick={handleTriggerRun}
              disabled={triggeringRun}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
            >
              {triggeringRun ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Generate Memos
            </button>
          </div>
        </div>

        {/* Score Legend */}
        <div className="grid grid-cols-5 gap-4">
          {/* Quality Score */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold">Quality Score</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              MOAT, Management, ROIC Durability, Valuation (14 factors)
            </p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(q => (
                <div key={q} className={cn("flex-1 text-center py-1 rounded text-xs font-medium",
                  getQuintileColor(q)
                )}>
                  Q{q}: {quintileDistribution.quality[q as 1|2|3|4|5]}
                </div>
              ))}
            </div>
          </div>

          {/* Momentum Score */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-purple-400" />
              <h3 className="font-semibold">Momentum Score</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              RSI inverted, Momentum 12m inverted, 52W Low inverted
            </p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(q => (
                <div key={q} className={cn("flex-1 text-center py-1 rounded text-xs font-medium",
                  getQuintileColor(q)
                )}>
                  Q{q}: {quintileDistribution.momentum[q as 1|2|3|4|5]}
                </div>
              ))}
            </div>
          </div>

          {/* Turnaround Score */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h3 className="font-semibold">Turnaround Score</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              ROE improvement, Margin improvement, Momentum 1M
            </p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(q => (
                <div key={q} className={cn("flex-1 text-center py-1 rounded text-xs font-medium",
                  getQuintileColor(q)
                )}>
                  Q{q}: {quintileDistribution.turnaround[q as 1|2|3|4|5]}
                </div>
              ))}
            </div>
          </div>

          {/* Piotroski F-Score */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <h3 className="font-semibold">Piotroski F-Score</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              9-factor financial strength (0-9)
            </p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(q => (
                <div key={q} className={cn("flex-1 text-center py-1 rounded text-xs font-medium",
                  getQuintileColor(q)
                )}>
                  Q{q}: {quintileDistribution.composite[q as 1|2|3|4|5]}
                </div>
              ))}
            </div>
          </div>

          {/* Moat Score - NEW */}
          <div className="bg-card border rounded-lg p-4 ring-1 ring-amber-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold">Moat Score</h3>
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">NEW</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Competitive advantage strength &amp; durability (0-10)
            </p>
            <div className="flex gap-1 text-xs text-muted-foreground">
              <div className="flex-1 text-center py-1 rounded bg-red-500/10 text-red-400">0-3: Weak</div>
              <div className="flex-1 text-center py-1 rounded bg-yellow-500/10 text-yellow-400">4-6: Mod</div>
              <div className="flex-1 text-center py-1 rounded bg-green-500/10 text-green-400">7-10: Strong</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input
              type="text"
              placeholder="Search ticker or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-3 py-2 text-sm bg-muted rounded-lg border-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Status:</span>
            <div className="flex gap-1 flex-wrap">
              {["all", "complete", "generating", "pending", "failed"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-full transition-colors",
                    statusFilter === status
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                  {status !== "all" && stats?.by_status?.[status as keyof typeof stats.by_status] && (
                    <span className="ml-1 opacity-70">
                      ({stats.by_status[status as keyof typeof stats.by_status]})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Cluster Filter - NEW */}
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <select
              value={clusterFilter}
              onChange={(e) => setClusterFilter(e.target.value)}
              className="text-xs bg-muted rounded-lg px-2 py-1.5 border-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Clusters</option>
              {uniqueClusters.map(([id, label]) => (
                <option key={id} value={String(id)}>C{id}: {label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Memos Table */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 text-sm font-medium">
                    <button onClick={() => handleSort('ticker')} className="flex items-center gap-1 hover:text-foreground">
                      Ticker {getSortIcon('ticker')}
                    </button>
                  </th>
                  <th className="text-left p-3 text-sm font-medium">
                    <button onClick={() => handleSort('company_name')} className="flex items-center gap-1 hover:text-foreground">
                      Company {getSortIcon('company_name')}
                    </button>
                  </th>
                  <th className="text-left p-3 text-sm font-medium">
                    <button onClick={() => handleSort('status')} className="flex items-center gap-1 hover:text-foreground">
                      Status {getSortIcon('status')}
                    </button>
                  </th>
                  <th className="text-center p-3 text-sm font-medium">
                    <button onClick={() => handleSort('quality_score')} className="flex items-center gap-1 hover:text-foreground justify-center">
                      <Target className="w-3 h-3 text-blue-400" />
                      Quality {getSortIcon('quality_score')}
                    </button>
                  </th>
                  <th className="text-center p-3 text-sm font-medium">
                    <button onClick={() => handleSort('momentum_score')} className="flex items-center gap-1 hover:text-foreground justify-center">
                      <TrendingDown className="w-3 h-3 text-purple-400" />
                      Momentum {getSortIcon('momentum_score')}
                    </button>
                  </th>
                  <th className="text-center p-3 text-sm font-medium">
                    <button onClick={() => handleSort('turnaround_score')} className="flex items-center gap-1 hover:text-foreground justify-center">
                      <TrendingUp className="w-3 h-3 text-green-400" />
                      Turnaround {getSortIcon('turnaround_score')}
                    </button>
                  </th>
                  <th className="text-center p-3 text-sm font-medium">
                    <button onClick={() => handleSort('piotroski_score')} className="flex items-center gap-1 hover:text-foreground justify-center">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      Piotroski {getSortIcon('piotroski_score')}
                    </button>
                  </th>
                  <th className="text-center p-3 text-sm font-medium bg-primary/10">
                    <button onClick={() => handleSort('composite_score')} className="flex items-center gap-1 hover:text-foreground justify-center">
                      <Star className="w-3 h-3 text-amber-400" />
                      Composite {getSortIcon('composite_score')}
                    </button>
                  </th>
                  <th className="text-center p-3 text-sm font-medium bg-amber-500/5">
                    <button onClick={() => handleSort('moat_strength_score')} className="flex items-center gap-1 hover:text-foreground justify-center">
                      <Shield className="w-3 h-3 text-amber-400" />
                      Moat {getSortIcon('moat_strength_score')}
                    </button>
                  </th>
                  <th className="text-center p-3 text-sm font-medium">
                    <div className="flex items-center gap-1 justify-center">
                      <Layers className="w-3 h-3 text-cyan-400" />
                      Cluster
                    </div>
                  </th>
                  <th className="text-center p-3 text-sm font-medium">
                    <div className="flex items-center gap-1 justify-center">
                      <AlertTriangle className="w-3 h-3 text-orange-400" />
                      Warnings
                    </div>
                  </th>
                  <th className="text-center p-3 text-sm font-medium">View</th>
                </tr>
              </thead>
              <tbody>
                {sortedAndFilteredMemos.map((memo) => {
                  const StatusIcon = statusConfig[memo.status]?.icon || Clock;
                  return (
                    <tr
                      key={memo.id}
                      className="border-b hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3">
                        <span className="font-mono font-bold text-sm">
                          {memo.ticker}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                          {memo.company_name || "-"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className={cn("w-4 h-4", statusConfig[memo.status]?.color, memo.status === 'generating' && "animate-spin")} />
                          <span className={cn("text-xs", statusConfig[memo.status]?.color)}>
                            {statusConfig[memo.status]?.label}
                          </span>
                        </div>
                      </td>
                      {/* Quality Score */}
                      <td className="p-3 text-center">
                        {memo.quality_score !== null ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className={cn("font-mono font-bold", getScoreColor(memo.quality_score))}>
                              {Number(memo.quality_score).toFixed(1)}
                            </span>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                              getQuintileColor(memo.quality_score_quintile)
                            )}>
                              Q{memo.quality_score_quintile}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      {/* Momentum Score */}
                      <td className="p-3 text-center">
                        {memo.momentum_score !== null ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className={cn("font-mono font-bold", getScoreColor(memo.momentum_score))}>
                              {Number(memo.momentum_score).toFixed(1)}
                            </span>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                              getQuintileColor(memo.momentum_score_quintile)
                            )}>
                              Q{memo.momentum_score_quintile}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      {/* Turnaround Score */}
                      <td className="p-3 text-center">
                        {memo.turnaround_score !== null ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className={cn("font-mono font-bold", getScoreColor(memo.turnaround_score))}>
                              {Number(memo.turnaround_score).toFixed(1)}
                            </span>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                              getQuintileColor(memo.turnaround_score_quintile)
                            )}>
                              Q{memo.turnaround_score_quintile}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      {/* Piotroski Score */}
                      <td className="p-3 text-center">
                        {memo.piotroski_score !== null ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className={cn("font-mono font-bold", getPiotroskiColor(memo.piotroski_score))}>
                              {memo.piotroski_score}/9
                            </span>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                              getQuintileColor(memo.piotroski_score_quintile)
                            )}>
                              Q{memo.piotroski_score_quintile}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      {/* Composite Score */}
                      <td className="p-3 text-center bg-primary/5">
                        {memo.composite_score !== null ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className={cn("font-mono font-bold", getScoreColor(memo.composite_score))}>
                              {Number(memo.composite_score).toFixed(1)}
                            </span>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                              getQuintileColor(memo.composite_score_quintile)
                            )}>
                              Q{memo.composite_score_quintile}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      {/* Moat Score - NEW */}
                      <td className="p-3 text-center bg-amber-500/5">
                        {memo.moat_strength_score !== null ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className={cn("font-mono font-bold", getMoatColor(memo.moat_strength_score))}>
                              {Number(memo.moat_strength_score).toFixed(1)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              D:{Number(memo.moat_durability_score || 0).toFixed(0)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      {/* Cluster - NEW */}
                      <td className="p-3 text-center">
                        {memo.thesis_cluster_label ? (
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap",
                            getClusterColor(memo.thesis_cluster_id)
                          )}>
                            {memo.thesis_cluster_label.length > 20 
                              ? memo.thesis_cluster_label.substring(0, 20) + '...' 
                              : memo.thesis_cluster_label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>
                      {/* Early Warnings - NEW */}
                      <td className="p-3 text-center">
                        {memo.early_warning_indicators && memo.early_warning_indicators.length > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-orange-400" />
                            <span className="text-xs text-orange-400 font-medium">
                              {memo.early_warning_indicators.length}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-green-400">OK</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {memo.status === 'complete' && memo.has_content && (
                          <Link
                            href={`/ic-memo/${memo.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sortedAndFilteredMemos.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No IC Memos found</p>
            </div>
          )}
        </div>

        {/* Stats Footer */}
        <div className="text-sm text-muted-foreground text-center">
          Showing {sortedAndFilteredMemos.length} of {memos.length} memos
          {stats && ` • ${stats.by_status.complete || 0} complete`}
          {clusterFilter !== "all" && ` • Cluster filter active`}
        </div>
      </div>
    </AppLayout>
  );
}
