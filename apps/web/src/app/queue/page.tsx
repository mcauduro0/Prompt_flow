"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Clock, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function QueuePage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const res = await fetch("/api/ideas?status=promoted");
        if (res.ok) { const data = await res.json(); setItems(data.ideas?.map((i: any) => ({ ...i, status: i.research_status || "queued", progress: i.research_progress || 0 })) || []); }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "completed") return <CheckCircle className="w-5 h-5 text-success" />;
    if (status === "in_progress") return <Loader2 className="w-5 h-5 text-accent animate-spin" />;
    return <Clock className="w-5 h-5 text-muted-foreground" />;
  };

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        <header className="page-header"><h1 className="page-header-title">Research Queue</h1><p className="page-header-subtitle">{items.length} ideas in Lane B pipeline</p></header>
        <main className="flex-1 p-8">
          <div className="content-area">
            {loading ? (<div className="flex items-center justify-center py-20"><div className="animate-pulse text-muted-foreground">Loading queue...</div></div>
            ) : items.length === 0 ? (<div className="text-center py-20 text-muted-foreground"><p>No ideas in research queue</p><p className="text-sm mt-2">Promote ideas from the inbox to start research</p></div>
            ) : (
              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div key={item.id} className="governance-card animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <StatusIcon status={item.status} />
                        <div><div className="flex items-center gap-2"><span className="font-mono font-medium">{item.ticker}</span><span className="text-xs text-accent uppercase">{item.style?.replace("_", " ")}</span></div><div className="text-sm text-muted-foreground">{item.company_name}</div></div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-32"><div className="flex items-center justify-between text-xs mb-1"><span className="text-muted-foreground capitalize">{item.status.replace("_", " ")}</span><span>{item.progress}%</span></div><div className="h-1.5 bg-secondary rounded-full overflow-hidden"><div className={cn("h-full rounded-full transition-all", item.status === "completed" ? "bg-success" : "bg-accent")} style={{ width: `${item.progress}%` }} /></div></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
