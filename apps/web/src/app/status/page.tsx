"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Activity, CheckCircle, AlertCircle, Clock, Database, Cpu, Zap, FileText, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

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

const formatRelativeTime = (dateStr: string | null): string => {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function StatusPage() {
  const [status, setStatus] = useState<any>(null);
  const [warmUp, setWarmUp] = useState<WarmUpStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [healthRes, warmUpRes] = await Promise.all([
          fetch("/api/health"),
          fetch("/api/runs/warmup-status"),
        ]);

        if (healthRes.ok) {
          const data = await healthRes.json();
          setStatus({
            api: "healthy",
            database: data.services?.database === "connected" ? "healthy" : "down",
            worker: "healthy",
            ...data,
          });
        } else {
          setStatus({ api: "degraded", database: "down", worker: "down" });
        }

        if (warmUpRes.ok) {
          const warmUpData = await warmUpRes.json();
          setWarmUp(warmUpData);
        }
      } catch {
        setStatus({ api: "down", database: "down", worker: "down" });
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const StatusIcon = ({ s }: { s: string }) => {
    if (s === "healthy") return <CheckCircle className="w-5 h-5 text-success" />;
    if (s === "degraded") return <AlertCircle className="w-5 h-5 text-warning" />;
    return <AlertCircle className="w-5 h-5 text-fail" />;
  };

  const WarmUpItem = ({
    icon: Icon,
    label,
    data,
    summaryKey,
  }: {
    icon: any;
    label: string;
    data: WarmUpStatus["laneA"];
    summaryKey?: string;
  }) => {
    const hasRun = data !== null;
    const isSuccess = data?.status === "completed";
    const summaryValue = summaryKey && data?.summary ? data.summary[summaryKey] : null;

    return (
      <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50 border border-border/50">
        <div
          className={cn(
            "p-2 rounded-lg",
            hasRun && isSuccess ? "bg-success/20" : hasRun ? "bg-warning/20" : "bg-muted"
          )}
        >
          <Icon
            className={cn(
              "w-5 h-5",
              hasRun && isSuccess
                ? "text-success"
                : hasRun
                ? "text-warning"
                : "text-muted-foreground"
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{label}</span>
            {hasRun && (
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded",
                  isSuccess ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
                )}
              >
                {data.status}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {hasRun ? (
              <>
                {formatRelativeTime(data.completedAt || data.runDate)}
                {summaryValue !== null && (
                  <span className="ml-2 text-foreground/70">• {summaryValue} items</span>
                )}
              </>
            ) : (
              "No runs yet"
            )}
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {hasRun && formatDateTime(data.completedAt || data.runDate)}
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        <header className="page-header">
          <h1 className="page-header-title">System Status</h1>
          <p className="page-header-subtitle">Real-time health monitoring and pipeline status</p>
        </header>
        <main className="flex-1 p-8">
          <div className="content-area">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-pulse text-muted-foreground">Loading...</div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* System Warm-Up Status Banner */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5 text-accent" />
                    <h2 className="text-section-title">System Warm-Up Status</h2>
                  </div>
                  <div className="governance-card">
                    <div className="grid md:grid-cols-3 gap-4">
                      <WarmUpItem
                        icon={Activity}
                        label="Lane A (Discovery)"
                        data={warmUp?.laneA || null}
                        summaryKey="ideasGenerated"
                      />
                      <WarmUpItem
                        icon={FileText}
                        label="Lane B (Research)"
                        data={warmUp?.laneB || null}
                        summaryKey="packetsCompleted"
                      />
                      <WarmUpItem
                        icon={Shield}
                        label="QA Report"
                        data={warmUp?.qa || null}
                      />
                    </div>
                    <div className="mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground text-center">
                      Last updated: {new Date().toLocaleTimeString()} • Auto-refreshes every 30s
                    </div>
                  </div>
                </section>

                {/* Service Health */}
                <section>
                  <h2 className="text-section-title mb-4">Service Health</h2>
                  <div className="grid md:grid-cols-3 gap-4">
                    {[
                      { name: "API Server", s: status?.api, icon: Activity },
                      { name: "Database", s: status?.database, icon: Database },
                      { name: "Worker", s: status?.worker, icon: Cpu },
                    ].map((svc) => (
                      <div key={svc.name} className="governance-card flex items-center gap-4">
                        <svc.icon className="w-8 h-8 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">{svc.name}</div>
                          <div
                            className={cn(
                              "text-sm capitalize",
                              svc.s === "healthy" && "text-success",
                              svc.s === "degraded" && "text-warning",
                              svc.s === "down" && "text-fail"
                            )}
                          >
                            {svc.s || "unknown"}
                          </div>
                        </div>
                        <StatusIcon s={svc.s || "down"} />
                      </div>
                    ))}
                  </div>
                </section>

                {/* Scheduled Jobs */}
                <section>
                  <h2 className="text-section-title mb-4">Scheduled Jobs</h2>
                  <div className="governance-card">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-muted-foreground border-b border-border">
                          <th className="pb-3">Job</th>
                          <th className="pb-3">Schedule</th>
                          <th className="pb-3">Timezone</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        <tr className="border-b border-border/50">
                          <td className="py-3">Lane A (Discovery)</td>
                          <td className="py-3 font-mono text-muted-foreground">06:00 Mon-Fri</td>
                          <td className="py-3 text-muted-foreground">America/Sao_Paulo</td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="py-3">Lane B (Research)</td>
                          <td className="py-3 font-mono text-muted-foreground">08:00 Mon-Fri</td>
                          <td className="py-3 text-muted-foreground">America/Sao_Paulo</td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="py-3">Weekly QA Report</td>
                          <td className="py-3 font-mono text-muted-foreground">18:00 Friday</td>
                          <td className="py-3 text-muted-foreground">America/Sao_Paulo</td>
                        </tr>
                        <tr>
                          <td className="py-3">IC Bundle</td>
                          <td className="py-3 font-mono text-muted-foreground">19:00 Friday</td>
                          <td className="py-3 text-muted-foreground">America/Sao_Paulo</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
