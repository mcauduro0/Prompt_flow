"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
  // Score v4.0 (Contrarian/Turnaround Model) - Best performer in backtest
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

const recommendationColors: Record<string, string> = {
  "strong buy": "text-emerald-400 bg-emerald-500/20",
  buy: "text-green-400 bg-green-500/15",
  hold: "text-yellow-400 bg-yellow-500/15",
  reduce: "text-orange-400 bg-orange-500/15",
  avoid: "text-red-400 bg-red-500/15",
  sell: "text-red-400 bg-red-500/15",
};

const quintileColors: Record<string, string> = {
  Q5: "text-green-400 bg-green-500/20",
  Q4: "text-green-300 bg-green-400/15",
  Q3: "text-yellow-400 bg-yellow-500/15",
  Q2: "text-orange-400 bg-orange-500/15",
  Q1: "text-red-400 bg-red-500/15",
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

// Get quintile based on Score v4.0
const getQuintileFromV4 = (score: number | null): string | null => {
  if (score === null) return null;
  if (score >= 80) return "Q5";
  if (score >= 60) return "Q4";
  if (score >= 40) return "Q3";
  if (score >= 20) return "Q2";
  return "Q1";
};

// Get recommendation based on Score v4.0 quintile (Q4 is the sweet spot)
const getRecommendationFromV4 = (quintile: string | null): string | null => {
  if (!quintile) return null;
  switch (quintile) {
    case 'Q5': return 'HOLD';
    case 'Q4': return 'STRONG BUY';
    case 'Q3': return 'BUY';
    case 'Q2': return 'REDUCE';
    case 'Q1': return 'AVOID';
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

  // Filter out funds/ETFs and apply status filter, then sort
  const sortedAndFilteredMemos = useMemo(() => {
    // First, filter out funds/ETFs - only keep companies
    let filtered = memos.filter(m => !isFundOrETF(m));
    
    // Then apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(m => m.status === statusFilter);
    }

    return filtered.sort((a, b) => {
      let aValue: string | number | null;
      let bValue: string | number | null;

      switch (sortField) {
        case 'ticker':
          aValue = a.ticker;
          bValue = b.ticker;
          break;
        case 'company_name':
          aValue = a.company_name;
          bValue = b.company_name;
          break;
        case 'style_tag':
          aValue = a.style_tag;
          bValue = b.style_tag;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'score_v4':
          aValue = a.score_v4 !== null ? Number(a.score_v4) : -1;
          bValue = b.score_v4 !== null ? Number(b.score_v4) : -1;
          break;
        case 'turnaround_score':
          aValue = a.turnaround_score !== null ? Number(a.turnaround_score) : -1;
          bValue = b.turnaround_score !== null ? Number(b.turnaround_score) : -1;
          break;
        case 'piotroski_score':
          aValue = a.piotroski_score !== null ? Number(a.piotroski_score) : -1;
          bValue = b.piotroski_score !== null ? Number(b.piotroski_score) : -1;
          break;
        case 'score_v4_quintile':
          const quintileOrder = { Q5: 5, Q4: 4, Q3: 3, Q2: 2, Q1: 1 };
          const aQuintile = a.score_v4_quintile || getQuintileFromV4(a.score_v4);
          const bQuintile = b.score_v4_quintile || getQuintileFromV4(b.score_v4);
          aValue = aQuintile ? quintileOrder[aQuintile as keyof typeof quintileOrder] : 0;
          bValue = bQuintile ? quintileOrder[bQuintile as keyof typeof quintileOrder] : 0;
          break;
        case 'approved_at':
          aValue = a.approved_at ? new Date(a.approved_at).getTime() : 0;
          bValue = b.approved_at ? new Date(b.approved_at).getTime() : 0;
          break;
        default:
          aValue = '';
          bValue = '';
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  }, [memos, statusFilter, sortField, sortDirection]);

  // Calculate stats for companies only
  const companyStats = useMemo(() => {
    const companies = memos.filter(m => !isFundOrETF(m));
    const fundsRemoved = memos.length - companies.length;
    
    const byStatus = {
      pending: companies.filter(m => m.status === 'pending').length,
      generating: companies.filter(m => m.status === 'generating').length,
      complete: companies.filter(m => m.status === 'complete').length,
      failed: companies.filter(m => m.status === 'failed').length,
    };
    
    return {
      total: companies.length,
      fundsRemoved,
      by_status: byStatus,
    };
  }, [memos]);

  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <th 
      className={cn(
        "text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-3 cursor-pointer hover:bg-muted/50 transition-calm select-none",
        className
      )}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1.5">
        {children}
        {getSortIcon(field)}
      </div>
    </th>
  );

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center justify-center rounded-md",
              "bg-accent/10 border border-accent/20",
              "w-10 h-10"
            )}>
              <ClipboardCheck className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-medium text-foreground">IC Memo</h1>
              <p className="text-sm text-muted-foreground">
                Investment Committee Memos - Companies Only
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-blue-400">
                {companyStats.fundsRemoved} funds filtered out
              </span>
            </div>
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md",
                "border border-border text-sm",
                "hover:bg-muted/50 transition-calm",
                refreshing && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
              Refresh
            </button>

            <button
              onClick={handleTriggerRun}
              disabled={triggeringRun || (companyStats.by_status?.pending || 0) === 0}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md",
                "bg-accent text-accent-foreground text-sm",
                "hover:bg-accent/90 transition-calm",
                (triggeringRun || (companyStats.by_status?.pending || 0) === 0) && "opacity-50 cursor-not-allowed"
              )}
            >
              {triggeringRun ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Run Lane C
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className={cn(
            "p-4 rounded-lg border border-border",
            "bg-card"
          )}>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Companies</p>
            </div>
            <p className="text-2xl font-medium">{companyStats.total}</p>
          </div>
          
          <div className={cn(
            "p-4 rounded-lg border border-border",
            "bg-yellow-500/5"
          )}>
            <p className="text-sm text-yellow-600 mb-1">Pending</p>
            <p className="text-2xl font-medium text-yellow-600">
              {companyStats.by_status?.pending || 0}
            </p>
          </div>
          
          <div className={cn(
            "p-4 rounded-lg border border-border",
            "bg-blue-500/5"
          )}>
            <p className="text-sm text-blue-600 mb-1">Generating</p>
            <p className="text-2xl font-medium text-blue-600">
              {companyStats.by_status?.generating || 0}
            </p>
          </div>
          
          <div className={cn(
            "p-4 rounded-lg border border-border",
            "bg-green-500/5"
          )}>
            <p className="text-sm text-green-600 mb-1">Complete</p>
            <p className="text-2xl font-medium text-green-600">
              {companyStats.by_status?.complete || 0}
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-border pb-4">
          {["all", "pending", "generating", "complete", "failed"].map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={cn(
                "px-4 py-2 rounded-md text-sm transition-calm",
                statusFilter === filter
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
              {filter !== "all" && companyStats.by_status?.[filter as keyof typeof companyStats.by_status] !== undefined && (
                <span className="ml-2 text-xs opacity-70">
                  ({companyStats.by_status[filter as keyof typeof companyStats.by_status]})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Memos Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : sortedAndFilteredMemos.length === 0 ? (
          <div className="text-center py-20">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {statusFilter === "all" 
                ? "No IC Memos yet. Approve research packets to generate IC Memos."
                : `No ${statusFilter} IC Memos.`}
            </p>
            <Link 
              href="/research"
              className={cn(
                "inline-flex items-center gap-2 mt-4",
                "px-4 py-2 rounded-md",
                "bg-accent text-accent-foreground text-sm",
                "hover:bg-accent/90 transition-calm"
              )}
            >
              <FileText className="w-4 h-4" />
              Go to Research
            </Link>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-muted/30 sticky top-0 z-10">
                  <tr>
                    <SortableHeader field="ticker">Company</SortableHeader>
                    <SortableHeader field="style_tag">Style</SortableHeader>
                    <SortableHeader field="status">Status</SortableHeader>
                    <SortableHeader field="score_v4">Score v4.0</SortableHeader>
                    <SortableHeader field="turnaround_score">Turnaround</SortableHeader>
                    <SortableHeader field="piotroski_score">Piotroski</SortableHeader>
                    <SortableHeader field="score_v4_quintile">Quintile</SortableHeader>
                    <SortableHeader field="approved_at">Approved</SortableHeader>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedAndFilteredMemos.map((memo) => {
                    const statusInfo = statusConfig[memo.status];
                    const StatusIcon = statusInfo.icon;
                    const quintile = memo.score_v4_quintile || getQuintileFromV4(memo.score_v4);
                    const recommendation = memo.score_v4_recommendation || getRecommendationFromV4(quintile);
                    
                    return (
                      <tr key={memo.id} className="hover:bg-muted/20 transition-calm">
                        {/* Company Column */}
                        <td className="px-3 py-3">
                          <div>
                            <p className="font-medium text-foreground">{memo.ticker}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {memo.company_name}
                            </p>
                          </div>
                        </td>
                        
                        {/* Style Column */}
                        <td className="px-3 py-3">
                          <span className={cn(
                            "px-2 py-1 rounded text-xs font-medium",
                            "bg-muted text-muted-foreground"
                          )}>
                            {memo.style_tag}
                          </span>
                        </td>
                        
                        {/* Status Column */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "flex items-center gap-1.5 px-2 py-1 rounded",
                              statusInfo.bgColor
                            )}>
                              <StatusIcon className={cn(
                                "w-3.5 h-3.5",
                                statusInfo.color,
                                memo.status === "generating" && "animate-spin"
                              )} />
                              <span className={cn("text-xs font-medium", statusInfo.color)}>
                                {statusInfo.label}
                              </span>
                            </div>
                          </div>
                        </td>
                        
                        {/* Score v4.0 Column */}
                        <td className="px-3 py-3">
                          {memo.score_v4 !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full",
                                    Number(memo.score_v4) >= 60 ? "bg-green-500" :
                                    Number(memo.score_v4) >= 40 ? "bg-yellow-500" : "bg-red-500"
                                  )}
                                  style={{ width: `${memo.score_v4}%` }}
                                />
                              </div>
                              <span className={cn(
                                "text-sm font-medium tabular-nums",
                                Number(memo.score_v4) >= 60 ? "text-green-400" :
                                Number(memo.score_v4) >= 40 ? "text-yellow-400" : "text-red-400"
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
                        
                        {/* Quintile Column (based on Score v4.0) */}
                        <td className="px-3 py-3">
                          {quintile ? (
                            <div className="flex flex-col gap-1">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-xs font-medium inline-block w-fit",
                                quintileColors[quintile] || "bg-muted text-muted-foreground"
                              )}>
                                {quintile}
                              </span>
                              {recommendation && (
                                <span className={cn(
                                  "text-[10px] font-medium uppercase",
                                  recommendationColors[recommendation.toLowerCase()] || "text-muted-foreground"
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
