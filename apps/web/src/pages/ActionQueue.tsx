import { Clock, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ResearchStatus = "queued" | "researching" | "synthesizing" | "complete";

interface QueueItem {
  id: string;
  company: string;
  ticker: string;
  status: ResearchStatus;
  startedAt?: string;
  estimatedCompletion?: string;
  progress?: number;
}

const queueItems: QueueItem[] = [
  {
    id: "1",
    company: "Constellation Software",
    ticker: "CSU.TO",
    status: "synthesizing",
    startedAt: "2 hours ago",
    progress: 85,
  },
  {
    id: "2",
    company: "Dino Polska",
    ticker: "DNP.WA",
    status: "researching",
    startedAt: "45 minutes ago",
    progress: 40,
  },
  {
    id: "3",
    company: "Judges Scientific",
    ticker: "JDG.L",
    status: "queued",
    estimatedCompletion: "Queued for review",
  },
];

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

export default function ActionQueue() {
  const activeCount = queueItems.filter(i => i.status !== "complete").length;

  return (
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
          {/* Status message - Neutral, no urgency */}
          <div className="text-center mb-10 animate-fade-in">
            <p className="text-muted-foreground">
              Research proceeding. No action required.
            </p>
          </div>

          {/* Queue list */}
          <div className="space-y-4">
            {queueItems.map((item, index) => (
              <QueueCard 
                key={item.id} 
                item={item} 
                index={index}
              />
            ))}
          </div>

          {/* Empty state */}
          {queueItems.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No active research.</p>
              <p className="text-sm text-muted-foreground/60 mt-2">
                Promote ideas from Inbox to queue research.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

interface QueueCardProps {
  item: QueueItem;
  index: number;
}

function QueueCard({ item, index }: QueueCardProps) {
  const config = statusConfig[item.status];
  const Icon = config.icon;

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
            <h3 className="text-base font-medium text-foreground">{item.company}</h3>
            <span className="text-sm font-mono text-muted-foreground/70">{item.ticker}</span>
          </div>
          
          <p className="text-sm text-muted-foreground">
            {item.startedAt && `Started ${item.startedAt}`}
            {item.estimatedCompletion && item.estimatedCompletion}
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
      {item.progress !== undefined && (
        <div>
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent/60 rounded-full transition-all duration-deliberate"
              style={{ width: `${item.progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground/60 mt-2 text-right">
            {item.progress}%
          </p>
        </div>
      )}
    </div>
  );
}
