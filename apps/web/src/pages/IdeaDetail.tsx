import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Eye, X, ChevronDown, ChevronRight, ExternalLink, FileText, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface Evidence {
  id: string;
  type: "document" | "transcript" | "filing" | "data";
  title: string;
  source: string;
  date: string;
  summary: string;
  relevance: "high" | "medium" | "low";
  excerpt?: string;
}

interface Gate {
  id: string;
  name: string;
  passed: boolean;
  detail: string;
}

interface IdeaData {
  id: string;
  company: string;
  ticker: string;
  style: "Quality" | "GARP" | "Cigar Butt";
  novelty: "New" | "Reappearance" | "Repeat";
  hypothesis: string;
  mechanism: string;
  whatsNew?: string;
  hasEdge: boolean;
  hasCatalyst: boolean;
  catalystDetail?: string;
  edgeDetail?: string;
  lastSeen?: string;
  rejectionHistory?: {
    date: string;
    reason: string;
  };
  evidence: Evidence[];
  gates: Gate[];
}

// Sample data
const sampleIdea: IdeaData = {
  id: "1",
  company: "Constellation Software",
  ticker: "CSU.TO",
  style: "Quality",
  novelty: "Reappearance",
  lastSeen: "6 months ago",
  hypothesis: "Vertical market software roll-up with exceptional capital allocation. Serial acquirer with 30%+ ROIC and sticky recurring revenue base showing acceleration in M&A pipeline.",
  mechanism: "The company acquires small vertical market software businesses at reasonable multiples, then improves operations while maintaining the entrepreneurial culture that made them successful. The decentralized model allows for rapid deployment of capital across hundreds of opportunities while avoiding the integration failures common in traditional M&A. As the company scales, its reputation and operational expertise create a flywheel effect—more quality targets approach them, deal flow increases, and per-deal diligence costs decrease.",
  whatsNew: "M&A pipeline has accelerated significantly in Q3, with 15 acquisitions announced compared to 8 in Q2. Average deal size has increased, suggesting confidence in deployment capacity. New operating group structure may indicate preparation for larger transactions.",
  hasEdge: true,
  hasCatalyst: true,
  edgeDetail: "Proprietary analysis of acquisition patterns suggests larger deals in pipeline. Historical precedent indicates these periods precede multiple expansion.",
  catalystDetail: "Q4 earnings expected to show acceleration in deployed capital. Management commentary on capital allocation priorities could re-rate the stock.",
  rejectionHistory: {
    date: "6 months ago",
    reason: "Valuation concern at 28x forward earnings during growth deceleration. Waiting for either multiple compression or re-acceleration in organic growth."
  },
  evidence: [
    {
      id: "e1",
      type: "filing",
      title: "Q3 2024 Quarterly Report",
      source: "SEDAR+",
      date: "Nov 2024",
      summary: "15 acquisitions completed in quarter, highest since 2019. Organic growth stable at 2%.",
      relevance: "high",
      excerpt: "During the quarter, we deployed $847 million across 15 acquisitions, representing our most active quarter since the spin-off of Topicus. We continue to see attractive opportunities across all operating groups..."
    },
    {
      id: "e2",
      type: "transcript",
      title: "Annual Meeting Transcript",
      source: "Company",
      date: "May 2024",
      summary: "Mark Leonard discussed evolution of acquisition strategy and operating group autonomy.",
      relevance: "high",
      excerpt: "We've been experimenting with larger acquisitions in recent years. The results have been encouraging enough that we're prepared to deploy more capital at the $100M+ range..."
    },
    {
      id: "e3",
      type: "document",
      title: "Industry Analysis: VMS Landscape",
      source: "Internal Research",
      date: "Oct 2024",
      summary: "Competitive analysis showing CSU's structural advantages in VMS consolidation.",
      relevance: "medium"
    },
    {
      id: "e4",
      type: "data",
      title: "Historical Acquisition Pattern Analysis",
      source: "Internal Model",
      date: "Current",
      summary: "Quantitative analysis of acquisition timing and subsequent returns. Current pattern matches 2017 setup.",
      relevance: "high"
    },
  ],
  gates: [
    { id: "g1", name: "Business Quality", passed: true, detail: "30%+ ROIC, recurring revenue, high customer retention" },
    { id: "g2", name: "Management Integrity", passed: true, detail: "Long track record, aligned incentives, transparent communication" },
    { id: "g3", name: "Competitive Position", passed: true, detail: "Structural advantages in acquisition, decentralized model hard to replicate" },
    { id: "g4", name: "Valuation Discipline", passed: true, detail: "Trading at 22x forward, below 5-year average of 28x" },
    { id: "g5", name: "Downside Analysis", passed: true, detail: "Limited downside: recurring revenue provides floor, no debt, strong cash generation" },
    { id: "g6", name: "Position Sizing", passed: false, detail: "Current portfolio allocation may limit position size" },
  ]
};

export default function IdeaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);
  const [showAllEvidence, setShowAllEvidence] = useState(false);

  // In a real app, fetch based on id
  const idea = sampleIdea;

  const gatesPassed = idea.gates.filter(g => g.passed).length;
  const totalGates = idea.gates.length;

  const styleLabel = {
    "Quality": "Quality",
    "GARP": "GARP",
    "Cigar Butt": "Deep Value"
  };

  const evidenceTypeIcon = {
    document: FileText,
    transcript: FileText,
    filing: FileText,
    data: FileText,
  };

  const visibleEvidence = showAllEvidence ? idea.evidence : idea.evidence.slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Rejection Shadow Banner - If previously rejected */}
      {idea.rejectionHistory && (
        <div 
          className="bg-secondary/50 border-b border-border/50"
          style={{ padding: 'var(--space-4) var(--space-8)' }}
        >
          <div className="content-area flex items-start gap-4" style={{ padding: 0 }}>
            <AlertTriangle 
              className="text-warning/60 flex-shrink-0" 
              style={{ width: '16px', height: '16px', marginTop: '2px' }} 
            />
            <div>
              <p className="text-supporting text-foreground/80" style={{ fontWeight: 450 }}>
                Previously passed · {idea.rejectionHistory.date}
              </p>
              <p className="text-annotation text-muted-foreground" style={{ marginTop: 'var(--space-1)' }}>
                {idea.rejectionHistory.reason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="page-header">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/inbox")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-calm text-supporting"
          >
            <ArrowLeft style={{ width: '16px', height: '16px' }} />
            Back to Inbox
          </button>
          
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-label",
              idea.novelty === "New" && "text-accent",
              idea.novelty === "Reappearance" && "text-muted-foreground/70",
              idea.novelty === "Repeat" && "text-muted-foreground/40"
            )}>
              {idea.novelty}
            </span>
            <span className="text-muted-foreground/30">·</span>
            <span className={cn(
              "text-annotation",
              idea.style === "Quality" && "text-accent/60",
              idea.style === "GARP" && "text-foreground/40",
              idea.style === "Cigar Butt" && "text-warning/50"
            )}>
              {styleLabel[idea.style]}
            </span>
          </div>
        </div>
        
        <div style={{ marginTop: 'var(--space-5)' }}>
          <div className="flex items-baseline gap-3">
            <h1 className="page-header-title">{idea.company}</h1>
            <span className="text-supporting font-mono text-muted-foreground/60">{idea.ticker}</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main 
        className="flex-1"
        style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-12)' }}
      >
        <div className="content-area">
          
          {/* Hypothesis Section */}
          <section className="animate-fade-in">
            <h2 className="text-label text-muted-foreground/60" style={{ marginBottom: 'var(--space-3)' }}>
              Investment Hypothesis
            </h2>
            <p 
              className="text-body text-foreground reading-width"
              style={{ lineHeight: 1.8, fontSize: '1rem' }}
            >
              {idea.hypothesis}
            </p>
          </section>

          {/* Mechanism Section */}
          <section 
            className="animate-fade-in"
            style={{ marginTop: 'var(--space-8)' }}
          >
            <h2 className="text-label text-muted-foreground/60" style={{ marginBottom: 'var(--space-3)' }}>
              Mechanism
            </h2>
            <p 
              className="text-body text-foreground/85 reading-width prose"
              style={{ lineHeight: 1.8 }}
            >
              {idea.mechanism}
            </p>
          </section>

          {/* What's New Section - Only if reappearance */}
          {idea.whatsNew && (
            <section 
              className="animate-fade-in"
              style={{ marginTop: 'var(--space-8)' }}
            >
              <h2 className="text-label text-accent/70" style={{ marginBottom: 'var(--space-3)' }}>
                New Information
              </h2>
              <div 
                className="bg-accent/5 rounded-md reading-width"
                style={{ padding: 'var(--space-5)' }}
              >
                <p className="text-body text-foreground/85" style={{ lineHeight: 1.75 }}>
                  {idea.whatsNew}
                </p>
              </div>
            </section>
          )}

          {/* Edge & Catalyst */}
          {(idea.hasEdge || idea.hasCatalyst) && (
            <section 
              className="animate-fade-in"
              style={{ marginTop: 'var(--space-8)' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {idea.hasEdge && idea.edgeDetail && (
                  <div>
                    <h3 className="text-label text-muted-foreground/60" style={{ marginBottom: 'var(--space-2)' }}>
                      Evidence Edge
                    </h3>
                    <p className="text-supporting text-foreground/75 reading-width" style={{ lineHeight: 1.65 }}>
                      {idea.edgeDetail}
                    </p>
                  </div>
                )}
                {idea.hasCatalyst && idea.catalystDetail && (
                  <div>
                    <h3 className="text-label text-muted-foreground/60" style={{ marginBottom: 'var(--space-2)' }}>
                      Near-Term Catalyst
                    </h3>
                    <p className="text-supporting text-foreground/75 reading-width" style={{ lineHeight: 1.65 }}>
                      {idea.catalystDetail}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Section Divider */}
          <div 
            className="flex items-center"
            style={{ 
              gap: 'var(--space-4)', 
              marginTop: 'var(--space-10)',
              marginBottom: 'var(--space-6)'
            }}
          >
            <span className="text-label text-muted-foreground/50">
              Supporting Evidence
            </span>
            <div className="flex-1 border-t border-border/30" />
          </div>

          {/* Evidence List */}
          <section className="animate-fade-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {visibleEvidence.map((evidence) => {
                const Icon = evidenceTypeIcon[evidence.type];
                const isExpanded = expandedEvidence === evidence.id;

                return (
                  <button
                    key={evidence.id}
                    onClick={() => setExpandedEvidence(isExpanded ? null : evidence.id)}
                    className={cn(
                      "w-full text-left bg-card border rounded-md transition-calm",
                      isExpanded ? "border-border/60" : "border-border/40 hover:border-border/60"
                    )}
                    style={{ padding: 'var(--space-4) var(--space-5)' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Icon 
                          className="text-muted-foreground/40 flex-shrink-0" 
                          style={{ width: '14px', height: '14px', marginTop: '3px' }} 
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-3 flex-wrap">
                            <h4 className="text-supporting text-foreground" style={{ fontWeight: 450 }}>
                              {evidence.title}
                            </h4>
                            <span className="text-annotation text-muted-foreground/50">
                              {evidence.source} · {evidence.date}
                            </span>
                          </div>
                          <p 
                            className="text-annotation text-muted-foreground"
                            style={{ marginTop: 'var(--space-1)' }}
                          >
                            {evidence.summary}
                          </p>
                          
                          {/* Expanded excerpt */}
                          {isExpanded && evidence.excerpt && (
                            <div 
                              className="animate-fade-in border-t border-border/30"
                              style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)' }}
                            >
                              <p 
                                className="text-supporting text-foreground/70 italic"
                                style={{ lineHeight: 1.7 }}
                              >
                                "{evidence.excerpt}"
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={cn(
                          "text-annotation",
                          evidence.relevance === "high" && "text-accent/70",
                          evidence.relevance === "medium" && "text-muted-foreground/60",
                          evidence.relevance === "low" && "text-muted-foreground/40"
                        )}>
                          {evidence.relevance}
                        </span>
                        {evidence.excerpt && (
                          <ChevronDown 
                            className={cn(
                              "text-muted-foreground/40 transition-calm",
                              isExpanded && "rotate-180"
                            )}
                            style={{ width: '14px', height: '14px' }}
                          />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {idea.evidence.length > 3 && (
              <button
                onClick={() => setShowAllEvidence(!showAllEvidence)}
                className="text-supporting text-muted-foreground hover:text-foreground transition-calm"
                style={{ marginTop: 'var(--space-4)' }}
              >
                {showAllEvidence ? "Show less" : `Show all ${idea.evidence.length} sources`}
              </button>
            )}
          </section>

          {/* Gate Results */}
          <div 
            className="flex items-center"
            style={{ 
              gap: 'var(--space-4)', 
              marginTop: 'var(--space-10)',
              marginBottom: 'var(--space-6)'
            }}
          >
            <span className="text-label text-muted-foreground/50">
              Gate Results
            </span>
            <span className="text-annotation text-muted-foreground/40">
              {gatesPassed}/{totalGates} passed
            </span>
            <div className="flex-1 border-t border-border/30" />
          </div>

          <section className="animate-fade-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {idea.gates.map((gate) => (
                <div 
                  key={gate.id}
                  className="flex items-start gap-4"
                  style={{ padding: 'var(--space-3) 0' }}
                >
                  <span 
                    className={cn(
                      "flex-shrink-0 rounded-full",
                      gate.passed ? "bg-success/20" : "bg-muted"
                    )}
                    style={{ width: '8px', height: '8px', marginTop: '6px' }}
                  />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-3">
                      <span className={cn(
                        "text-supporting",
                        gate.passed ? "text-foreground" : "text-muted-foreground"
                      )} style={{ fontWeight: gate.passed ? 450 : 400 }}>
                        {gate.name}
                      </span>
                      {!gate.passed && (
                        <span className="text-annotation text-muted-foreground/50">
                          Not passed
                        </span>
                      )}
                    </div>
                    <p className="text-annotation text-muted-foreground" style={{ marginTop: 'var(--space-1)' }}>
                      {gate.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Actions */}
          <section 
            className="animate-fade-in border-t border-border/40"
            style={{ marginTop: 'var(--space-10)', paddingTop: 'var(--space-8)' }}
          >
            <div className="flex items-center" style={{ gap: 'var(--space-3)' }}>
              <button
                onClick={() => console.log("Promote:", idea.id)}
                className={cn(
                  "flex items-center gap-2 text-supporting rounded-md",
                  "bg-accent text-accent-foreground",
                  "hover:bg-accent/90 transition-calm"
                )}
                style={{ padding: 'var(--space-3) var(--space-5)', fontWeight: 450 }}
              >
                <ArrowUpRight style={{ width: '16px', height: '16px' }} />
                Promote to deep research
              </button>
              
              <button
                onClick={() => console.log("Watch:", idea.id)}
                className={cn(
                  "flex items-center gap-2 text-supporting rounded-md",
                  "bg-secondary text-secondary-foreground",
                  "hover:bg-secondary/70 transition-calm"
                )}
                style={{ padding: 'var(--space-3) var(--space-5)', fontWeight: 450 }}
              >
                <Eye style={{ width: '16px', height: '16px' }} />
                Add to watchlist
              </button>
              
              <button
                onClick={() => console.log("Pass:", idea.id)}
                className={cn(
                  "flex items-center gap-2 text-supporting rounded-md",
                  "text-muted-foreground",
                  "hover:text-foreground hover:bg-secondary/40 transition-calm"
                )}
                style={{ padding: 'var(--space-3) var(--space-5)' }}
              >
                <X style={{ width: '16px', height: '16px' }} />
                Reject with reason
              </button>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
