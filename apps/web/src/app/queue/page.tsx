"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { Clock, Loader2, CheckCircle2, Sparkles, Play, PlayCircle, AlertCircle, RefreshCw } from "lucide-react";

type ResearchStatus = "queued" | "starting" | "researching" | "synthesizing" | "complete" | "error";

interface QueueItem {
  id: string;
  ticker: string;
  company_name: string;
  status: ResearchStatus;
  research_progress: number;
  started_at?: string;
  has_research_packet: boolean;
  current_agent?: string;
}

const statusConfig: Record<ResearchStatus, { label: string; icon: typeof Clock; animate?: boolean; color?: string }> = {
  queued: { label: "Queued", icon: Clock },
  starting: { label: "Starting...", icon: Loader2, animate: true, color: "text-yellow-500" },
  researching: { label: "Researching", icon: Loader2, animate: true, color: "text-accent" },
  synthesizing: { label: "Synthesizing", icon: Sparkles, animate: true, color: "text-purple-500" },
  complete: { label: "Completed", icon: CheckCircle2, color: "text-success" },
  error: { label: "Error", icon: AlertCircle, color: "text-destructive" },
};

const agentNames: Record<string, string> = {
  business_model: "Business Model Agent",
  industry_moat: "Industry & Moat Agent",
  valuation: "Valuation Agent",
  financial_forensics: "Financial Forensics Agent",
  capital_allocation: "Capital Allocation Agent",
  management_quality: "Management Quality Agent",
  risk_stress: "Risk & Stress Agent",
  synthesis: "Synthesis",
};

const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) return "Just started";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return "1h ago";
  return `${diffHours}h ago`;
};

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingResearch, setStartingResearch] = useState<Set<string>>(new Set());
  const [startingAll, setStartingAll] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/ideas?status=promoted&limit=500");
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.ideas || []).map((i: any) => {
          let status: ResearchStatus = "queued";
          
          // Check if this item is currently being started
          if (startingResearch.has(i.ideaId)) {
            status = "starting";
          } else if (i.research_status === "completed" || i.research_progress >= 100) {
            status = "complete";
          } else if (i.research_status === "error") {
            status = "error";
          } else if (i.research_progress >= 80) {
            status = "synthesizing";
          } else if (i.research_progress > 0 || i.research_status === "in_progress") {
            status = "researching";
          }
          
          return {
            ...i,
            id: i.ideaId,
            status,
            research_progress: i.research_progress || 0,
            current_agent: i.current_agent,
          };
        });
        setItems(mapped);
        setLastRefresh(new Date());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startingResearch]);

  useEffect(() => {
    fetchQueue();
    // Poll more frequently (every 5 seconds) when there are active items
    const hasActiveItems = items.some(i => 
      i.status === "starting" || i.status === "researching" || i.status === "synthesizing"
    );
    const interval = setInterval(fetchQueue, hasActiveItems ? 5000 : 10000);
    return () => clearInterval(interval);
  }, [fetchQueue, items.length]);

  const startResearch = async (ideaId: string, ticker: string) => {
    // Immediately update UI to show starting state
    setStartingResearch(prev => new Set(prev).add(ideaId));
    setItems(prev => prev.map(item => 
      item.id === ideaId ? { ...item, status: "starting" as ResearchStatus } : item
    ));
    setMessage(null);
    
    try {
      const res = await fetch("/api/research/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaIds: [ideaId], maxPackets: 1 }),
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: `Research started for ${ticker}. Processing will begin shortly.` });
        // Update to researching state
        setItems(prev => prev.map(item => 
          item.id === ideaId ? { ...item, status: "researching" as ResearchStatus, research_progress: 5 } : item
        ));
        // Keep polling to track progress
        setTimeout(() => {
          setStartingResearch(prev => {
            const next = new Set(prev);
            next.delete(ideaId);
            return next;
          });
        }, 3000);
      } else {
        setMessage({ type: 'error', text: data.error || `Failed to start research for ${ticker}` });
        // Revert to queued state on error
        setItems(prev => prev.map(item => 
          item.id === ideaId ? { ...item, status: "queued" as ResearchStatus } : item
        ));
        setStartingResearch(prev => {
          const next = new Set(prev);
          next.delete(ideaId);
          return next;
        });
      }
    } catch (err) {
      setMessage({ type: 'error', text: `Failed to start research for ${ticker}` });
      // Revert to queued state on error
      setItems(prev => prev.map(item => 
        item.id === ideaId ? { ...item, status: "queued" as ResearchStatus } : item
      ));
      setStartingResearch(prev => {
        const next = new Set(prev);
        next.delete(ideaId);
        return next;
      });
    }
  };

  const startAllResearch = async () => {
    setStartingAll(true);
    setMessage(null);
    
    // Get all queued items
    const queuedItems = items.filter(i => i.status === "queued");
    
    // Immediately update UI for all queued items
    setItems(prev => prev.map(item => 
      item.status === "queued" ? { ...item, status: "starting" as ResearchStatus } : item
    ));
    
    try {
      const res = await fetch("/api/research/start-all-queued", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPackets: 50 }),
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        const count = data.ideaIds?.length || queuedItems.length;
        setMessage({ type: 'success', text: `Research started for ${count} ideas. Processing will begin shortly.` });
        // Update all to researching
        setItems(prev => prev.map(item => 
          item.status === "starting" ? { ...item, status: "researching" as ResearchStatus, research_progress: 5 } : item
        ));
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to start research' });
        // Revert to queued
        setItems(prev => prev.map(item => 
          item.status === "starting" ? { ...item, status: "queued" as ResearchStatus } : item
        ));
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to start research' });
      // Revert to queued
      setItems(prev => prev.map(item => 
        item.status === "starting" ? { ...item, status: "queued" as ResearchStatus } : item
      ));
    } finally {
      setStartingAll(false);
    }
  };

  const activeCount = items.filter(i => i.status !== "complete" && i.status !== "queued").length;
  const queuedCount = items.filter(i => i.status === "queued").length;
  const completedCount = items.filter(i => i.status === "complete").length;
  const inProgressCount = items.filter(i => 
    i.status === "starting" || i.status === "researching" || i.status === "synthesizing"
  ).length;

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
                    Research Queue
                  </h1>
                  <span className="text-sm text-muted-foreground">
                    {queuedCount} queued • {inProgressCount} in progress • {completedCount} completed
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Lane B Deep Research Pipeline
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Refresh Button */}
                <button
                  onClick={fetchQueue}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground transition-calm"
                  title={`Last refresh: ${lastRefresh.toLocaleTimeString()}`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
                
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
                        Start All ({queuedCount})
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Message Banner */}
        {message && (
          <div className={cn(
            "px-8 py-3 text-sm flex items-center gap-2 animate-fade-in",
            message.type === 'success' ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {message.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {message.text}
            <button 
              onClick={() => setMessage(null)}
              className="ml-auto text-xs opacity-60 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 py-10">
          <div className="max-w-2xl mx-auto px-8">
            {loading ? (
              <div className="text-center py-16">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">Loading queue...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 animate-fade-in">
                <Clock className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">No ideas in queue.</p>
                <p className="text-sm text-muted-foreground/60 mt-2">
                  Promote ideas from Inbox to start research.
                </p>
              </div>
            ) : (
              <>
                {/* Status Summary */}
                {inProgressCount > 0 && (
                  <div className="mb-8 p-4 rounded-lg bg-accent/5 border border-accent/20 animate-fade-in">
                    <div className="flex items-center gap-2 text-accent">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm font-medium">
                        {inProgressCount} research{inProgressCount > 1 ? 'es' : ''} in progress
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-refreshing every 5 seconds. Results will appear in the Research tab.
                    </p>
                  </div>
                )}

                {/* Queue list */}
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <QueueCard
                      key={item.id}
                      item={item}
                      index={index}
                      onStartResearch={startResearch}
                      isStarting={startingResearch.has(item.id)}
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
  onStartResearch: (ideaId: string, ticker: string) => void;
  isStarting: boolean;
}

function QueueCard({ item, index, onStartResearch, isStarting }: QueueCardProps) {
  const config = statusConfig[item.status];
  const Icon = config.icon;
  const progress = item.research_progress || 0;

  // Determine current step based on progress
  const getCurrentStep = () => {
    if (progress < 15) return "Business Model Agent";
    if (progress < 30) return "Industry & Moat Agent";
    if (progress < 45) return "Valuation Agent";
    if (progress < 55) return "Financial Forensics Agent";
    if (progress < 70) return "Capital Allocation Agent";
    if (progress < 80) return "Management Quality Agent";
    if (progress < 90) return "Risk & Stress Agent";
    return "Synthesis";
  };

  return (
    <div
      className={cn(
        "p-6 rounded-md bg-card border transition-all duration-300 animate-fade-in",
        item.status === "starting" || item.status === "researching" || item.status === "synthesizing"
          ? "border-accent/40 shadow-sm shadow-accent/10"
          : "border-border/60 hover:border-border"
      )}
      style={{ animationDelay: `${(index + 1) * 50}ms` }}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-baseline gap-2.5 mb-1">
            <h3 className="text-base font-medium text-foreground">{item.company_name}</h3>
            <span className="text-sm font-mono text-muted-foreground/70">{item.ticker}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {item.status === "starting" && "Initializing research..."}
            {item.status === "researching" && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Running: {getCurrentStep()}
              </span>
            )}
            {item.status === "synthesizing" && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                Generating synthesis...
              </span>
            )}
            {item.status === "complete" && "Research complete"}
            {item.status === "queued" && "Ready for research"}
            {item.status === "error" && "Research failed"}
          </p>
        </div>

        {/* Status and Action */}
        <div className="flex items-center gap-3">
          {/* Start Research Button for Queued items */}
          {item.status === "queued" && (
            <button
              onClick={() => onStartResearch(item.id, item.ticker)}
              disabled={isStarting}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all",
                "bg-accent text-accent-foreground hover:bg-accent/90",
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
          <div className={cn(
            "flex items-center gap-2 text-sm",
            config.color || "text-muted-foreground"
          )}>
            <Icon className={cn(
              "h-4 w-4",
              config.animate && "animate-spin"
            )} />
            <span>{config.label}</span>
          </div>
        </div>
      </div>

      {/* Progress bar - show for all non-queued states */}
      {item.status !== "queued" && (
        <div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                item.status === "complete" ? "bg-success" : 
                item.status === "error" ? "bg-destructive" :
                item.status === "synthesizing" ? "bg-purple-500" :
                "bg-accent"
              )}
              style={{ width: `${Math.max(progress, item.status === "starting" ? 3 : 0)}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-muted-foreground/60">
              {item.status === "starting" && "Queuing research job..."}
              {item.status === "researching" && `${7 - Math.floor(progress / 14)} agents remaining`}
              {item.status === "synthesizing" && "Generating final report..."}
              {item.status === "complete" && "View in Research tab"}
              {item.status === "error" && "Check logs for details"}
            </p>
            <p className="text-xs text-muted-foreground/60">
              {progress}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
