"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Activity, CheckCircle, AlertCircle, Clock, Database, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StatusPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          setStatus({ api: "healthy", database: data.database ? "healthy" : "down", worker: "healthy", ...data });
        } else {
          setStatus({ api: "degraded", database: "down", worker: "down" });
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
              <div className="flex items-center justify-center py-20"><div className="animate-pulse text-muted-foreground">Loading...</div></div>
            ) : (
              <div className="space-y-8">
                <section>
                  <h2 className="text-section-title mb-4">Service Health</h2>
                  <div className="grid md:grid-cols-3 gap-4">
                    {[{ name: "API Server", s: status?.api, icon: Activity }, { name: "Database", s: status?.database, icon: Database }, { name: "Worker", s: status?.worker, icon: Cpu }].map((svc) => (
                      <div key={svc.name} className="governance-card flex items-center gap-4">
                        <svc.icon className="w-8 h-8 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">{svc.name}</div>
                          <div className={cn("text-sm capitalize", svc.s === "healthy" && "text-success", svc.s === "degraded" && "text-warning", svc.s === "down" && "text-fail")}>{svc.s || "unknown"}</div>
                        </div>
                        <StatusIcon s={svc.s || "down"} />
                      </div>
                    ))}
                  </div>
                </section>
                <section>
                  <h2 className="text-section-title mb-4">Scheduled Jobs</h2>
                  <div className="governance-card">
                    <table className="w-full"><thead><tr className="text-left text-sm text-muted-foreground border-b border-border"><th className="pb-3">Job</th><th className="pb-3">Schedule</th><th className="pb-3">Timezone</th></tr></thead>
                      <tbody className="text-sm">
                        <tr className="border-b border-border/50"><td className="py-3">Lane A (Discovery)</td><td className="py-3 font-mono text-muted-foreground">06:00 Mon-Fri</td><td className="py-3 text-muted-foreground">America/Sao_Paulo</td></tr>
                        <tr className="border-b border-border/50"><td className="py-3">Lane B (Research)</td><td className="py-3 font-mono text-muted-foreground">08:00 Mon-Fri</td><td className="py-3 text-muted-foreground">America/Sao_Paulo</td></tr>
                        <tr className="border-b border-border/50"><td className="py-3">Weekly QA Report</td><td className="py-3 font-mono text-muted-foreground">18:00 Friday</td><td className="py-3 text-muted-foreground">America/Sao_Paulo</td></tr>
                        <tr><td className="py-3">IC Bundle</td><td className="py-3 font-mono text-muted-foreground">19:00 Friday</td><td className="py-3 text-muted-foreground">America/Sao_Paulo</td></tr>
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
