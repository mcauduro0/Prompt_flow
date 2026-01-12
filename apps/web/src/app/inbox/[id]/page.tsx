"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeft, ThumbsUp, ThumbsDown, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function IdeaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [idea, setIdea] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const ideaId = params?.id as string | undefined;

  useEffect(() => {
    const fetchIdea = async () => {
      if (!ideaId) return;
      try {
        const res = await fetch(`/api/ideas/${ideaId}`);
        if (res.ok) { const data = await res.json(); setIdea(data); }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    if (ideaId) fetchIdea();
  }, [ideaId]);

  const handlePromote = async () => { 
    if (!ideaId) return;
    try { await fetch(`/api/ideas/${ideaId}/promote`, { method: "POST" }); router.push("/inbox"); } catch (err) { console.error(err); } 
  };
  const handleReject = async () => { 
    if (!ideaId) return;
    try { await fetch(`/api/ideas/${ideaId}/reject`, { method: "POST" }); router.push("/inbox"); } catch (err) { console.error(err); } 
  };

  if (loading) return <AppLayout><div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-muted-foreground">Loading...</div></div></AppLayout>;
  if (!idea) return <AppLayout><div className="flex items-center justify-center min-h-screen text-muted-foreground">Idea not found</div></AppLayout>;

  const gates = [{ id: 0, name: "Data Sufficiency", passed: idea.gate_results?.gate_0 }, { id: 1, name: "Coherence", passed: idea.gate_results?.gate_1 }, { id: 2, name: "Edge Claim", passed: idea.gate_results?.gate_2 }, { id: 3, name: "Downside Shape", passed: idea.gate_results?.gate_3, hard: true }, { id: 4, name: "Style Fit", passed: idea.gate_results?.gate_4, hard: true }];

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        <header className="page-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/inbox" className="p-2 rounded-md hover:bg-secondary transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
              <div><div className="flex items-center gap-3"><h1 className="page-header-title">{idea.ticker}</h1><span className="text-sm text-accent uppercase tracking-wider">{idea.style?.replace("_", " ")}</span></div><p className="page-header-subtitle">{idea.company_name}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePromote} className="flex items-center gap-2 px-4 py-2 bg-success/20 text-success rounded-md hover:bg-success/30 transition-colors"><ThumbsUp className="w-4 h-4" /> Promote</button>
              <button onClick={handleReject} className="flex items-center gap-2 px-4 py-2 bg-fail/20 text-fail rounded-md hover:bg-fail/30 transition-colors"><ThumbsDown className="w-4 h-4" /> Reject</button>
            </div>
          </div>
        </header>
        <main className="flex-1 p-8">
          <div className="content-area space-y-8">
            <section className="governance-card"><h2 className="text-section-title mb-4">Investment Thesis</h2><p className="text-lg font-medium mb-4">{idea.headline}</p><p className="text-muted-foreground italic">&ldquo;{idea.one_liner}&rdquo;</p></section>
            <section className="governance-card"><h2 className="text-section-title mb-4">Gate Results</h2>
              <div className="grid grid-cols-5 gap-4">{gates.map((gate) => (<div key={gate.id} className={cn("p-4 rounded-md border text-center", gate.passed ? "border-success/30 bg-success/5" : "border-fail/30 bg-fail/5")}>{gate.passed ? <CheckCircle className="w-6 h-6 text-success mx-auto mb-2" /> : <XCircle className="w-6 h-6 text-fail mx-auto mb-2" />}<div className="text-xs font-medium">Gate {gate.id}</div><div className="text-xs text-muted-foreground">{gate.name}</div>{gate.hard && <div className="text-xs text-warning mt-1">Hard Fail</div>}</div>))}</div>
            </section>
            <section className="governance-card"><h2 className="text-section-title mb-4">Scoring</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div><div className="text-sm text-muted-foreground">Conviction</div><div className="text-2xl font-medium">{idea.conviction_score || 0}/100</div></div><div><div className="text-sm text-muted-foreground">Novelty</div><div className="text-2xl font-medium capitalize">{idea.novelty_tag || "unknown"}</div></div><div><div className="text-sm text-muted-foreground">Direction</div><div className="text-2xl font-medium capitalize">{idea.direction || "long"}</div></div><div><div className="text-sm text-muted-foreground">Style</div><div className="text-2xl font-medium capitalize">{idea.style?.replace("_", " ") || "unknown"}</div></div></div>
            </section>
            {idea.evidence && idea.evidence.length > 0 && (<section className="governance-card"><h2 className="text-section-title mb-4">Supporting Evidence</h2><div className="space-y-3">{idea.evidence.map((ev: any, i: number) => (<div key={i} className="p-4 bg-secondary/30 rounded-md"><div className="flex items-start justify-between gap-4"><div className="flex-1"><p className="text-sm">{ev.claim}</p><p className="text-xs text-muted-foreground mt-2">Source: {ev.source || "Unknown"}</p></div>{ev.url && <a href={ev.url} target="_blank" rel="noopener noreferrer" className="p-1 hover:text-accent"><ExternalLink className="w-4 h-4" /></a>}</div></div>))}</div></section>)}
            {idea.whats_new_since_last_time && (<section className="governance-card governance-card-warn"><h2 className="text-section-title mb-4">What&apos;s New Since Last Time</h2><p className="text-sm">{idea.whats_new_since_last_time}</p></section>)}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
