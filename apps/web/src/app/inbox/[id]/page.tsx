"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  ArrowLeft, 
  ThumbsUp, 
  ThumbsDown, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ExternalLink,
  TrendingUp,
  Calendar,
  DollarSign,
  Target,
  AlertTriangle,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface IdeaDetail {
  ideaId: string;
  ticker: string;
  company_name: string;
  style: string;
  headline: string;
  one_liner: string;
  conviction_score: number;
  novelty_tag: string;
  direction: string;
  gate_results: {
    gate_0: boolean;
    gate_1: boolean;
    gate_2: boolean;
    gate_3: boolean;
    gate_4: boolean;
    executed: boolean;
  };
  gates_executed: boolean;
  edge_type: string[];
  catalysts: Array<{
    name: string;
    window: string;
    probability: number;
    expected_impact: string;
    how_to_monitor: string;
  }>;
  signposts: Array<{
    metric: string;
    direction: string;
    threshold: string;
    frequency: string;
    why_it_matters: string;
  }>;
  quick_metrics: {
    market_cap_usd: number | null;
    ev_to_ebitda: number | null;
    pe: number | null;
    fcf_yield: number | null;
    revenue_cagr_3y: number | null;
    ebit_margin: number | null;
    net_debt_to_ebitda: number | null;
  };
  discovery_date: string;
  time_horizon: string;
  status: string;
  is_new_ticker: boolean;
  whats_new_since_last_time: any;
  score_breakdown: any;
}

const formatMarketCap = (value: number | null): string => {
  if (!value) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
};

const formatPercent = (value: number | null): string => {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(1)}%`;
};

const formatNumber = (value: number | null, decimals = 1): string => {
  if (value === null || value === undefined) return "—";
  return value.toFixed(decimals);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "Unknown";
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
};

export default function IdeaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [idea, setIdea] = useState<IdeaDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const ideaId = params?.id as string | undefined;

  useEffect(() => {
    const fetchIdea = async () => {
      if (!ideaId) return;
      try {
        const res = await fetch(`/api/ideas/${ideaId}`);
        if (res.ok) { 
          const data = await res.json(); 
          setIdea(data); 
        }
      } catch (err) { 
        console.error(err); 
      } finally { 
        setLoading(false); 
      }
    };
    if (ideaId) fetchIdea();
  }, [ideaId]);

  const handlePromote = async () => { 
    if (!ideaId) return;
    try { 
      await fetch(`/api/ideas/${ideaId}/promote`, { method: "POST" }); 
      router.push("/inbox"); 
    } catch (err) { 
      console.error(err); 
    } 
  };
  
  const handleReject = async () => { 
    if (!ideaId) return;
    try { 
      await fetch(`/api/ideas/${ideaId}/reject`, { method: "POST" }); 
      router.push("/inbox"); 
    } catch (err) { 
      console.error(err); 
    } 
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </AppLayout>
    );
  }
  
  if (!idea) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen text-muted-foreground">
          Idea not found
        </div>
      </AppLayout>
    );
  }

  const gatesExecuted = idea.gates_executed || idea.gate_results?.executed;
  
  const gates = [
    { id: 0, name: "Data Sufficiency", passed: idea.gate_results?.gate_0, hard: false },
    { id: 1, name: "Coherence", passed: idea.gate_results?.gate_1, hard: false },
    { id: 2, name: "Edge Claim", passed: idea.gate_results?.gate_2, hard: false },
    { id: 3, name: "Downside Shape", passed: idea.gate_results?.gate_3, hard: true },
    { id: 4, name: "Style Fit", passed: idea.gate_results?.gate_4, hard: true }
  ];

  const metrics = idea.quick_metrics || {};

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="page-header border-b border-border">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <Link 
                href="/inbox" 
                className="p-2 rounded-md hover:bg-secondary transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-medium">{idea.ticker}</h1>
                  <span className={cn(
                    "text-xs px-2 py-1 rounded uppercase tracking-wider",
                    idea.style === "quality_compounder" && "bg-emerald-500/10 text-emerald-400",
                    idea.style === "garp" && "bg-blue-500/10 text-blue-400",
                    (idea.style === "cigar_butt" || idea.style === "deep_value") && "bg-amber-500/10 text-amber-400"
                  )}>
                    {idea.style?.replace(/_/g, " ")}
                  </span>
                  {idea.is_new_ticker && (
                    <span className="text-xs px-2 py-1 rounded bg-accent/20 text-accent">
                      New Ticker
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground">{idea.company_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handlePromote} 
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-md hover:bg-emerald-500/30 transition-colors"
              >
                <ThumbsUp className="w-4 h-4" /> Promote to Lane B
              </button>
              <button 
                onClick={handleReject} 
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-md hover:bg-red-500/30 transition-colors"
              >
                <ThumbsDown className="w-4 h-4" /> Reject
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Investment Thesis */}
            <section className="bg-card rounded-lg p-6 border border-border">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-accent" />
                Investment Thesis
              </h2>
              <p className="text-lg leading-relaxed mb-4">
                {idea.headline || "No thesis available yet."}
              </p>
              {idea.one_liner && (
                <p className="text-muted-foreground italic border-l-2 border-accent/30 pl-4">
                  Mechanism: {idea.one_liner}
                </p>
              )}
              
              {/* Edge Types */}
              {idea.edge_type && idea.edge_type.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground mb-2">Edge Types:</p>
                  <div className="flex flex-wrap gap-2">
                    {idea.edge_type.map((edge, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-secondary rounded">
                        {edge}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Quick Metrics */}
            <section className="bg-card rounded-lg p-6 border border-border">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-accent" />
                Quick Metrics
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-secondary/30 rounded">
                  <div className="text-xs text-muted-foreground">Market Cap</div>
                  <div className="text-lg font-medium">{formatMarketCap(metrics.market_cap_usd)}</div>
                </div>
                <div className="p-3 bg-secondary/30 rounded">
                  <div className="text-xs text-muted-foreground">EV/EBITDA</div>
                  <div className="text-lg font-medium">{formatNumber(metrics.ev_to_ebitda)}x</div>
                </div>
                <div className="p-3 bg-secondary/30 rounded">
                  <div className="text-xs text-muted-foreground">P/E Ratio</div>
                  <div className="text-lg font-medium">{formatNumber(metrics.pe)}x</div>
                </div>
                <div className="p-3 bg-secondary/30 rounded">
                  <div className="text-xs text-muted-foreground">FCF Yield</div>
                  <div className="text-lg font-medium">{formatPercent(metrics.fcf_yield)}</div>
                </div>
                <div className="p-3 bg-secondary/30 rounded">
                  <div className="text-xs text-muted-foreground">Revenue CAGR (3Y)</div>
                  <div className="text-lg font-medium">{formatPercent(metrics.revenue_cagr_3y)}</div>
                </div>
                <div className="p-3 bg-secondary/30 rounded">
                  <div className="text-xs text-muted-foreground">EBIT Margin</div>
                  <div className="text-lg font-medium">{formatPercent(metrics.ebit_margin)}</div>
                </div>
                <div className="p-3 bg-secondary/30 rounded">
                  <div className="text-xs text-muted-foreground">Net Debt/EBITDA</div>
                  <div className="text-lg font-medium">{formatNumber(metrics.net_debt_to_ebitda)}x</div>
                </div>
                <div className="p-3 bg-secondary/30 rounded">
                  <div className="text-xs text-muted-foreground">Time Horizon</div>
                  <div className="text-lg font-medium">{idea.time_horizon?.replace(/_/g, "-") || "1-3 years"}</div>
                </div>
              </div>
            </section>

            {/* Gate Results */}
            <section className="bg-card rounded-lg p-6 border border-border">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-accent" />
                Gate Results
                {!gatesExecuted && (
                  <span className="text-xs px-2 py-1 bg-amber-500/20 text-amber-400 rounded ml-2">
                    Pending Execution
                  </span>
                )}
              </h2>
              
              {!gatesExecuted && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-200">
                    Gates have not been executed yet. This idea is in the initial discovery stage (Lane A). 
                    Gates will be evaluated when the idea is promoted to Lane B for deeper analysis.
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-5 gap-4">
                {gates.map((gate) => (
                  <div 
                    key={gate.id} 
                    className={cn(
                      "p-4 rounded-md border text-center",
                      !gatesExecuted 
                        ? "border-border bg-secondary/20"
                        : gate.passed 
                          ? "border-emerald-500/30 bg-emerald-500/5" 
                          : "border-red-500/30 bg-red-500/5"
                    )}
                  >
                    {!gatesExecuted ? (
                      <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    ) : gate.passed ? (
                      <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                    )}
                    <div className="text-xs font-medium">Gate {gate.id}</div>
                    <div className="text-xs text-muted-foreground">{gate.name}</div>
                    {gate.hard && gatesExecuted && !gate.passed && (
                      <div className="text-xs text-amber-400 mt-1 flex items-center justify-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Hard Fail
                      </div>
                    )}
                    {!gatesExecuted && (
                      <div className="text-xs text-muted-foreground/60 mt-1">Pending</div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Scoring */}
            <section className="bg-card rounded-lg p-6 border border-border">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent" />
                Scoring
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-secondary/30 rounded">
                  <div className="text-xs text-muted-foreground">Conviction</div>
                  <div className={cn(
                    "text-2xl font-medium",
                    idea.conviction_score >= 70 ? "text-emerald-400" :
                    idea.conviction_score >= 50 ? "text-amber-400" : "text-muted-foreground"
                  )}>
                    {idea.conviction_score || 0}/100
                  </div>
                </div>
                <div className="p-3 bg-secondary/30 rounded">
                  <div className="text-xs text-muted-foreground">Novelty</div>
                  <div className={cn(
                    "text-2xl font-medium capitalize",
                    idea.novelty_tag === "new" ? "text-accent" : "text-muted-foreground"
                  )}>
                    {idea.novelty_tag === "new" ? "New" : idea.novelty_tag === "seen_before" ? "Seen Before" : idea.novelty_tag || "Unknown"}
                  </div>
                </div>
                <div className="p-3 bg-secondary/30 rounded">
                  <div className="text-xs text-muted-foreground">Direction</div>
                  <div className="text-2xl font-medium capitalize text-emerald-400">
                    {idea.direction || "Long"}
                  </div>
                </div>
                <div className="p-3 bg-secondary/30 rounded">
                  <div className="text-xs text-muted-foreground">Style</div>
                  <div className="text-2xl font-medium capitalize">
                    {idea.style?.replace(/_/g, " ") || "Unknown"}
                  </div>
                </div>
              </div>
            </section>

            {/* Catalysts (if available) */}
            {idea.catalysts && idea.catalysts.length > 0 && (
              <section className="bg-card rounded-lg p-6 border border-border">
                <h2 className="text-lg font-medium mb-4">Catalysts</h2>
                <div className="space-y-3">
                  {idea.catalysts.map((catalyst, i) => (
                    <div key={i} className="p-4 bg-secondary/30 rounded-md">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{catalyst.name}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Window: {catalyst.window} | Impact: {catalyst.expected_impact}
                          </p>
                        </div>
                        <span className="text-sm text-accent">
                          {(catalyst.probability * 100).toFixed(0)}% probability
                        </span>
                      </div>
                      {catalyst.how_to_monitor && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Monitor: {catalyst.how_to_monitor}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* What's New Since Last Time */}
            {idea.whats_new_since_last_time && (
              <section className="bg-amber-500/10 rounded-lg p-6 border border-amber-500/20">
                <h2 className="text-lg font-medium mb-4 flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                  What&apos;s New Since Last Time
                </h2>
                <p className="text-sm">
                  {typeof idea.whats_new_since_last_time === 'string' 
                    ? idea.whats_new_since_last_time 
                    : JSON.stringify(idea.whats_new_since_last_time)}
                </p>
              </section>
            )}

            {/* Discovery Metadata */}
            <section className="bg-card rounded-lg p-6 border border-border">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent" />
                Discovery Metadata
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Discovery Date:</span>
                  <span className="ml-2">{formatDate(idea.discovery_date)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <span className={cn(
                    "ml-2 capitalize",
                    idea.status === "new" && "text-accent",
                    idea.status === "promoted" && "text-emerald-400",
                    idea.status === "rejected" && "text-red-400"
                  )}>
                    {idea.status}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Idea ID:</span>
                  <span className="ml-2 font-mono text-xs">{idea.ideaId?.slice(0, 8)}...</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Time Horizon:</span>
                  <span className="ml-2">{idea.time_horizon?.replace(/_/g, "-")}</span>
                </div>
              </div>
            </section>

          </div>
        </main>
      </div>
    </AppLayout>
  );
}
