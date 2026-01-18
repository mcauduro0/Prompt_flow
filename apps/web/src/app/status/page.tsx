"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  Home, 
  Inbox, 
  FileText, 
  Shield, 
  Play, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Zap,
  Search,
  BookOpen,
  Briefcase,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// INTERFACES
// ============================================================================

interface WarmUpStatus {
  laneA: {
    runId: string;
    status: string;
    runDate: string;
    completedAt: string | null;
    summary: any;
  } | null;
  laneB: {
    runId: string;
    status: string;
    runDate: string;
    completedAt: string | null;
    summary: any;
  } | null;
  qa: {
    runId: string;
    status: string;
    runDate: string;
    completedAt: string | null;
    summary: any;
  } | null;
}

interface ServiceStatus {
  api: string;
  database: string;
  worker: string;
}

interface LaneStatus {
  lane: string;
  status: 'running' | 'idle';
  currentRunId: string | null;
  lastRun: {
    runId: string;
    status: string;
    completedAt: string | null;
    type: 'manual' | 'scheduled';
  } | null;
}

interface LaneStatusResponse {
  lanes: {
    lane_0: LaneStatus;
    lane_a: LaneStatus;
    lane_b: LaneStatus;
    lane_c: LaneStatus;
  };
  timestamp: string;
}

interface RecentRun {
  runId: string;
  lane: string;
  description: string;
  type: 'manual' | 'scheduled';
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  payload: any;
  error: string | null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "No runs yet";
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrentDate = (): string => {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatDuration = (ms: number | null): string => {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

// ============================================================================
// LANE CONFIGURATION
// ============================================================================

const LANE_CONFIG = {
  lane_0: {
    name: "Lane 0",
    description: "Substack + Reddit Ingestion",
    icon: Zap,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    endpoint: "/api/system/trigger-lane-0",
  },
  lane_a: {
    name: "Lane A",
    description: "Daily Discovery & Scoring",
    icon: Search,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    endpoint: "/api/system/trigger-lane-a",
  },
  lane_b: {
    name: "Lane B",
    description: "Deep Research",
    icon: BookOpen,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    endpoint: "/api/system/trigger-lane-b",
  },
  lane_c: {
    name: "Lane C",
    description: "IC Bundle Generation",
    icon: Briefcase,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    endpoint: "/api/system/trigger-lane-c",
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function StatusPage() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [warmUp, setWarmUp] = useState<WarmUpStatus | null>(null);
  const [laneStatus, setLaneStatus] = useState<LaneStatusResponse | null>(null);
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringLane, setTriggeringLane] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Fetch all status data
  const fetchStatus = useCallback(async () => {
    try {
      const [healthRes, warmUpRes, laneStatusRes, recentRunsRes] = await Promise.all([
        fetch("/api/health"),
        fetch("/api/runs/warmup-status"),
        fetch("/api/system/lane-status"),
        fetch("/api/system/recent-runs?limit=10"),
      ]);

      if (healthRes.ok) {
        const data = await healthRes.json();
        setStatus({
          api: "operational",
          database: data.services?.database === "connected" ? "operational" : "unavailable",
          worker: "operational",
        });
      } else {
        setStatus({ api: "degraded", database: "unavailable", worker: "unavailable" });
      }

      if (warmUpRes.ok) {
        const warmUpData = await warmUpRes.json();
        setWarmUp(warmUpData);
      }

      if (laneStatusRes.ok) {
        const laneData = await laneStatusRes.json();
        setLaneStatus(laneData);
      }

      if (recentRunsRes.ok) {
        const runsData = await recentRunsRes.json();
        setRecentRuns(runsData.runs || []);
      }
    } catch {
      setStatus({ api: "unavailable", database: "unavailable", worker: "unavailable" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Trigger a lane manually
  const triggerLane = async (laneKey: keyof typeof LANE_CONFIG) => {
    const config = LANE_CONFIG[laneKey];
    setTriggeringLane(laneKey);

    try {
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (response.ok) {
        setNotification({
          type: "success",
          message: `${config.name} triggered successfully. Run ID: ${data.runId?.slice(0, 8)}...`,
        });
        // Refresh status after triggering
        setTimeout(fetchStatus, 1000);
      } else {
        setNotification({
          type: "error",
          message: data.error || `Failed to trigger ${config.name}`,
        });
      }
    } catch (error) {
      setNotification({
        type: "error",
        message: `Failed to trigger ${config.name}: ${(error as Error).message}`,
      });
    } finally {
      setTriggeringLane(null);
    }
  };

  const isSystemHealthy = status?.api === "operational" && 
                          status?.database === "operational" && 
                          status?.worker === "operational";

  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Home className="w-6 h-6" />
                System Status
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{formatCurrentDate()}</p>
            </div>
            <button
              onClick={fetchStatus}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Refresh
            </button>
          </div>

          {/* Notification Toast */}
          {notification && (
            <div
              className={cn(
                "fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all",
                notification.type === "success"
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/10 border border-red-500/30 text-red-400"
              )}
            >
              {notification.type === "success" ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              <span className="text-sm">{notification.message}</span>
            </div>
          )}

          {/* System Health Banner */}
          <div
            className={cn(
              "rounded-xl border p-4",
              isSystemHealthy
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-red-500/5 border-red-500/20"
            )}
          >
            <div className="flex items-center gap-3">
              {isSystemHealthy ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-500" />
              )}
              <div>
                <h3 className={cn(
                  "font-semibold",
                  isSystemHealthy ? "text-emerald-400" : "text-red-400"
                )}>
                  {isSystemHealthy ? "All Systems Operational" : "System Issues Detected"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  API: {status?.api} | Database: {status?.database} | Worker: {status?.worker}
                </p>
              </div>
            </div>
          </div>

          {/* Manual Control Panel */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Play className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Manual Pipeline Control</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Trigger individual lanes manually. Each lane will be queued and processed by the worker.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(Object.keys(LANE_CONFIG) as Array<keyof typeof LANE_CONFIG>).map((laneKey) => {
                const config = LANE_CONFIG[laneKey];
                const Icon = config.icon;
                const currentLaneStatus = laneStatus?.lanes[laneKey];
                const isRunning = currentLaneStatus?.status === "running";
                const isTriggering = triggeringLane === laneKey;
                const isDisabled = isRunning || isTriggering;

                return (
                  <div
                    key={laneKey}
                    className={cn(
                      "rounded-lg border p-4 transition-all",
                      config.bgColor,
                      config.borderColor
                    )}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn("p-2 rounded-lg", config.bgColor)}>
                        <Icon className={cn("w-5 h-5", config.color)} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{config.name}</h3>
                        <p className="text-xs text-muted-foreground">{config.description}</p>
                      </div>
                    </div>

                    {/* Status indicator */}
                    <div className="flex items-center gap-2 mb-3 text-xs">
                      {isRunning ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />
                          <span className="text-yellow-500">Running...</span>
                        </>
                      ) : currentLaneStatus?.lastRun ? (
                        <>
                          {currentLaneStatus.lastRun.status === "completed" ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-500" />
                          )}
                          <span className="text-muted-foreground">
                            Last: {formatRelativeTime(currentLaneStatus.lastRun.completedAt || "")}
                          </span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">No runs yet</span>
                        </>
                      )}
                    </div>

                    {/* Run button */}
                    <button
                      onClick={() => triggerLane(laneKey)}
                      disabled={isDisabled}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        isDisabled
                          ? "bg-secondary/50 text-muted-foreground cursor-not-allowed"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                    >
                      {isTriggering ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Triggering...
                        </>
                      ) : isRunning ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Run {config.name}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Runs Table */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Recent Runs</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Lane</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Type</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Status</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Started</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Duration</th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">Run ID</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        No recent runs found
                      </td>
                    </tr>
                  ) : (
                    recentRuns.map((run) => {
                      const laneConfig = LANE_CONFIG[run.lane as keyof typeof LANE_CONFIG];
                      const Icon = laneConfig?.icon || Clock;

                      return (
                        <tr key={run.runId} className="border-b border-border/50 hover:bg-secondary/30">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <Icon className={cn("w-4 h-4", laneConfig?.color || "text-muted-foreground")} />
                              <span className="font-medium">{laneConfig?.name || run.lane}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <span
                              className={cn(
                                "px-2 py-1 rounded text-xs",
                                run.type === "manual"
                                  ? "bg-blue-500/10 text-blue-400"
                                  : "bg-gray-500/10 text-gray-400"
                              )}
                            >
                              {run.type}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              {run.status === "completed" ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : run.status === "running" || run.status === "pending" ? (
                                <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                              <span
                                className={cn(
                                  run.status === "completed" && "text-emerald-400",
                                  (run.status === "running" || run.status === "pending") && "text-yellow-400",
                                  run.status === "failed" && "text-red-400"
                                )}
                              >
                                {run.status}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-muted-foreground">
                            {formatRelativeTime(run.startedAt)}
                          </td>
                          <td className="py-3 px-2 text-muted-foreground">
                            {formatDuration(run.durationMs)}
                          </td>
                          <td className="py-3 px-2">
                            <code className="text-xs bg-secondary px-2 py-1 rounded">
                              {run.runId.slice(0, 8)}...
                            </code>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* System Warm-Up Status */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">System Warm-Up Status</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Lane A Status */}
              <div className="rounded-lg bg-secondary/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">Lane A Discovery</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {warmUp?.laneA ? (
                    <>
                      Last run: {formatDate(warmUp.laneA.completedAt || warmUp.laneA.runDate)}
                      <br />
                      Status: <span className={warmUp.laneA.status === "completed" ? "text-emerald-400" : "text-yellow-400"}>
                        {warmUp.laneA.status}
                      </span>
                    </>
                  ) : (
                    "No runs yet"
                  )}
                </p>
              </div>

              {/* Lane B Status */}
              <div className="rounded-lg bg-secondary/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-purple-500" />
                  <span className="font-medium">Lane B Research</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {warmUp?.laneB ? (
                    <>
                      Last packet: {formatDate(warmUp.laneB.completedAt || warmUp.laneB.runDate)}
                      <br />
                      Status: <span className={warmUp.laneB.status === "completed" ? "text-emerald-400" : "text-yellow-400"}>
                        {warmUp.laneB.status}
                      </span>
                    </>
                  ) : (
                    "No packets yet"
                  )}
                </p>
              </div>

              {/* QA Status */}
              <div className="rounded-lg bg-secondary/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  <span className="font-medium">QA Report</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {warmUp?.qa ? (
                    <>
                      Last report: {formatDate(warmUp.qa.completedAt || warmUp.qa.runDate)}
                      <br />
                      Status: <span className={warmUp.qa.status === "completed" ? "text-emerald-400" : "text-yellow-400"}>
                        {warmUp.qa.status}
                      </span>
                    </>
                  ) : (
                    "No reports yet"
                  )}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
