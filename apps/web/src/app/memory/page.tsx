"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Eye, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

type MemoryType = "screened" | "researched" | "rejected";

interface MemoryItem {
  ticker: string;
  company_name: string;
  headline: string;
  status: string;
  type: MemoryType;
  rejection_reason?: string;
  whats_new?: string;
  reappearance_count: number;
  last_seen: string;
  days_since_rejection?: number;
}

const typeConfig: Record<MemoryType, { icon: typeof Eye; label: string }> = {
  screened: { icon: Eye, label: "Screened" },
  researched: { icon: FileText, label: "Researched" },
  rejected: { icon: X, label: "Rejected" },
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function MemoryPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/memory/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults((data.results || []).map((r: any) => ({
          ...r,
          type: r.status === "rejected" ? "rejected" : 
                r.research_packet_id ? "researched" : "screened"
        })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border">
          <div className="px-8 py-6">
            <h1 className="text-2xl font-medium text-foreground tracking-tight">
              Memory
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Search rejection history and idea reappearances
            </p>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 py-10">
          <div className="max-w-2xl mx-auto px-8">
            {/* Search input - centered */}
            <div className="mb-10 animate-fade-in">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search by ticker or company name..."
                  className={cn(
                    "w-full pl-11 pr-4 py-3 bg-card border border-border rounded-md",
                    "text-sm placeholder:text-muted-foreground/50",
                    "focus:outline-none focus:border-accent/50 transition-calm"
                  )}
                />
              </div>
            </div>

            {/* Results */}
            {loading ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground animate-pulse-calm">Searching...</p>
              </div>
            ) : !hasSearched ? (
              <div className="text-center py-16 animate-fade-in">
                <p className="text-muted-foreground">Search for past ideas and rejections.</p>
                <p className="text-sm text-muted-foreground/60 mt-2">
                  Find rejection shadows and track reappearances.
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-16 animate-fade-in">
                <p className="text-muted-foreground">No results found for "{query}".</p>
                <p className="text-sm text-muted-foreground/60 mt-2">
                  Try a different ticker or company name.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((item, index) => (
                  <MemoryCard key={index} item={item} index={index} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}

interface MemoryCardProps {
  item: MemoryItem;
  index: number;
}

function MemoryCard({ item, index }: MemoryCardProps) {
  const config = typeConfig[item.type];
  const Icon = config.icon;

  return (
    <article
      className={cn(
        "p-6 rounded-md bg-card border animate-fade-in transition-calm",
        item.type === "rejected" 
          ? "border-l-2 border-l-fail border-border/60" 
          : "border-border/60"
      )}
      style={{ animationDelay: `${index * 75}ms` }}
    >
      {/* Top row - Type and date */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className={cn(
            "w-3.5 h-3.5",
            item.type === "rejected" && "text-fail"
          )} />
          <span>{config.label}</span>
          {item.reappearance_count > 0 && (
            <span className="text-warning/70">
              · {item.reappearance_count}x reappeared
            </span>
          )}
        </div>
        <span className="text-annotation text-muted-foreground/50">
          {formatDate(item.last_seen)}
        </span>
      </div>

      {/* Company identification */}
      <div className="flex items-baseline gap-2 mb-2">
        <h3 className="text-base font-medium text-foreground">{item.company_name}</h3>
        <span className="text-sm font-mono text-muted-foreground/60">{item.ticker}</span>
      </div>

      {/* Headline */}
      <p className="text-sm text-foreground/80 leading-relaxed mb-4">
        {item.headline}
      </p>

      {/* Rejection reason */}
      {item.rejection_reason && (
        <div className="p-4 bg-fail/5 rounded-md border border-fail/10 mb-3">
          <p className="text-label text-fail/70 mb-2">Rejection Reason</p>
          <p className="text-sm text-foreground/70">{item.rejection_reason}</p>
        </div>
      )}

      {/* What's new since rejection */}
      {item.whats_new && (
        <div className="p-4 bg-accent/5 rounded-md border border-accent/10">
          <p className="text-label text-accent/70 mb-2">What's New Since Rejection</p>
          <p className="text-sm text-foreground/70">{item.whats_new}</p>
        </div>
      )}

      {/* Days since rejection */}
      {item.days_since_rejection && (
        <p className="text-annotation text-muted-foreground/40 mt-4">
          {item.days_since_rejection} days since rejection
        </p>
      )}
    </article>
  );
}
