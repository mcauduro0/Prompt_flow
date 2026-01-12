"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Clock, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ResearchStatus = "queued" | "researching" | "synthesizing" | "complete";

interface QueueItem {
  id: string;
  ticker: string;
  company_name: string;
  style: string;
  status: ResearchStatus;
  research_status?: string;
  research_progress?: number;
  started_at?: string;
}

const statusConfig: Record<ResearchStatus, {
  icon: typeof Clock;
  label: string;
  animate?: boolean;
}> = {
  queued: {
    icon: Clock,
    label: "Queued",
    animate: false,
  },
  researching: {
    icon: Loader2,
    label: "Research in progress",
    animate: true,
  },
  synthesizing: {
    icon: FileText,
    label: "Awaiting synthesis",
    animate: true,
  },
  complete: {
    icon: CheckCircle2,
    label: "Complete",
    animate: false,
  },
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

  useEffect(() => {
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
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeCount = items.filter(i => i.status !== "complete").length;

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border">
          <div className="px-8 py-6">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-medium text-foreground tracking-tight">
                Action Queue
              </h1>
              <span className="text-sm text-muted-foreground">
                {activeCount} active
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Research in progress
            </p>
          </div>
        </header>

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
                {/* Status message - Neutral, no urgency */}
                <div className="text-center mb-10 animate-fade-in">
                  <p className="text-muted-foreground">
                    {activeCount > 0 
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
}

function QueueCard({ item, index }: QueueCardProps) {
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
              : item.status === "queued" 
                ? "Queued for review"
                : "Processing..."
            }
          </p>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className={cn(
            "h-4 w-4",
            config.animate && "animate-spin",
            item.status === "complete" && "text-success"
          )} />
          <span>{config.label}</span>
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
