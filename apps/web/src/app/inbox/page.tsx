"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowUpRight, Eye, X, ChevronRight, TrendingUp, DollarSign, Zap, Calendar, CheckCircle, XCircle, Clock } from "lucide-react";
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
  asOf: string; // Discovery date
  quickMetrics: {
    market_cap_usd: number | null;
  };
  isNewTicker: boolean;
  createdAt: string;
  convictionScore?: number;
  // New institutional metrics
  expected_value_score?: number;
  expected_cost_score?: number;
  value_cost_ratio?: number;
  prompts_executed?: string[];
  total_cost_usd?: number;
  llm_provider?: string;
  llm_model?: string;
}

interface InboxStats {
  pending: number;
  promoted: number;
  rejected: number;
  monitoring: number;
}

type FilterType = "all" | "new" | "quality_compounder" | "garp" | "cigar_butt" | "high_value";

const filterLabels: Record<FilterType, string> = {
  all: "All",
  new: "New",
  high_value: "High Value",
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

const formatDiscoveryDate = (dateStr: string): string => {
  if (!dateStr) return "Unknown";
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const dateOnly = date.toISOString().split('T')[0];
  const todayOnly = today.toISOString().split('T')[0];
  const yesterdayOnly = yesterday.toISOString().split('T')[0];
  
  if (dateOnly === todayOnly) return "Today";
  if (dateOnly === yesterdayOnly) return "Yesterday";
  
  // Format as "Jan 12" or "Dec 31"
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

const formatMarketCap = (value: number | null): string => {
  if (!value) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
};

export default function InboxPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total_cost: number; avg_conviction: number } | null>(null);
  const [inboxStats, setInboxStats] = useState<InboxStats | null>(null);
  const [byDate, setByDate] = useState<Record<string, number>>({});
  const router = useRouter();

  useEffect(() => {
    const fetchIdeas = async () => {
      try {
        const res = await fetch("/api/ideas/inbox");
        if (res.ok) {
          const data = await res.json();
          const ideasData = data.ideas || [];
          setIdeas(ideasData);
          setInboxStats(data.stats || null);
          setByDate(data.byDate || {});
          
          // Calculate stats
          if (ideasData.length > 0) {
            const totalCost = ideasData.reduce((sum: number, i: Idea) => sum + (i.total_cost_usd || 0), 0);
            const avgConviction = ideasData.reduce((sum: number, i: Idea) => sum + (i.convictionScore || 0), 0) / ideasData.length;
            setStats({ total_cost: totalCost, avg_conviction: avgConviction });
          }
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
    if (filter === "high_value") return (idea.value_cost_ratio || 0) >= 2.0;
    return idea.styleTag === filter;
  });

  // Sort by discovery date (newest first), then by conviction score
  const sortedIdeas = [...filteredIdeas].sort((a, b) => {
    // First sort by discovery date (newest first)
    const dateA = new Date(a.asOf || a.createdAt).getTime();
    const dateB = new Date(b.asOf || b.createdAt).getTime();
    if (dateB !== dateA) return dateB - dateA;
    
    // Then by conviction score
    const convA = a.convictionScore || 0;
    const convB = b.convictionScore || 0;
    if (convB !== convA) return convB - convA;
    return (b.value_cost_ratio || 0) - (a.value_cost_ratio || 0);
  });

  // Get unique discovery dates for display
  const discoveryDates = Object.keys(byDate).sort().reverse();

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
                {ideas.length} pending review
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              All investment ideas awaiting manual review from Lane A Discovery
            </p>
          </div>

          {/* Global Stats bar */}
          {inboxStats && (
            <div className="px-8 pb-4 flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-muted-foreground">Pending:</span>
                <span className="font-medium text-foreground">{inboxStats.pending}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-muted-foreground">Promoted:</span>
                <span className="font-medium text-foreground">{inboxStats.promoted}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-muted-foreground">Rejected:</span>
                <span className="font-medium text-foreground">{inboxStats.rejected}</span>
              </div>
              {stats && (
                <>
                  <div className="w-px h-4 bg-border" />
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-muted-foreground">Avg Conviction:</span>
                    <span className="font-medium text-foreground">{stats.avg_conviction.toFixed(1)}/10</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    <span className="text-muted-foreground">Discovery Cost:</span>
                    <span className="font-medium text-foreground">${stats.total_cost.toFixed(4)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Discovery dates summary */}
          {discoveryDates.length > 0 && (
            <div className="px-8 pb-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Discovery dates:</span>
                {discoveryDates.slice(0, 5).map((date) => (
                  <span key={date} className="px-2 py-0.5 bg-secondary rounded text-xs">
                    {formatDiscoveryDate(date)} ({byDate[date]})
                  </span>
                ))}
                {discoveryDates.length > 5 && (
                  <span className="text-muted-foreground text-xs">
                    +{discoveryDates.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}

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
                  {key === "high_value" && (
                    <Zap className="w-3 h-3 ml-1 inline text-amber-400" />
                  )}
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
            ) : sortedIdeas.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">No ideas pending review.</p>
                <p className="text-sm text-muted-foreground/60 mt-2">
                  Ideas will appear after the next discovery run.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedIdeas.map((idea, index) => (
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
                {ideas.length} ideas pending review across {discoveryDates.length} discovery run{discoveryDates.length !== 1 ? 's' : ''}
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
  const valueCostRatio = idea.value_cost_ratio || 0;
  const isHighValue = valueCostRatio >= 2.0;
  const discoveryDate = formatDiscoveryDate(idea.asOf || idea.createdAt);
  
  return (
    <article
      className={cn(
        "bg-card rounded-md transition-calm cursor-pointer animate-fade-in",
        "border border-transparent",
        expanded ? "bg-secondary/20 border-border/40" : "hover:bg-secondary/15",
        isHighValue && "border-l-2 border-l-amber-500/50"
      )}
      style={{ 
        padding: 'var(--space-6)',
        animationDelay: `${index * 75}ms`
      }}
      onClick={onToggle}
    >
      {/* Top metadata row */}
      <div className="flex items-center justify-between mb-4">
        {/* Left side: Discovery Date + Novelty + Market Cap */}
        <div className="flex items-center gap-3">
          {/* Discovery Date Badge */}
          <span className="text-annotation px-2 py-0.5 rounded bg-secondary/50 text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {discoveryDate}
          </span>
          <span className={cn(
            "text-label",
            idea.isNewTicker ? "text-accent" : "text-muted-foreground/50"
          )}>
            {idea.isNewTicker ? "New" : "Seen before"}
          </span>
          {idea.quickMetrics?.market_cap_usd && (
            <span className="text-annotation text-muted-foreground/50">
              {formatMarketCap(idea.quickMetrics.market_cap_usd)}
            </span>
          )}
        </div>

        {/* Right side: Metrics */}
        <div className="flex items-center gap-4">
          {/* Value/Cost Ratio */}
          {valueCostRatio > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-annotation text-muted-foreground/50">V/C:</span>
              <span className={cn(
                "text-annotation font-medium",
                valueCostRatio >= 2.0 ? "text-emerald-400" :
                valueCostRatio >= 1.5 ? "text-amber-400" : "text-muted-foreground"
              )}>
                {valueCostRatio.toFixed(2)}
              </span>
            </div>
          )}
          
          {/* Conviction Score */}
          {idea.convictionScore && (
            <div className="flex items-center gap-1.5">
              <span className="text-annotation text-muted-foreground/50">Conv:</span>
              <span className={cn(
                "text-annotation font-medium",
                idea.convictionScore >= 8 ? "text-emerald-400" :
                idea.convictionScore >= 6 ? "text-amber-400" : "text-muted-foreground"
              )}>
                {idea.convictionScore}/10
              </span>
            </div>
          )}
          
          {/* Style Tag */}
          <span className={cn(
            "text-annotation px-2 py-0.5 rounded",
            idea.styleTag === "quality_compounder" && "bg-emerald-500/10 text-emerald-400",
            idea.styleTag === "garp" && "bg-blue-500/10 text-blue-400",
            (idea.styleTag === "cigar_butt" || idea.styleTag === "deep_value") && "bg-amber-500/10 text-amber-400",
            idea.styleTag === "turnaround" && "bg-purple-500/10 text-purple-400",
            idea.styleTag === "special_situation" && "bg-pink-500/10 text-pink-400"
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

      {/* Expanded section */}
      {expanded && (
        <div className="mt-5 pt-5 border-t border-border/30 animate-fade-in">
          {/* Institutional metrics detail */}
          <div className="grid grid-cols-4 gap-4 mb-5 p-3 bg-secondary/20 rounded-lg">
            <div>
              <p className="text-annotation text-muted-foreground/60">Expected Value</p>
              <p className="text-sm font-medium text-foreground">
                {(idea.expected_value_score || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-annotation text-muted-foreground/60">Expected Cost</p>
              <p className="text-sm font-medium text-foreground">
                {(idea.expected_cost_score || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-annotation text-muted-foreground/60">Analysis Cost</p>
              <p className="text-sm font-medium text-foreground">
                ${(idea.total_cost_usd || 0).toFixed(4)}
              </p>
            </div>
            <div>
              <p className="text-annotation text-muted-foreground/60">LLM Used</p>
              <p className="text-sm font-medium text-foreground font-mono">
                {idea.llm_model || 'gpt-5.2'}
              </p>
            </div>
          </div>

          {/* Prompts executed */}
          {idea.prompts_executed && idea.prompts_executed.length > 0 && (
            <div className="mb-5">
              <p className="text-annotation text-muted-foreground/60 mb-2">Prompts Executed</p>
              <div className="flex flex-wrap gap-1.5">
                {idea.prompts_executed.map((prompt) => (
                  <span key={prompt} className="text-xs px-2 py-0.5 bg-secondary rounded font-mono">
                    {prompt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
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
                Promote to Lane B
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
                Watchlist
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
