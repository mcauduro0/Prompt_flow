"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Activity, CheckCircle, AlertCircle, Database, Cpu, Zap } from "lucide-react";
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

const formatShortDateTime = (dateStr: string | null): string => {
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
                    <div className="grid grid-cols-3 gap-6">
                      {/* Lane A */}
                      <div className="text-center">
                        <div className="text-sm font-medium text-foreground mb-1">Lane A</div>
                        <div className="text-xs text-muted-foreground">
                          {warmUp?.laneA ? (
                            formatShortDateTime(warmUp.laneA.completedAt || warmUp.laneA.runDate)
                          ) : (
                            "No runs yet"
                          )}
                        </div>
                      </div>
                      
                      {/* Lane B */}
                      <div className="text-center">
                        <div className="text-sm font-medium text-foreground mb-1">Lane B</div>
                        <div className="text-xs text-muted-foreground">
                          {warmUp?.laneB ? (
                            formatShortDateTime(warmUp.laneB.completedAt || warmUp.laneB.runDate)
                          ) : (
                            "No runs yet"
                          )}
                        </div>
                      </div>
                      
                      {/* QA */}
                      <div className="text-center">
                        <div className="text-sm font-medium text-foreground mb-1">QA Report</div>
                        <div className="text-xs text-muted-foreground">
                          {warmUp?.qa ? (
                            formatShortDateTime(warmUp.qa.completedAt || warmUp.qa.runDate)
                          ) : (
                            "No runs yet"
                          )}
                        </div>
                      </div>
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
