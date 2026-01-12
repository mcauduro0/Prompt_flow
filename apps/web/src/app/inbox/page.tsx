"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowUpRight, Eye, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Idea {
  ideaId: string;
  ticker: string;
  companyName: string;
  oneSentenceHypothesis: string;
  mechanism: string;
  styleTag: string;
  edgeType: string[];
  status: string;
  quickMetrics: {
    market_cap_usd: number | null;
  };
  isNewTicker: boolean;
  createdAt: string;
  convictionScore?: number;
}

type FilterType = "all" | "new" | "quality_compounder" | "garp" | "cigar_butt";

const filterLabels: Record<FilterType, string> = {
  all: "All",
  new: "New",
  quality_compounder: "Quality",
  garp: "GARP",
  cigar_butt: "Deep Value",
};

const styleLabels: Record<string, string> = {
  quality_compounder: "Quality",
  garp: "GARP",
  cigar_butt: "Deep Value",
  turnaround: "Turnaround",
  special_situation: "Special Situation",
};

const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
};

export default function InboxPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchIdeas = async () => {
      try {
        const res = await fetch("/api/ideas/inbox");
        if (res.ok) {
          const data = await res.json();
          setIdeas(data.ideas || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchIdeas();
  }, []);

  const handlePromote = async (id: string) => {
    try {
      await fetch(`/api/ideas/${id}/promote`, { method: "POST" });
      setIdeas(ideas.filter((i) => i.ideaId !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await fetch(`/api/ideas/${id}/reject`, { method: "POST" });
      setIdeas(ideas.filter((i) => i.ideaId !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredIdeas = ideas.filter((idea) => {
    if (filter === "all") return true;
    if (filter === "new") return idea.isNewTicker;
    return idea.styleTag === filter;
  });

  const lastDiscoveryTime = ideas.length > 0 
    ? formatRelativeTime(ideas[0].createdAt)
    : null;

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border">
          <div className="px-8 py-6">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-medium text-foreground tracking-tight">
                Idea Inbox
              </h1>
              <span className="text-sm text-muted-foreground">
                {ideas.length} pending
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Review and triage investment ideas
            </p>
          </div>

          {/* Filter tabs */}
          <div className="px-8 pb-4">
            <div className="flex items-center gap-1">
              {(Object.keys(filterLabels) as FilterType[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    "px-4 py-2 text-sm rounded-md transition-calm",
                    filter === key
                      ? "bg-secondary text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  )}
                >
                  {filterLabels[key]}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 py-8">
          <div className="max-w-3xl mx-auto px-8">
            {loading ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground animate-pulse-calm">Loading ideas...</p>
              </div>
            ) : filteredIdeas.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">No ideas in inbox.</p>
                <p className="text-sm text-muted-foreground/60 mt-2">
                  Ideas will appear after the next discovery run.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredIdeas.map((idea, index) => (
                  <IdeaCard
                    key={idea.ideaId}
                    idea={idea}
                    index={index}
                    expanded={expandedId === idea.ideaId}
                    onToggle={() => setExpandedId(expandedId === idea.ideaId ? null : idea.ideaId)}
                    onPromote={() => handlePromote(idea.ideaId)}
                    onReject={() => handleReject(idea.ideaId)}
                    onViewDetail={() => router.push(`/inbox/${idea.ideaId}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        {ideas.length > 0 && (
          <footer className="border-t border-border px-8 py-4">
            <div className="max-w-3xl mx-auto">
              <p className="text-annotation text-muted-foreground/50">
                {ideas.length} ideas · Last discovery run {lastDiscoveryTime}
              </p>
            </div>
          </footer>
        )}
      </div>
    </AppLayout>
  );
}

interface IdeaCardProps {
  idea: Idea;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onPromote: () => void;
  onReject: () => void;
  onViewDetail: () => void;
}

function IdeaCard({ idea, index, expanded, onToggle, onPromote, onReject, onViewDetail }: IdeaCardProps) {
  return (
    <article
      className={cn(
        "bg-card rounded-md transition-calm cursor-pointer animate-fade-in",
        "border border-transparent",
        expanded ? "bg-secondary/20 border-border/40" : "hover:bg-secondary/15"
      )}
      style={{ 
        padding: 'var(--space-6)',
        animationDelay: `${index * 75}ms`
      }}
      onClick={onToggle}
    >
      {/* Top metadata row */}
      <div className="flex items-center justify-between mb-4">
        {/* Novelty status */}
        <span className={cn(
          "text-label",
          idea.isNewTicker ? "text-accent" : "text-muted-foreground/50"
        )}>
          {idea.isNewTicker ? "New" : "Seen before"}
        </span>

        {/* Style and conviction */}
        <div className="flex items-center gap-3">
          {idea.convictionScore && (
            <span className="text-annotation text-muted-foreground/50">
              Conviction: {idea.convictionScore}
            </span>
          )}
          <span className={cn(
            "text-annotation",
            idea.styleTag === "quality_compounder" && "text-accent/60",
            idea.styleTag === "garp" && "text-foreground/40",
            (idea.styleTag === "cigar_butt" || idea.styleTag === "deep_value") && "text-warning/50"
          )}>
            {styleLabels[idea.styleTag] || idea.styleTag?.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Company identification */}
      <div className="flex items-baseline gap-2 mb-3">
        <h3 className="text-base font-medium text-foreground">{idea.companyName}</h3>
        <span className="text-sm font-mono text-muted-foreground/60">{idea.ticker}</span>
      </div>

      {/* Hypothesis */}
      <p className={cn(
        "text-sm text-foreground/85 leading-relaxed",
        !expanded && "line-clamp-2"
      )}>
        {idea.oneSentenceHypothesis}
      </p>

      {/* Edge indicators */}
      {idea.edgeType && idea.edgeType.length > 0 && (
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/20">
          {idea.edgeType.map((edge) => (
            <span key={edge} className="text-annotation text-muted-foreground/60 flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-accent/40" />
              {edge}
            </span>
          ))}
        </div>
      )}

      {/* Expanded actions */}
      {expanded && (
        <div className="mt-5 pt-5 border-t border-border/30 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPromote();
                }}
                className={cn(
                  "flex items-center gap-2 text-sm rounded-md",
                  "bg-accent text-accent-foreground",
                  "hover:bg-accent/90 transition-calm"
                )}
                style={{ padding: '8px 16px', fontWeight: 450 }}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Promote to deep research
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Add to watchlist
                }}
                className={cn(
                  "flex items-center gap-2 text-sm rounded-md",
                  "bg-secondary text-secondary-foreground",
                  "hover:bg-secondary/70 transition-calm"
                )}
                style={{ padding: '8px 16px', fontWeight: 450 }}
              >
                <Eye className="w-3.5 h-3.5" />
                Add to watchlist
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReject();
                }}
                className={cn(
                  "flex items-center gap-2 text-sm rounded-md",
                  "text-muted-foreground",
                  "hover:text-foreground hover:bg-secondary/40 transition-calm"
                )}
                style={{ padding: '8px 16px' }}
              >
                <X className="w-3.5 h-3.5" />
                Reject
              </button>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDetail();
              }}
              className={cn(
                "flex items-center gap-2 text-annotation text-muted-foreground",
                "hover:text-foreground transition-calm"
              )}
            >
              View detail
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
