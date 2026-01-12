"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { ThumbsUp, ThumbsDown, ExternalLink, TrendingUp, TrendingDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface Idea {
  id: string;
  ticker: string;
  company_name: string;
  headline: string;
  one_liner: string;
  style: string;
  direction: "long" | "short";
  conviction_score: number;
  novelty_tag: "new" | "reappearance" | "repeat";
}

const styleColors: Record<string, string> = { quality: "text-accent", garp: "text-foreground/70", cigarbutt: "text-warning", turnaround: "text-purple-400", special_situation: "text-blue-400" };

export default function InboxPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const fetchIdeas = async () => {
      try {
        const res = await fetch("/api/ideas?status=inbox");
        if (res.ok) { const data = await res.json(); setIdeas(data.ideas || []); }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchIdeas();
  }, []);

  const handlePromote = async (id: string) => { try { await fetch(`/api/ideas/${id}/promote`, { method: "POST" }); setIdeas(ideas.filter((i) => i.id !== id)); } catch (err) { console.error(err); } };
  const handleReject = async (id: string) => { try { await fetch(`/api/ideas/${id}/reject`, { method: "POST" }); setIdeas(ideas.filter((i) => i.id !== id)); } catch (err) { console.error(err); } };

  const filteredIdeas = filter === "all" ? ideas : ideas.filter((i) => i.style === filter);

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        <header className="page-header">
          <div className="flex items-center justify-between">
            <div><h1 className="page-header-title">Idea Inbox</h1><p className="page-header-subtitle">{ideas.length} ideas awaiting review</p></div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm">
                <option value="all">All Styles</option><option value="quality">Quality</option><option value="garp">GARP</option><option value="cigarbutt">Cigar Butt</option><option value="turnaround">Turnaround</option><option value="special_situation">Special Situation</option>
              </select>
            </div>
          </div>
        </header>
        <main className="flex-1 p-8">
          <div className="content-area">
            {loading ? (<div className="flex items-center justify-center py-20"><div className="animate-pulse text-muted-foreground">Loading ideas...</div></div>
            ) : filteredIdeas.length === 0 ? (<div className="text-center py-20 text-muted-foreground"><p>No ideas in inbox</p><p className="text-sm mt-2">New ideas will appear after the next discovery run</p></div>
            ) : (
              <div className="space-y-4">
                {filteredIdeas.map((idea, idx) => (
                  <div key={idea.id} className="governance-card hover:border-accent/30 transition-colors animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono font-medium">{idea.ticker}</span>
                          <span className={cn("text-xs uppercase tracking-wider", styleColors[idea.style] || "text-muted-foreground")}>{idea.style?.replace("_", " ")}</span>
                          <span className={cn("text-xs px-2 py-0.5 rounded", idea.novelty_tag === "new" && "bg-accent/20 text-accent", idea.novelty_tag === "reappearance" && "bg-warning/20 text-warning", idea.novelty_tag === "repeat" && "bg-muted text-muted-foreground")}>{idea.novelty_tag}</span>
                          {idea.direction === "long" ? <TrendingUp className="w-4 h-4 text-success" /> : <TrendingDown className="w-4 h-4 text-fail" />}
                        </div>
                        <h3 className="font-medium mb-1">{idea.company_name}</h3>
                        <p className="text-sm text-muted-foreground mb-3">{idea.headline}</p>
                        <p className="text-sm text-foreground/80 italic">&ldquo;{idea.one_liner}&rdquo;</p>
                        <div className="flex items-center gap-4 mt-4 text-sm">
                          <span className="text-muted-foreground">Conviction:</span>
                          <span className={cn("font-medium", idea.conviction_score >= 70 && "text-success", idea.conviction_score >= 50 && idea.conviction_score < 70 && "text-warning", idea.conviction_score < 50 && "text-fail")}>{idea.conviction_score}/100</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Link href={`/inbox/${idea.id}`} className="p-2 rounded-md border border-border hover:bg-secondary transition-colors" title="View Details"><ExternalLink className="w-4 h-4" /></Link>
                        <button onClick={() => handlePromote(idea.id)} className="p-2 rounded-md bg-success/20 text-success hover:bg-success/30 transition-colors" title="Promote"><ThumbsUp className="w-4 h-4" /></button>
                        <button onClick={() => handleReject(idea.id)} className="p-2 rounded-md bg-fail/20 text-fail hover:bg-fail/30 transition-colors" title="Reject"><ThumbsDown className="w-4 h-4" /></button>
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
