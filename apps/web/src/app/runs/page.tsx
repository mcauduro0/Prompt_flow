"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Activity, CheckCircle, XCircle, Clock, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RunsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { const fetchRuns = async () => { try { const res = await fetch("/api/runs"); if (res.ok) { const data = await res.json(); setRuns(data.runs || []); } } catch (err) { console.error(err); } finally { setLoading(false); } }; fetchRuns(); }, []);

  const StatusIcon = ({ status }: { status: string }) => { if (status === "completed") return <CheckCircle className="w-5 h-5 text-success" />; if (status === "failed") return <XCircle className="w-5 h-5 text-fail" />; if (status === "running") return <PlayCircle className="w-5 h-5 text-accent animate-pulse" />; return <Clock className="w-5 h-5 text-muted-foreground" />; };
  const typeLabels: Record<string, string> = { daily_discovery: "Lane A Discovery", daily_lane_b: "Lane B Research", weekly_qa: "QA Report", weekly_ic_bundle: "IC Bundle" };

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        <header className="page-header"><h1 className="page-header-title">Run History</h1><p className="page-header-subtitle">Audit trail of all pipeline executions</p></header>
        <main className="flex-1 p-8">
          <div className="content-area">
            {loading ? (<div className="flex items-center justify-center py-20"><div className="animate-pulse text-muted-foreground">Loading runs...</div></div>
            ) : runs.length === 0 ? (<div className="text-center py-20 text-muted-foreground"><p>No runs recorded yet</p><p className="text-sm mt-2">Pipeline executions will appear here</p></div>
            ) : (
              <div className="space-y-4">{runs.map((run, idx) => (<div key={run.id} className={cn("governance-card animate-fade-in", run.status === "failed" && "border-fail/30")} style={{ animationDelay: `${idx * 30}ms` }}><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-4"><StatusIcon status={run.status} /><div><div className="flex items-center gap-2"><Activity className="w-4 h-4 text-accent" /><span className="font-medium">{typeLabels[run.type] || run.type}</span></div><div className="text-sm text-muted-foreground">Run ID: {run.id.slice(0, 8)}...</div></div></div><div className="text-right"><div className={cn("text-sm font-medium capitalize", run.status === "completed" ? "text-success" : run.status === "failed" ? "text-fail" : "text-muted-foreground")}>{run.status}</div><div className="text-xs text-muted-foreground">{new Date(run.started_at).toLocaleString()}</div>{run.duration_ms && <div className="text-xs text-muted-foreground">{(run.duration_ms / 1000).toFixed(1)}s</div>}</div></div>{run.summary && (<div className="mt-3 pt-3 border-t border-border"><div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">{run.summary.ideas_generated !== undefined && <div><span className="text-muted-foreground">Ideas Generated:</span> <span className="font-medium">{run.summary.ideas_generated}</span></div>}{run.summary.ideas_passed !== undefined && <div><span className="text-muted-foreground">Passed Gates:</span> <span className="font-medium">{run.summary.ideas_passed}</span></div>}</div></div>)}{run.error && (<div className="mt-3 p-3 bg-fail/10 rounded-md"><div className="text-xs text-fail font-medium mb-1">Error</div><div className="text-sm text-muted-foreground font-mono">{run.error}</div></div>)}</div>))}</div>
            )}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
