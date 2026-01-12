import { useState } from "react";
import { Search, FileText, X, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface MemoryItem {
  id: string;
  company: string;
  ticker: string;
  type: "idea" | "research" | "rejection";
  date: string;
  summary: string;
  rejectionReason?: string;
  thesisVersion?: number;
}

const memoryItems: MemoryItem[] = [
  {
    id: "1",
    company: "Constellation Software",
    ticker: "CSU.TO",
    type: "research",
    date: "2026-01-10",
    summary: "Research packet completed. Recommendation: proceed.",
    thesisVersion: 3,
  },
  {
    id: "2",
    company: "Alibaba Group",
    ticker: "BABA",
    type: "rejection",
    date: "2025-12-15",
    summary: "Rejected due to VIE structure risk and regulatory uncertainty.",
    rejectionReason: "Governance risk",
  },
  {
    id: "3",
    company: "Peloton Interactive",
    ticker: "PTON",
    type: "rejection",
    date: "2025-11-28",
    summary: "Rejected due to declining subscriber growth and cash burn.",
    rejectionReason: "Business model deterioration",
  },
  {
    id: "4",
    company: "AutoZone",
    ticker: "AZO",
    type: "idea",
    date: "2025-11-15",
    summary: "Initial screen noted counter-cyclical characteristics. Added to watchlist.",
  },
  {
    id: "5",
    company: "Fairfax Financial",
    ticker: "FFH.TO",
    type: "research",
    date: "2025-10-20",
    summary: "Research completed. Timing not optimal. Retained for future consideration.",
    thesisVersion: 2,
  },
];

const typeConfig = {
  idea: {
    icon: Eye,
    label: "Screened",
  },
  research: {
    icon: FileText,
    label: "Researched",
  },
  rejection: {
    icon: X,
    label: "Rejected",
  },
};

export default function MemorySearch() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = memoryItems.filter(item => 
    item.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="px-8 py-6">
          <h1 className="text-2xl font-medium text-foreground tracking-tight">
            Memory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Institutional memory and decision history
          </p>
        </div>
      </header>

      {/* Search bar */}
      <div className="px-8 py-6 border-b border-border/60">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Search by company, ticker, or keyword"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-11 pr-4 py-3 rounded-md border border-border bg-card",
                "text-base text-foreground placeholder:text-muted-foreground/50",
                "focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40",
                "transition-calm"
              )}
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <main className="flex-1 py-10">
        <div className="max-w-2xl mx-auto px-8">
          {/* Timeline */}
          <div className="space-y-4">
            {filteredItems.map((item, index) => {
              const config = typeConfig[item.type];
              const Icon = config.icon;

              return (
                <div 
                  key={item.id}
                  className="p-6 rounded-md bg-card border border-border/60 animate-fade-in transition-calm hover:border-border"
                  style={{ animationDelay: `${index * 75}ms` }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-baseline gap-2.5">
                      <h3 className="text-base font-medium text-foreground">{item.company}</h3>
                      <span className="text-sm font-mono text-muted-foreground/70">{item.ticker}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                      <Icon className="h-3.5 w-3.5" />
                      <span>{config.label}</span>
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    {item.summary}
                  </p>

                  {/* Rejection reason */}
                  {item.rejectionReason && (
                    <p className="text-sm text-muted-foreground/70 mb-3">
                      <span className="text-muted-foreground/50">Rejection reason:</span> {item.rejectionReason}
                    </p>
                  )}

                  {/* Thesis version */}
                  {item.thesisVersion && (
                    <p className="text-xs text-muted-foreground/50 mb-3">
                      Thesis version {item.thesisVersion}
                    </p>
                  )}

                  {/* Date */}
                  <p className="text-xs text-muted-foreground/50">
                    {item.date}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {filteredItems.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No results found.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
