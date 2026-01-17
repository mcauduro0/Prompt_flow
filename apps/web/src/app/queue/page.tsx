"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { Clock, Loader2, CheckCircle2, Sparkles, Play, PlayCircle } from "lucide-react";

type ResearchStatus = "queued" | "researching" | "synthesizing" | "complete";

interface QueueItem {
  id: string;
  ticker: string;
  company_name: string;
  status: ResearchStatus;
  research_progress: number;
  started_at?: string;
  has_research_packet: boolean;
}

const statusConfig: Record<ResearchStatus, { label: string; icon: typeof Clock; animate?: boolean }> = {
  queued: { label: "Queued", icon: Clock },
  researching: { label: "Researching", icon: Loader2, animate: true },
  synthesizing: { label: "Synthesizing", icon: Sparkles, animate: true },
  complete: { label: "Completed", icon: CheckCircle2 },
};

const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) return "Just started";
  if (diffMins < 60) return `${diffMins} minutes ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return "1 hour ago";
  return `${diffHours} hours ago`;
};

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingResearch, setStartingResearch] = useState<string | null>(null);
  const [startingAll, setStartingAll] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchQueue = async () => {
    try {
      const res = await fetch("/api/ideas?status=promoted");
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.ideas || []).map((i: any) => {
          let status: ResearchStatus = "queued";
          if (i.research_status === "completed" || i.research_progress >= 100) {
            status = "complete";
          } else if (i.research_progress >= 80) {
            status = "synthesizing";
          } else if (i.research_progress > 0) {
            status = "researching";
          }
          return {
            ...i,
            status,
            research_progress: i.research_progress || 0,
          };
        });
        setItems(mapped);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  const startResearch = async (ideaId: string) => {
    setStartingResearch(ideaId);
    setMessage(null);
    try {
      const res = await fetch("/api/research/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaIds: [ideaId], maxPackets: 1 }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: `Research started for idea. Run ID: ${data.runId}` });
        // Refresh the queue
        await fetchQueue();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to start research' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to start research' });
    } finally {
      setStartingResearch(null);
    }
  };

  const startAllResearch = async () => {
    setStartingAll(true);
    setMessage(null);
    try {
      const res = await fetch("/api/research/start-all-queued", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPackets: 10 }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: `Research started for ${data.ideaIds?.length || 0} ideas. Run ID: ${data.runId}` });
        // Refresh the queue
        await fetchQueue();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to start research' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to start research' });
    } finally {
      setStartingAll(false);
    }
  };

  const activeCount = items.filter(i => i.status !== "complete").length;
  const queuedCount = items.filter(i => i.status === "queued").length;
  const completedCount = items.filter(i => i.status === "complete").length;

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-baseline gap-3">
                  <h1 className="text-2xl font-medium text-foreground tracking-tight">
                    Action Queue
                  </h1>
                  <span className="text-sm text-muted-foreground">
                    {activeCount} active • {completedCount} completed
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Research in progress
                </p>
              </div>
              
              {/* Start All Button */}
              {queuedCount > 0 && (
                <button
                  onClick={startAllResearch}
                  disabled={startingAll}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-calm",
                    "bg-accent text-accent-foreground hover:bg-accent/90",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {startingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4" />
                      Start All Research ({queuedCount})
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Message Banner */}
        {message && (
          <div className={cn(
            "px-8 py-3 text-sm",
            message.type === 'success' ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {message.text}
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 py-10">
          <div className="max-w-2xl mx-auto px-8">
            {loading ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground animate-pulse-calm">Loading queue...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 animate-fade-in">
                <p className="text-muted-foreground">No active research.</p>
                <p className="text-sm text-muted-foreground/60 mt-2">
                  Promote ideas from Inbox to queue research.
                </p>
              </div>
            ) : (
              <>
                {/* Status message */}
                <div className="text-center mb-10 animate-fade-in">
                  <p className="text-muted-foreground">
                    {queuedCount > 0 
                      ? `${queuedCount} ideas queued for research. Click "Start Research" to begin.`
                      : activeCount > 0 
                        ? "Research proceeding. No action required."
                        : "All research complete."
                    }
                  </p>
                </div>

                {/* Queue list */}
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <QueueCard
                      key={item.id}
                      item={item}
                      index={index}
                      onStartResearch={startResearch}
                      isStarting={startingResearch === item.id}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}

interface QueueCardProps {
  item: QueueItem;
  index: number;
  onStartResearch: (ideaId: string) => void;
  isStarting: boolean;
}

function QueueCard({ item, index, onStartResearch, isStarting }: QueueCardProps) {
  const config = statusConfig[item.status];
  const Icon = config.icon;
  const progress = item.research_progress || 0;

  return (
    <div
      className={cn(
        "p-6 rounded-md bg-card border border-border/60 animate-fade-in transition-calm",
        "hover:border-border"
      )}
      style={{ animationDelay: `${(index + 1) * 75}ms` }}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-baseline gap-2.5 mb-1">
            <h3 className="text-base font-medium text-foreground">{item.company_name}</h3>
            <span className="text-sm font-mono text-muted-foreground/70">{item.ticker}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {item.started_at 
              ? `Started ${formatRelativeTime(item.started_at)}`
              : item.status === "complete" ? "Research complete" : item.status === "queued" 
                ? "Queued for review"
                : "Processing..."
            }
          </p>
        </div>

        {/* Status and Action */}
        <div className="flex items-center gap-3">
          {/* Start Research Button for Queued items */}
          {item.status === "queued" && (
            <button
              onClick={() => onStartResearch(item.id)}
              disabled={isStarting}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-calm",
                "bg-accent/10 text-accent hover:bg-accent/20",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  Start Research
                </>
              )}
            </button>
          )}

          {/* Status Badge */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon className={cn(
              "h-4 w-4",
              config.animate && "animate-spin",
              item.status === "complete" && "text-success"
            )} />
            <span>{config.label}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {item.status !== "queued" && (
        <div>
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                item.status === "complete" ? "bg-success" : "bg-accent/60"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground/60 mt-2 text-right">
            {progress}%
          </p>
        </div>
      )}
    </div>
  );
}
