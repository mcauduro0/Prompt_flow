"use client";

import { useEffect, useState, useCallback } from "react";
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
  FileText
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
  buy: "text-green-600 bg-green-500/10",
  invest: "text-green-500 bg-green-500/10",
  increase: "text-green-400 bg-green-400/10",
  hold: "text-yellow-500 bg-yellow-500/10",
  reduce: "text-orange-500 bg-orange-500/10",
  wait: "text-gray-500 bg-gray-500/10",
  reject: "text-red-500 bg-red-500/10",
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

export default function ICMemoPage() {
  const [memos, setMemos] = useState<ICMemo[]>([]);
  const [stats, setStats] = useState<ICMemoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggeringRun, setTriggeringRun] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    try {
      const [memosRes, statsRes] = await Promise.all([
        fetch("/api/ic-memos"),
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

  const filteredMemos = statusFilter === "all" 
    ? memos 
    : memos.filter(m => m.status === statusFilter);

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
                Investment Committee Memos - Lane C
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
              disabled={triggeringRun || (stats?.by_status?.pending || 0) === 0}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md",
                "bg-accent text-accent-foreground text-sm",
                "hover:bg-accent/90 transition-calm",
                (triggeringRun || (stats?.by_status?.pending || 0) === 0) && "opacity-50 cursor-not-allowed"
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
            <p className="text-sm text-muted-foreground mb-1">Total</p>
            <p className="text-2xl font-medium">{stats?.total || 0}</p>
          </div>
          
          <div className={cn(
            "p-4 rounded-lg border border-border",
            "bg-yellow-500/5"
          )}>
            <p className="text-sm text-yellow-600 mb-1">Pending</p>
            <p className="text-2xl font-medium text-yellow-600">
              {stats?.by_status?.pending || 0}
            </p>
          </div>
          
          <div className={cn(
            "p-4 rounded-lg border border-border",
            "bg-blue-500/5"
          )}>
            <p className="text-sm text-blue-600 mb-1">Generating</p>
            <p className="text-2xl font-medium text-blue-600">
              {stats?.by_status?.generating || 0}
            </p>
          </div>
          
          <div className={cn(
            "p-4 rounded-lg border border-border",
            "bg-green-500/5"
          )}>
            <p className="text-sm text-green-600 mb-1">Complete</p>
            <p className="text-2xl font-medium text-green-600">
              {stats?.by_status?.complete || 0}
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
              {filter !== "all" && stats?.by_status?.[filter as keyof typeof stats.by_status] !== undefined && (
                <span className="ml-2 text-xs opacity-70">
                  ({stats.by_status[filter as keyof typeof stats.by_status]})
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
        ) : filteredMemos.length === 0 ? (
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
            <table className="w-full">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Company
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Style
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Recommendation
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Conviction
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Approved
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMemos.map((memo) => {
                  const statusInfo = statusConfig[memo.status];
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <tr key={memo.id} className="hover:bg-muted/20 transition-calm">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-foreground">{memo.ticker}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {memo.company_name}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded text-xs font-medium",
                          "bg-muted text-muted-foreground"
                        )}>
                          {memo.style_tag}
                        </span>
                      </td>
                      <td className="px-4 py-4">
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
                          {memo.status === "generating" && (
                            <span className="text-xs text-muted-foreground">
                              {memo.generation_progress}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {memo.recommendation ? (
                          <span className={cn(
                            "px-2 py-1 rounded text-xs font-medium uppercase",
                            recommendationColors[memo.recommendation] || "bg-muted text-muted-foreground"
                          )}>
                            {memo.recommendation}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {memo.conviction !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full rounded-full",
                                  memo.conviction >= 70 ? "bg-green-500" :
                                  memo.conviction >= 50 ? "bg-yellow-500" : "bg-red-500"
                                )}
                                style={{ width: `${memo.conviction}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {memo.conviction}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">
                        {formatDate(memo.approved_at)}
                      </td>
                      <td className="px-4 py-4">
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
        )}
      </div>
    </AppLayout>
  );
}
