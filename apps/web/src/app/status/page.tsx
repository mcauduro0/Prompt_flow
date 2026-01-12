"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Activity, CheckCircle, AlertCircle, Database, Cpu } from "lucide-react";
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
            api: "operational",
            database: data.services?.database === "connected" ? "operational" : "unavailable",
            worker: "operational",
            ...data,
          });
        } else {
          setStatus({ api: "degraded", database: "unavailable", worker: "unavailable" });
        }

        if (warmUpRes.ok) {
          const warmUpData = await warmUpRes.json();
          setWarmUp(warmUpData);
        }
      } catch {
        setStatus({ api: "unavailable", database: "unavailable", worker: "unavailable" });
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const StatusIndicator = ({ s }: { s: string }) => {
    if (s === "operational") return <CheckCircle className="w-4 h-4 text-success" />;
    if (s === "degraded") return <AlertCircle className="w-4 h-4 text-warning" />;
    return <AlertCircle className="w-4 h-4 text-fail" />;
  };

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        <header className="page-header">
          <h1 className="page-header-title">System Status</h1>
          <p className="page-header-subtitle">Operational state and scheduled runs</p>
        </header>
        <main className="flex-1 p-8">
          <div className="content-area">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-muted-foreground">Loading status...</div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Last Run Summary */}
                <section>
                  <h2 className="text-section-title mb-4">Last Completed Runs</h2>
                  <div className="governance-card">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="pb-3 font-medium">Pipeline</th>
                          <th className="pb-3 font-medium">Last Run</th>
                          <th className="pb-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border/50">
                          <td className="py-3">Lane A</td>
                          <td className="py-3 text-muted-foreground">
                            {warmUp?.laneA 
                              ? formatDateTime(warmUp.laneA.completedAt || warmUp.laneA.runDate)
                              : "No runs recorded"}
                          </td>
                          <td className="py-3">
                            {warmUp?.laneA ? (
                              <span className={cn(
                                warmUp.laneA.status === "completed" ? "text-success" : "text-warning"
                              )}>
                                {warmUp.laneA.status}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="py-3">Lane B</td>
                          <td className="py-3 text-muted-foreground">
                            {warmUp?.laneB 
                              ? formatDateTime(warmUp.laneB.completedAt || warmUp.laneB.runDate)
                              : "No runs recorded"}
                          </td>
                          <td className="py-3">
                            {warmUp?.laneB ? (
                              <span className={cn(
                                warmUp.laneB.status === "completed" ? "text-success" : "text-warning"
                              )}>
                                {warmUp.laneB.status}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3">QA Report</td>
                          <td className="py-3 text-muted-foreground">
                            {warmUp?.qa 
                              ? formatDateTime(warmUp.qa.completedAt || warmUp.qa.runDate)
                              : "No runs recorded"}
                          </td>
                          <td className="py-3">
                            {warmUp?.qa ? (
                              <span className={cn(
                                warmUp.qa.status === "completed" ? "text-success" : "text-warning"
                              )}>
                                {warmUp.qa.status}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Service Status */}
                <section>
                  <h2 className="text-section-title mb-4">Service Status</h2>
                  <div className="governance-card">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="pb-3 font-medium">Service</th>
                          <th className="pb-3 font-medium">State</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { name: "API Server", s: status?.api, icon: Activity },
                          { name: "Database", s: status?.database, icon: Database },
                          { name: "Worker", s: status?.worker, icon: Cpu },
                        ].map((svc, idx) => (
                          <tr key={svc.name} className={idx < 2 ? "border-b border-border/50" : ""}>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <svc.icon className="w-4 h-4 text-muted-foreground" />
                                {svc.name}
                              </div>
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <StatusIndicator s={svc.s || "unavailable"} />
                                <span className={cn(
                                  "capitalize",
                                  svc.s === "operational" && "text-success",
                                  svc.s === "degraded" && "text-warning",
                                  (!svc.s || svc.s === "unavailable") && "text-fail"
                                )}>
                                  {svc.s || "unavailable"}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Scheduled Runs */}
                <section>
                  <h2 className="text-section-title mb-4">Scheduled Runs</h2>
                  <div className="governance-card">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="pb-3 font-medium">Job</th>
                          <th className="pb-3 font-medium">Schedule</th>
                          <th className="pb-3 font-medium">Timezone</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border/50">
                          <td className="py-3">Lane A Discovery</td>
                          <td className="py-3 font-mono text-muted-foreground">06:00 Mon–Fri</td>
                          <td className="py-3 text-muted-foreground">America/Sao_Paulo</td>
                        </tr>
                        <tr className="border-b border-border/50">
                          <td className="py-3">Lane B Research</td>
                          <td className="py-3 font-mono text-muted-foreground">08:00 Mon–Fri</td>
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
