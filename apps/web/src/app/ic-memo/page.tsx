"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  ClipboardCheck, 
  RefreshCw, 
  Play, 
  Eye, 
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ICMemo {
  id: string;
  packet_id: string;
  idea_id: string;
  ticker: string;
  company_name: string;
  style_tag: string;
  status: 'pending' | 'generating' | 'complete' | 'failed';
  generation_progress: number;
  recommendation: string | null;
  conviction: number | null;
  // Score v4.0 (Composite Score) - Calculated from weighted average
  score_v4: number | null;
  score_v4_quintile: string | null;
  score_v4_recommendation: string | null;
  // Turnaround Score
  turnaround_score: number | null;
  turnaround_quintile: number | null;
  turnaround_recommendation: string | null;
  // Piotroski F-Score
  piotroski_score: number | null;
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

type SortField = 'ticker' | 'company_name' | 'style_tag' | 'status' | 'score_v4' | 'turnaround_score' | 'piotroski_score' | 'score_v4_quintile' | 'approved_at';
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

// Updated recommendation colors based on backtest results (Q3 is the sweet spot)
const recommendationColors: Record<string, string> = {
  "strong_buy": "text-emerald-400 bg-emerald-500/20",
  "strong buy": "text-emerald-400 bg-emerald-500/20",
  buy: "text-green-400 bg-green-500/15",
  hold: "text-yellow-400 bg-yellow-500/15",
  reduce: "text-orange-400 bg-orange-500/15",
  avoid: "text-red-400 bg-red-500/15",
  sell: "text-red-400 bg-red-500/15",
};

// Quintile colors - Q3 is now the best (based on backtest)
const quintileColors: Record<string, string> = {
  "5": "text-green-400 bg-green-500/20",
  "4": "text-yellow-400 bg-yellow-500/15",
  "3": "text-emerald-400 bg-emerald-500/25", // Q3 is the sweet spot!
  "2": "text-orange-400 bg-orange-500/15",
  "1": "text-red-400 bg-red-500/15",
  "Q5": "text-green-400 bg-green-500/20",
  "Q4": "text-yellow-400 bg-yellow-500/15",
  "Q3": "text-emerald-400 bg-emerald-500/25",
  "Q2": "text-orange-400 bg-orange-500/15",
  "Q1": "text-red-400 bg-red-500/15",
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

// Get quintile display from database value
const getQuintileDisplay = (quintile: string | number | null): string | null => {
  if (quintile === null || quintile === undefined) return null;
  const q = String(quintile);
  if (q.startsWith('Q')) return q;
  return `Q${q}`;
};

// Get recommendation display - use database value or derive from quintile
const getRecommendationDisplay = (recommendation: string | null, quintile: string | number | null): string | null => {
  if (recommendation) {
    return recommendation.toUpperCase().replace('_', ' ');
  }
  if (!quintile) return null;
  const q = String(quintile).replace('Q', '');
  // Based on backtest: Q3 is the sweet spot (20.66% CAGR, Sharpe 0.64)
  switch (q) {
    case '5': return 'BUY';
    case '4': return 'HOLD';
    case '3': return 'STRONG BUY'; // Q3 is the sweet spot!
    case '2': return 'HOLD';
    case '1': return 'AVOID';
    default: return 'HOLD';
  }
};

// Check if a memo is a fund/ETF (not a company)
const isFundOrETF = (memo: ICMemo): boolean => {
  const fundPatterns = [
    /\bFund\b/i,
    /\bETF\b/i,
    /\bIndex\b/i,
    /\bVanguard\b/i,
    /\bFidelity\b/i,
    /\biShares\b/i,
    /\bSPDR\b/i,
    /\bAdmiral\b/i,
    /\bInvestor\s+(Class|Shares)\b/i,
    /\bPortfolio\b/i,
    /\bIncome\s+Fund\b/i,
    /\bSecurities\s+Fund\b/i,
    /\bBond\b/i,
    /\bTreasury\b/i,
    /\bFreedom\b/i,
    /\bGrowth\s+Fund\b/i,
    /\bCore\s+Equity\b/i,
    /\bClass\s+[A-Z0-9-]+$/i,
    /\bShares$/i,
    /\bInstitutional\b/i,
    /\bPremium\s+Income\b/i,
    /\bProtected\s+Securities\b/i,
    /\bGovernment\s+Securities\b/i,
    /\bInvestment\s+Grade\b/i,
    /\bTotal\s+Market\b/i,
    /\bSelect\s+Income\b/i,
    /\bETP\b/i,
  ];
  
  // Check ticker patterns for funds
  const fundTickerPatterns = [
    /^V[A-Z]{3,4}X?$/,  // Vanguard funds like VWUSX, VEUSX, VFTNX
    /^F[A-Z]{3,4}X$/,   // Fidelity funds like FZTKX, FIPFX
    /^[A-Z]{4,5}X$/,    // Most mutual funds end in X
  ];
  
  const companyName = memo.company_name || '';
  const ticker = memo.ticker || '';
  
  // Check company name against fund patterns
  for (const pattern of fundPatterns) {
    if (pattern.test(companyName)) {
      return true;
    }
  }
  
  // Check ticker against fund patterns
  for (const pattern of fundTickerPatterns) {
    if (pattern.test(ticker) && ticker.length >= 5) {
      return true;
    }
  }
  
  return false;
};

// Get Piotroski color based on score (0-9)
const getPiotroskiColor = (score: number | null): string => {
  if (score === null) return "text-muted-foreground";
  if (score >= 7) return "text-green-400";
  if (score >= 5) return "text-yellow-400";
  if (score >= 3) return "text-orange-400";
  return "text-red-400";
};

// Get Piotroski background color based on score (0-9)
const getPiotroskiBgColor = (score: number | null): string => {
  if (score === null) return "bg-muted";
  if (score >= 7) return "bg-green-500";
  if (score >= 5) return "bg-yellow-500";
  if (score >= 3) return "bg-orange-500";
  return "bg-red-500";
};

// Get Score v4.0 color based on score (0-100)
const getScoreV4Color = (score: number | null): string => {
  if (score === null) return "text-muted-foreground";
  if (score >= 65) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
};

// Get Score v4.0 background color
const getScoreV4BgColor = (score: number | null): string => {
  if (score === null) return "bg-muted";
  if (score >= 65) return "bg-green-500";
  if (score >= 50) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
};

export default function ICMemoPage() {
  const [memos, setMemos] = useState<ICMemo[]>([]);
  const [stats, setStats] = useState<ICMemoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggeringRun, setTriggeringRun] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>('score_v4');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const fetchData = useCallback(async () => {
    try {
      // Fetch all memos without limit
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
    // Auto-refresh every 30 seconds
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
      const res = await fetch("/api/ic-memos/run-lane-c", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxMemos: 5 }),
      });
      
      if (res.ok) {
        // Refresh data after triggering
        setTimeout(fetchData, 2000);
      }
    } catch (error) {
      console.error("Error triggering Lane C run:", error);
    } finally {
      setTriggeringRun(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3" />
      : <ArrowDown className="w-3 h-3" />;
  };

  // Filter out funds/ETFs and apply status filter
  const filteredMemos = useMemo(() => {
    return memos.filter(memo => {
      // Filter out funds/ETFs
      if (isFundOrETF(memo)) return false;
      
      // Apply status filter
      if (statusFilter !== "all" && memo.status !== statusFilter) return false;
      
      return true;
    });
  }, [memos, statusFilter]);

  // Sort memos
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
        case 'score_v4':
          aVal = Number(a.score_v4) || 0;
          bVal = Number(b.score_v4) || 0;
          break;
        case 'turnaround_score':
          aVal = Number(a.turnaround_score) || 0;
          bVal = Number(b.turnaround_score) || 0;
          break;
        case 'piotroski_score':
          aVal = Number(a.piotroski_score) || 0;
          bVal = Number(b.piotroski_score) || 0;
          break;
        case 'score_v4_quintile':
          aVal = String(a.score_v4_quintile || '').replace('Q', '') || '0';
          bVal = String(b.score_v4_quintile || '').replace('Q', '') || '0';
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

  // Calculate quintile distribution
  const quintileDistribution = useMemo(() => {
    const dist: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    filteredMemos.forEach(memo => {
      if (memo.score_v4_quintile) {
        const q = String(memo.score_v4_quintile).replace('Q', '');
        if (dist[q] !== undefined) {
          dist[q]++;
        }
      }
    });
    return dist;
  }, [filteredMemos]);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-accent/10">
              <ClipboardCheck className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-medium text-foreground">IC Memos</h1>
              <p className="text-sm text-muted-foreground">
                Investment Committee Memos with Composite Scores
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md",
                "bg-muted hover:bg-muted/80 transition-calm",
                "text-sm text-muted-foreground",
                refreshing && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
              Refresh
            </button>
            
            <button
              onClick={handleTriggerRun}
              disabled={triggeringRun}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md",
                "bg-accent text-accent-foreground hover:bg-accent/90 transition-calm",
                "text-sm font-medium",
                triggeringRun && "opacity-50 cursor-not-allowed"
              )}
            >
              <Play className={cn("w-4 h-4", triggeringRun && "animate-pulse")} />
              Run Lane C
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-medium text-foreground">{stats.total}</p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-sm text-muted-foreground">Complete</p>
              <p className="text-2xl font-medium text-green-500">{stats.by_status.complete || 0}</p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-medium text-yellow-500">{stats.by_status.pending || 0}</p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-sm text-muted-foreground">Generating</p>
              <p className="text-2xl font-medium text-blue-500">{stats.by_status.generating || 0}</p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="text-2xl font-medium text-red-500">{stats.by_status.failed || 0}</p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-sm text-muted-foreground">Companies</p>
              <p className="text-2xl font-medium text-foreground">{filteredMemos.length}</p>
            </div>
          </div>
        )}

        {/* Quintile Distribution */}
        <div className="p-4 rounded-lg bg-card border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Quintile Distribution (Composite Score)</h3>
          <div className="flex items-center gap-4">
            {['1', '2', '3', '4', '5'].map(q => (
              <div key={q} className="flex items-center gap-2">
                <span className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium",
                  quintileColors[q] || "bg-muted text-muted-foreground"
                )}>
                  Q{q}
                </span>
                <span className="text-sm text-muted-foreground">{quintileDistribution[q]}</span>
                {q === '3' && <span className="text-[10px] text-emerald-400 font-medium">★ SWEET SPOT</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Status:</span>
          </div>
          <div className="flex items-center gap-2">
            {['all', 'complete', 'pending', 'generating', 'failed'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm transition-calm",
                  statusFilter === status
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : sortedAndFilteredMemos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No IC Memos Found</h3>
            <p className="text-sm text-muted-foreground">
              {statusFilter !== "all" 
                ? `No memos with status "${statusFilter}"`
                : "No IC memos have been generated yet"}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-3 text-left">
                      <button 
                        onClick={() => handleSort('ticker')}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-calm"
                      >
                        Ticker {getSortIcon('ticker')}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left">
                      <button 
                        onClick={() => handleSort('company_name')}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-calm"
                      >
                        Company {getSortIcon('company_name')}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left">
                      <button 
                        onClick={() => handleSort('style_tag')}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-calm"
                      >
                        Style {getSortIcon('style_tag')}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left">
                      <button 
                        onClick={() => handleSort('status')}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-calm"
                      >
                        Status {getSortIcon('status')}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left">
                      <button 
                        onClick={() => handleSort('score_v4')}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-calm"
                      >
                        Composite {getSortIcon('score_v4')}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left">
                      <button 
                        onClick={() => handleSort('turnaround_score')}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-calm"
                      >
                        Turnaround {getSortIcon('turnaround_score')}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left">
                      <button 
                        onClick={() => handleSort('piotroski_score')}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-calm"
                      >
                        Piotroski {getSortIcon('piotroski_score')}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left">
                      <button 
                        onClick={() => handleSort('score_v4_quintile')}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-calm"
                      >
                        Quintile {getSortIcon('score_v4_quintile')}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left">
                      <button 
                        onClick={() => handleSort('approved_at')}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-calm"
                      >
                        Approved {getSortIcon('approved_at')}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedAndFilteredMemos.map((memo) => {
                    const StatusIcon = statusConfig[memo.status]?.icon || AlertCircle;
                    const quintile = getQuintileDisplay(memo.score_v4_quintile);
                    const recommendation = getRecommendationDisplay(memo.score_v4_recommendation, memo.score_v4_quintile);
                    
                    return (
                      <tr key={memo.id} className="hover:bg-muted/30 transition-calm">
                        {/* Ticker Column */}
                        <td className="px-3 py-3">
                          <span className="font-medium text-foreground">{memo.ticker}</span>
                        </td>
                        
                        {/* Company Name Column */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {memo.company_name || memo.ticker}
                            </span>
                          </div>
                        </td>
                        
                        {/* Style Tag Column */}
                        <td className="px-3 py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                            {memo.style_tag}
                          </span>
                        </td>
                        
                        {/* Status Column */}
                        <td className="px-3 py-3">
                          <div className={cn(
                            "flex items-center gap-1.5 px-2 py-1 rounded w-fit",
                            statusConfig[memo.status]?.bgColor
                          )}>
                            <StatusIcon className={cn(
                              "w-3.5 h-3.5",
                              statusConfig[memo.status]?.color,
                              memo.status === 'generating' && "animate-spin"
                            )} />
                            <span className={cn(
                              "text-xs font-medium",
                              statusConfig[memo.status]?.color
                            )}>
                              {statusConfig[memo.status]?.label}
                            </span>
                          </div>
                        </td>
                        
                        {/* Composite Score Column (Score v4.0) */}
                        <td className="px-3 py-3">
                          {memo.score_v4 !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full",
                                    getScoreV4BgColor(Number(memo.score_v4))
                                  )}
                                  style={{ width: `${Number(memo.score_v4)}%` }}
                                />
                              </div>
                              <span className={cn(
                                "text-sm font-medium tabular-nums",
                                getScoreV4Color(Number(memo.score_v4))
                              )}>
                                {Number(memo.score_v4).toFixed(1)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                        
                        {/* Turnaround Score Column */}
                        <td className="px-3 py-3">
                          {memo.turnaround_score !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full",
                                    Number(memo.turnaround_score) >= 60 ? "bg-blue-500" :
                                    Number(memo.turnaround_score) >= 40 ? "bg-yellow-500" : "bg-orange-500"
                                  )}
                                  style={{ width: `${memo.turnaround_score}%` }}
                                />
                              </div>
                              <span className={cn(
                                "text-sm font-medium tabular-nums",
                                Number(memo.turnaround_score) >= 60 ? "text-blue-400" :
                                Number(memo.turnaround_score) >= 40 ? "text-yellow-400" : "text-orange-400"
                              )}>
                                {Number(memo.turnaround_score).toFixed(1)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                        
                        {/* Piotroski Score Column (0-9) */}
                        <td className="px-3 py-3">
                          {memo.piotroski_score !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full",
                                    getPiotroskiBgColor(memo.piotroski_score)
                                  )}
                                  style={{ width: `${(memo.piotroski_score / 9) * 100}%` }}
                                />
                              </div>
                              <span className={cn(
                                "text-sm font-medium tabular-nums",
                                getPiotroskiColor(memo.piotroski_score)
                              )}>
                                {memo.piotroski_score}/9
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                        
                        {/* Quintile Column (based on Composite Score) */}
                        <td className="px-3 py-3">
                          {quintile ? (
                            <div className="flex flex-col gap-1">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-xs font-medium inline-block w-fit",
                                quintileColors[memo.score_v4_quintile || ''] || quintileColors[quintile] || "bg-muted text-muted-foreground"
                              )}>
                                {quintile}
                              </span>
                              {recommendation && (
                                <span className={cn(
                                  "text-[10px] font-medium uppercase",
                                  recommendationColors[recommendation.toLowerCase().replace(' ', '_')] || 
                                  recommendationColors[recommendation.toLowerCase()] || 
                                  "text-muted-foreground"
                                )}>
                                  {recommendation}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                        
                        {/* Approved Date Column */}
                        <td className="px-3 py-3 text-sm text-muted-foreground">
                          {formatDate(memo.approved_at)}
                        </td>
                        
                        {/* Actions Column */}
                        <td className="px-3 py-3">
                          <Link
                            href={`/ic-memo/${memo.id}`}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded",
                              "text-sm text-accent hover:bg-accent/10 transition-calm",
                              !memo.has_content && memo.status !== "complete" && "opacity-50 pointer-events-none"
                            )}
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Footer with count */}
            <div className="px-4 py-3 bg-muted/20 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing {sortedAndFilteredMemos.length} companies
                {statusFilter !== "all" && ` (${statusFilter})`}
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
