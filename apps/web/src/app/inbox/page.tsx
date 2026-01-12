"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowRight, X, ExternalLink, Filter } from "lucide-react";
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
}

const styleColors: Record<string, string> = { 
  quality_compounder: "text-accent", 
  garp: "text-foreground/70", 
  cigar_butt: "text-warning", 
  turnaround: "text-purple-400", 
  special_situation: "text-blue-400" 
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
  const [filter, setFilter] = useState<string>("all");

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

  const filteredIdeas = filter === "all" ? ideas : ideas.filter((i) => i.styleTag === filter);

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        <header className="page-header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="page-header-title">Idea Inbox</h1>
              <p className="page-header-subtitle">{ideas.length} ideas pending review</p>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select 
                value={filter} 
                onChange={(e) => setFilter(e.target.value)} 
                className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm"
              >
                <option value="all">All Styles</option>
                <option value="quality_compounder">Quality Compounder</option>
                <option value="garp">GARP</option>
                <option value="cigar_butt">Cigar Butt</option>
                <option value="turnaround">Turnaround</option>
                <option value="special_situation">Special Situation</option>
              </select>
            </div>
          </div>
        </header>
        <main className="flex-1 p-8">
          <div className="content-area">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-muted-foreground">Loading ideas...</div>
              </div>
            ) : filteredIdeas.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <p>No ideas in inbox.</p>
                <p className="text-sm mt-2">Ideas will appear after the next discovery run.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredIdeas.map((idea) => (
                  <div 
                    key={idea.ideaId} 
                    className="governance-card hover:border-border transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono font-medium text-lg">{idea.ticker}</span>
                          <span className={cn(
                            "text-xs uppercase tracking-wider", 
                            styleColors[idea.styleTag] || "text-muted-foreground"
                          )}>
                            {idea.styleTag?.replace(/_/g, " ")}
                          </span>
                          {idea.isNewTicker && (
                            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                              New
                            </span>
                          )}
                        </div>
                        <h3 className="font-medium mb-1">{idea.companyName}</h3>
                        <p className="text-sm text-foreground/80 mb-3">{idea.oneSentenceHypothesis}</p>
                        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
                          <span className="text-muted-foreground">
                            Mechanism: <span className="text-foreground">{idea.mechanism}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Market Cap: <span className="text-foreground">{formatMarketCap(idea.quickMetrics?.market_cap_usd)}</span>
                          </span>
                          {idea.edgeType && idea.edgeType.length > 0 && (
                            <span className="text-muted-foreground">
                              Edge: <span className="text-foreground">{idea.edgeType.join(", ")}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Link 
                          href={`/inbox/${idea.ideaId}`} 
                          className="p-2 rounded-md border border-border hover:bg-secondary transition-colors" 
                          title="View detail"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handlePromote(idea.ideaId)} 
                          className="p-2 rounded-md border border-border hover:bg-secondary transition-colors" 
                          title="Promote to deep research"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleReject(idea.ideaId)} 
                          className="p-2 rounded-md border border-border hover:bg-secondary transition-colors" 
                          title="Reject with reason"
                        >
                          <X className="w-4 h-4" />
                        </button>
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
