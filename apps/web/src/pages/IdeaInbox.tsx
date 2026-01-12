import { useState } from "react";
import { IdeaCard } from "@/components/ui/IdeaCard";
import { cn } from "@/lib/utils";

// Sample data for demonstration
const sampleIdeas = [
  {
    id: "1",
    company: "Constellation Software",
    ticker: "CSU.TO",
    hypothesis: "Vertical market software roll-up with exceptional capital allocation. Serial acquirer with 30%+ ROIC and sticky recurring revenue base showing acceleration in M&A pipeline.",
    style: "Quality" as const,
    novelty: "New" as const,
    hasEdge: true,
    hasCatalyst: false,
  },
  {
    id: "2",
    company: "AutoZone",
    ticker: "AZO",
    hypothesis: "Counter-cyclical auto parts retailer with aggressive buyback program. Average vehicle age at record highs, driving repair demand. Margin expansion from commercial segment.",
    style: "GARP" as const,
    novelty: "Reappearance" as const,
    hasEdge: false,
    hasCatalyst: true,
    lastSeen: "3 months ago",
  },
  {
    id: "3",
    company: "Fairfax Financial",
    ticker: "FFH.TO",
    hypothesis: "Insurance holding company trading below intrinsic value. Hardening P&C market combined with investment portfolio repositioning. Prem Watsa's track record of value creation.",
    style: "Cigar Butt" as const,
    novelty: "Repeat" as const,
    hasEdge: true,
    hasCatalyst: true,
    lastSeen: "6 months ago",
  },
  {
    id: "4",
    company: "Dino Polska",
    ticker: "DNP.WA",
    hypothesis: "Polish proximity grocery chain with exceptional unit economics. Rural expansion runway with 40%+ ROIC on new stores. Founder-led with significant skin in the game.",
    style: "Quality" as const,
    novelty: "New" as const,
    hasEdge: true,
    hasCatalyst: false,
  },
  {
    id: "5",
    company: "Judges Scientific",
    ticker: "JDG.L",
    hypothesis: "Scientific instruments acquirer with decentralized model. Niche market leadership in measurement and testing equipment. Strong organic growth complemented by M&A.",
    style: "Quality" as const,
    novelty: "Reappearance" as const,
    hasEdge: false,
    hasCatalyst: false,
    lastSeen: "2 months ago",
  },
];

type FilterOption = "all" | "new" | "quality" | "garp" | "cigarbutt";

export default function IdeaInbox() {
  const [filter, setFilter] = useState<FilterOption>("all");
  const [ideas] = useState(sampleIdeas);

  const filteredIdeas = ideas.filter(idea => {
    if (filter === "all") return true;
    if (filter === "new") return idea.novelty === "New";
    if (filter === "quality") return idea.style === "Quality";
    if (filter === "garp") return idea.style === "GARP";
    if (filter === "cigarbutt") return idea.style === "Cigar Butt";
    return true;
  });

  const newCount = ideas.filter(i => i.novelty === "New").length;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - Generous vertical rhythm */}
      <header className="page-header">
        <div className="flex items-baseline gap-4">
          <h1 className="page-header-title">Idea Inbox</h1>
          {newCount > 0 && (
            <span className="text-supporting text-accent">
              {newCount} new
            </span>
          )}
        </div>
        <p className="page-header-subtitle">
          Curated opportunities awaiting your review
        </p>
      </header>

      {/* Filters - Minimal, functional */}
      <nav 
        className="border-b border-border/50"
        style={{ padding: 'var(--space-4) var(--space-8)' }}
      >
        <div className="flex items-center gap-1">
          {[
            { key: "all", label: "All" },
            { key: "new", label: "New" },
            { key: "quality", label: "Quality" },
            { key: "garp", label: "GARP" },
            { key: "cigarbutt", label: "Deep Value" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as FilterOption)}
              className={cn(
                "px-3 py-1.5 text-supporting rounded-md transition-calm",
                filter === key
                  ? "text-foreground bg-secondary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              style={{ fontWeight: filter === key ? 450 : 400 }}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Idea list - Breathable, editorial */}
      <main className="flex-1" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-10)' }}>
        <div className="content-area">
          {/* Increased spacing between cards for breathing room */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {filteredIdeas.length > 0 ? (
              filteredIdeas.map((idea, index) => (
                <div 
                  key={idea.id} 
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <IdeaCard
                    {...idea}
                    onPromote={(id) => console.log("Promote:", id)}
                    onReject={(id) => console.log("Reject:", id)}
                    onWatch={(id) => console.log("Watch:", id)}
                  />
                </div>
              ))
            ) : (
              <div className="text-center" style={{ padding: 'var(--space-12) 0' }}>
                <p className="text-muted-foreground">No ideas match this filter.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer - Whisper-quiet metadata */}
      <footer 
        className="border-t border-border/30"
        style={{ padding: 'var(--space-5) 0' }}
      >
        <p className="text-annotation text-muted-foreground/50 text-center">
          {filteredIdeas.length} {filteredIdeas.length === 1 ? 'idea' : 'ideas'} · Last discovery run 2 hours ago
        </p>
      </footer>
    </div>
  );
}
