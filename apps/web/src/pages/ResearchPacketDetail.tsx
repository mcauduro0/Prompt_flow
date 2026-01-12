import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, Check, AlertTriangle, X, TrendingUp, TrendingDown, Minus, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface Scenario {
  probability: number;
  targetPrice: string;
  irr: string;
  narrative: string;
  keyDrivers: string[];
}

interface Risk {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  description: string;
  mitigation?: string;
}

interface InvalidationTrigger {
  id: string;
  trigger: string;
  threshold?: string;
}

interface ResearchPacketData {
  id: string;
  company: string;
  ticker: string;
  completedAt: string;
  analyst: string;
  recommendation: "proceed" | "pass" | "watch";
  conviction: "high" | "medium" | "low";
  
  // Decision Brief
  decisionBrief: {
    verdict: string;
    oneSentence: string;
    positionSizing: string;
    timeHorizon: string;
  };
  
  // Variant Perception
  variantPerception: {
    consensus: string;
    ourView: string;
    whyWereDifferent: string;
  };
  
  // Scenarios - Use "upside" and "downside" per brand rules
  upsideCase: Scenario;
  baseCase: Scenario;
  downsideCase: Scenario;
  
  // Risks
  keyRisks: Risk[];
  
  // Pre-mortem
  preMortem: {
    scenario: string;
    causes: string[];
    earlyWarnings: string[];
  };
  
  // Invalidation
  invalidationTriggers: InvalidationTrigger[];
  
  // Deep Analysis sections (expandable)
  deepAnalysis: {
    businessModel: string;
    competitivePosition: string;
    management: string;
    valuation: string;
    historicalContext: string;
  };
}

// Sample data
const samplePacket: ResearchPacketData = {
  id: "1",
  company: "Constellation Software",
  ticker: "CSU.TO",
  completedAt: "January 10, 2026",
  analyst: "Research System",
  recommendation: "proceed",
  conviction: "high",
  
  decisionBrief: {
    verdict: "Recommendation: Proceed",
    oneSentence: "Capital allocator with 20-year track record trading at reasonable valuation. M&A pipeline accelerating. Downside limited by recurring revenue and balance sheet strength.",
    positionSizing: "Full position (3-5%). Quality of business and management support full allocation.",
    timeHorizon: "5+ years. Long-duration holding, not catalyst-driven.",
  },
  
  variantPerception: {
    consensus: "Market views CSU as mature software holding company with limited growth. Concerns about deal flow sustainability and integration of larger acquisitions.",
    ourView: "Evidence suggests market underestimates duration of M&A runway and optionality from operating group structure. Shift toward larger deals reflects evolution.",
    whyWereDifferent: "Proprietary analysis of VMS deal flow suggests 15+ years of acquisition runway. Market anchored on organic growth rates rather than return on deployed capital.",
  },
  
  upsideCase: {
    probability: 25,
    targetPrice: "C$5,200",
    irr: "28%",
    narrative: "Larger acquisitions succeed. Organic growth inflects positive. Multiple expands as market recognizes duration of compounding.",
    keyDrivers: [
      "Integration of $500M+ acquisitions succeeds",
      "Organic growth returns to 3-5%",
      "Operating group structure unlocks additional deal capacity",
      "Multiple expands to 30x forward earnings"
    ],
  },
  
  baseCase: {
    probability: 55,
    targetPrice: "C$4,100",
    irr: "18%",
    narrative: "Continued steady execution of proven model. M&A activity remains healthy. Organic growth flat. Valuation stable.",
    keyDrivers: [
      "10-12 acquisitions per quarter maintained",
      "ROIC remains above 25%",
      "Organic growth flat to slightly positive",
      "Multiple stable at 22-25x"
    ],
  },
  
  downsideCase: {
    probability: 20,
    targetPrice: "C$2,400",
    irr: "-8%",
    narrative: "Deal flow deteriorates. Larger acquisitions underperform. Market de-rates on growth concerns.",
    keyDrivers: [
      "Competition for deals intensifies, prices rise",
      "Large acquisition integration challenges emerge",
      "Organic growth turns negative (-3%)",
      "Key operating group leaders depart",
      "Multiple compresses to 15x"
    ],
  },
  
  keyRisks: [
    {
      id: "r1",
      title: "Deal Flow Sustainability",
      severity: "medium",
      description: "The VMS market is finite. As CSU grows larger, finding sufficient deal flow to move the needle becomes increasingly challenging.",
      mitigation: "Expansion into adjacent verticals and geographies. Operating group structure distributes sourcing across more autonomous units."
    },
    {
      id: "r2",
      title: "Large Deal Integration",
      severity: "high",
      description: "Recent shift toward larger acquisitions ($100M+) departs from proven playbook of small, tuck-in deals. Integration risk is inherently higher.",
      mitigation: "Management has been transparent about learning curve. Early large deals (Topicus, Allscripts) show mixed but acceptable results."
    },
    {
      id: "r3",
      title: "Key Person Risk",
      severity: "medium",
      description: "Mark Leonard's unique philosophy and culture are central to CSU's success. Succession planning remains opaque.",
      mitigation: "Operating group structure has developed deep bench of experienced capital allocators. Culture appears embedded in organization."
    },
    {
      id: "r4",
      title: "Technology Disruption",
      severity: "low",
      description: "Cloud-native competitors could theoretically disrupt entrenched vertical market software.",
      mitigation: "VMS customers prioritize stability and integration over cutting-edge technology. Switching costs remain extremely high."
    },
  ],
  
  preMortem: {
    scenario: "It is January 2029. Our CSU position has lost 40% of its value. We are conducting a post-mortem. What went wrong?",
    causes: [
      "Mark Leonard stepped back and successors couldn't maintain capital allocation discipline",
      "The shift to larger deals proved to be a strategic error—integration costs exceeded synergies",
      "Private equity competition for VMS assets drove acquisition multiples to uneconomic levels",
      "Organic revenue declined 5%+ annually as customers migrated to modern cloud solutions",
      "A major acquisition (>$1B) resulted in significant write-down"
    ],
    earlyWarnings: [
      "ROIC on recent vintages falling below 20%",
      "Organic growth declining for 3+ consecutive quarters",
      "Operating group heads departing to competitors",
      "Acquisition pace slowing while cash builds on balance sheet",
      "Management commentary becoming defensive about deal quality"
    ],
  },
  
  invalidationTriggers: [
    { id: "i1", trigger: "ROIC falls below 20% for two consecutive years", threshold: "< 20% ROIC" },
    { id: "i2", trigger: "Organic revenue declines exceed 5% annually", threshold: "> -5% organic" },
    { id: "i3", trigger: "Mark Leonard fully exits operating role without clear succession", threshold: "Succession event" },
    { id: "i4", trigger: "Major acquisition write-down (>$500M)", threshold: "> $500M impairment" },
    { id: "i5", trigger: "Debt/EBITDA exceeds 3x", threshold: "> 3x leverage" },
  ],
  
  deepAnalysis: {
    businessModel: "Constellation Software operates as a decentralized holding company for vertical market software (VMS) businesses. The model is simple: acquire small, profitable VMS companies at reasonable multiples, allow them to operate autonomously while providing best practices, and reinvest all cash flows into additional acquisitions. The genius is in the execution—Mark Leonard has built a culture and process for evaluating hundreds of potential deals annually, moving quickly on the best opportunities, and maintaining discipline on price.\n\nVMS businesses are characterized by: (1) mission-critical software deeply embedded in customer operations, (2) high switching costs due to training, integrations, and data lock-in, (3) recurring revenue models with 90%+ retention, (4) niche markets too small to attract large competitors, and (5) stable, cash-generative profiles with minimal capex requirements.",
    competitivePosition: "CSU's competitive moat has multiple layers. First, their reputation allows them to be the 'buyer of choice' for VMS founders—they offer operational continuity, employee retention, and fair treatment that private equity cannot match. Second, their operational expertise enables them to identify improvement opportunities that others miss. Third, their decentralized structure allows them to move faster than strategic acquirers with bureaucratic approval processes. Fourth, their scale provides advantages in due diligence, financing, and pattern recognition across hundreds of VMS businesses.\n\nThe closest competitors are private equity roll-ups, but they typically have shorter time horizons, higher leverage, and less operational sophistication. Strategic acquirers (Oracle, SAP) focus on larger deals and often destroy value through forced integration.",
    management: "Mark Leonard founded CSU in 1995 and has built one of the most impressive track records in public markets. His annual letters are legendary for their transparency, intellectual rigor, and long-term thinking. The culture he has built emphasizes: (1) extreme decentralization, (2) rigorous capital allocation, (3) long-term thinking, (4) continuous learning, and (5) humility about mistakes.\n\nThe operating group structure (Volaris, Harris, Jonas, Perseus, Vela, Topicus) has developed strong leaders who embody the CSU philosophy. While succession remains a risk, the organization has demonstrated that the culture persists beyond any individual.",
    valuation: "At current prices (~C$3,400), CSU trades at approximately 22x forward earnings—below its 5-year average of 28x. On a FCF yield basis, the stock offers approximately 4.5%, which may appear unexciting until you consider: (1) FCF has compounded at 20%+ for two decades, (2) all FCF is reinvested at 25%+ ROIC, and (3) the business has no debt and minimal capital requirements.\n\nOur DCF analysis, assuming 15% FCF growth for 10 years tapering to 5% terminal growth at a 10% discount rate, suggests fair value of C$4,100—approximately 20% upside from current levels. This is consistent with our base case IRR of 18%.",
    historicalContext: "CSU has been in our research universe since 2018. We passed on the idea twice previously: in 2019 (valuation at 35x felt stretched) and in 2021 (organic growth concerns during COVID). The stock subsequently rose 80% from our 2019 pass, validating the quality thesis but suggesting our valuation discipline may be too conservative for truly exceptional businesses.\n\nWe revisited the idea in late 2025 following the valuation reset (from 30x to 22x) and the acceleration in M&A activity. This reappearance reflects both improved valuation and our evolved understanding of how to value long-duration compounders.",
  },
};

export default function ResearchPacketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  // In production, fetch based on id
  const packet = samplePacket;

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const isExpanded = (section: string) => expandedSections.includes(section);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="page-header">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/research")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-calm text-supporting"
          >
            <ArrowLeft style={{ width: '16px', height: '16px' }} />
            Back to Packets
          </button>
          
          <span className="text-annotation text-muted-foreground/60">
            Completed {packet.completedAt}
          </span>
        </div>
        
        <div style={{ marginTop: 'var(--space-5)' }}>
          <div className="flex items-baseline gap-3">
            <h1 className="page-header-title">{packet.company}</h1>
            <span className="text-supporting font-mono text-muted-foreground/60">{packet.ticker}</span>
          </div>
          <p className="text-annotation text-muted-foreground/50" style={{ marginTop: 'var(--space-1)' }}>
            Research Packet · {packet.conviction} conviction
          </p>
        </div>
      </header>

      {/* Main content */}
      <main 
        className="flex-1"
        style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-12)' }}
      >
        <div className="content-area">
          
          {/* ===== DECISION BRIEF - Pinned at top, anchor for decision ===== */}
          <section className="animate-fade-in">
            <div 
              className={cn(
                "rounded-md border-2",
                packet.recommendation === "proceed" && "border-accent/40 bg-accent/5",
                packet.recommendation === "watch" && "border-warning/30 bg-warning/5",
                packet.recommendation === "pass" && "border-muted bg-muted/30"
              )}
              style={{ padding: 'var(--space-6)' }}
            >
              <div className="flex items-start justify-between" style={{ marginBottom: 'var(--space-4)' }}>
                <h2 className="text-label text-muted-foreground/70">Decision Brief</h2>
                <span className={cn(
                  "text-supporting",
                  packet.recommendation === "proceed" && "text-accent",
                  packet.recommendation === "watch" && "text-warning/80",
                  packet.recommendation === "pass" && "text-muted-foreground"
                )} style={{ fontWeight: 500 }}>
                  {packet.decisionBrief.verdict}
                </span>
              </div>
              
              <p 
                className="text-section-title text-foreground reading-width"
                style={{ lineHeight: 1.5, marginBottom: 'var(--space-5)' }}
              >
                {packet.decisionBrief.oneSentence}
              </p>
              
              <div 
                className="grid gap-4 border-t border-border/30"
                style={{ 
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  paddingTop: 'var(--space-4)'
                }}
              >
                <div>
                  <span className="text-annotation text-muted-foreground/60">Position Sizing</span>
                  <p className="text-supporting text-foreground/85" style={{ marginTop: 'var(--space-1)' }}>
                    {packet.decisionBrief.positionSizing}
                  </p>
                </div>
                <div>
                  <span className="text-annotation text-muted-foreground/60">Time Horizon</span>
                  <p className="text-supporting text-foreground/85" style={{ marginTop: 'var(--space-1)' }}>
                    {packet.decisionBrief.timeHorizon}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ===== VARIANT PERCEPTION ===== */}
          <section style={{ marginTop: 'var(--space-10)' }} className="animate-fade-in">
            <h2 className="text-label text-muted-foreground/60" style={{ marginBottom: 'var(--space-4)' }}>
              Variant Perception
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <div>
                <h3 className="text-annotation text-muted-foreground" style={{ marginBottom: 'var(--space-2)' }}>
                  Market Consensus
                </h3>
                <p className="text-body text-foreground/75 reading-width" style={{ lineHeight: 1.75 }}>
                  {packet.variantPerception.consensus}
                </p>
              </div>
              
              <div>
                <h3 className="text-annotation text-accent/70" style={{ marginBottom: 'var(--space-2)' }}>
                  Variant View
                </h3>
                <p className="text-body text-foreground reading-width" style={{ lineHeight: 1.75 }}>
                  {packet.variantPerception.ourView}
                </p>
              </div>
              
              <div className="bg-secondary/30 rounded-md reading-width" style={{ padding: 'var(--space-4)' }}>
                <h3 className="text-annotation text-muted-foreground" style={{ marginBottom: 'var(--space-2)' }}>
                  Source of Differentiation
                </h3>
                <p className="text-supporting text-foreground/80" style={{ lineHeight: 1.65 }}>
                  {packet.variantPerception.whyWereDifferent}
                </p>
              </div>
            </div>
          </section>

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
              Scenarios
            </span>
            <div className="flex-1 border-t border-border/30" />
          </div>

          {/* ===== UPSIDE / BASE / DOWNSIDE SCENARIOS ===== */}
          <section className="animate-fade-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              
              {/* Upside Case */}
              <ScenarioCard
                type="upside"
                scenario={packet.upsideCase}
                icon={<TrendingUp style={{ width: '16px', height: '16px' }} />}
              />
              
              {/* Base Case */}
              <ScenarioCard
                type="base"
                scenario={packet.baseCase}
                icon={<Minus style={{ width: '16px', height: '16px' }} />}
              />
              
              {/* Downside Case - Slightly more prominent */}
              <ScenarioCard
                type="downside"
                scenario={packet.downsideCase}
                icon={<TrendingDown style={{ width: '16px', height: '16px' }} />}
                prominent
              />
            </div>
          </section>

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
              Risk Assessment
            </span>
            <div className="flex-1 border-t border-border/30" />
          </div>

          {/* ===== KEY RISKS ===== */}
          <section className="animate-fade-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {packet.keyRisks.map((risk) => (
                <div 
                  key={risk.id}
                  className="bg-card border border-border/40 rounded-md"
                  style={{ padding: 'var(--space-5)' }}
                >
                  <div className="flex items-start justify-between" style={{ marginBottom: 'var(--space-2)' }}>
                    <h4 className="text-subsection text-foreground">{risk.title}</h4>
                    <span className={cn(
                      "text-annotation",
                      risk.severity === "high" && "text-warning/70",
                      risk.severity === "medium" && "text-muted-foreground/70",
                      risk.severity === "low" && "text-muted-foreground/50"
                    )}>
                      {risk.severity} severity
                    </span>
                  </div>
                  <p className="text-supporting text-foreground/75 reading-width" style={{ lineHeight: 1.65 }}>
                    {risk.description}
                  </p>
                  {risk.mitigation && (
                    <div 
                      className="border-t border-border/30"
                      style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)' }}
                    >
                      <span className="text-annotation text-muted-foreground/60">Mitigation: </span>
                      <span className="text-annotation text-foreground/70">{risk.mitigation}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ===== PRE-MORTEM - Slightly more prominent ===== */}
          <section 
            className="animate-fade-in"
            style={{ marginTop: 'var(--space-10)' }}
          >
            <div 
              className="bg-secondary/40 border border-border/50 rounded-md"
              style={{ padding: 'var(--space-6)' }}
            >
              <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-4)' }}>
                <AlertTriangle className="text-warning/60" style={{ width: '16px', height: '16px' }} />
                <h3 className="text-label text-foreground/80">Pre-Mortem Analysis</h3>
              </div>
              
              <p 
                className="text-body text-foreground/85 italic reading-width"
                style={{ lineHeight: 1.75, marginBottom: 'var(--space-5)' }}
              >
                "{packet.preMortem.scenario}"
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-6)' }}>
                <div>
                  <h4 className="text-annotation text-muted-foreground" style={{ marginBottom: 'var(--space-3)' }}>
                    What Went Wrong
                  </h4>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {packet.preMortem.causes.map((cause, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <X className="text-fail/50 flex-shrink-0" style={{ width: '12px', height: '12px', marginTop: '4px' }} />
                        <span className="text-supporting text-foreground/75">{cause}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-annotation text-muted-foreground" style={{ marginBottom: 'var(--space-3)' }}>
                    Early Warning Signs
                  </h4>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {packet.preMortem.earlyWarnings.map((warning, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertTriangle className="text-warning/50 flex-shrink-0" style={{ width: '12px', height: '12px', marginTop: '4px' }} />
                        <span className="text-supporting text-foreground/75">{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* ===== INVALIDATION TRIGGERS - Guardrails that stand out ===== */}
          <section style={{ marginTop: 'var(--space-8)' }} className="animate-fade-in">
            <div 
              className="border-2 border-dashed border-border/60 rounded-md"
              style={{ padding: 'var(--space-5)' }}
            >
              <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-4)' }}>
                <Shield className="text-muted-foreground/60" style={{ width: '16px', height: '16px' }} />
                <h3 className="text-label text-foreground/70">Invalidation Triggers</h3>
                <span className="text-annotation text-muted-foreground/50">— Exit if any occur</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {packet.invalidationTriggers.map((trigger) => (
                  <div 
                    key={trigger.id}
                    className="flex items-center justify-between"
                    style={{ padding: 'var(--space-2) 0' }}
                  >
                    <span className="text-supporting text-foreground/80">{trigger.trigger}</span>
                    {trigger.threshold && (
                      <span className="text-annotation font-mono text-muted-foreground/60">
                        {trigger.threshold}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

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
              Deep Analysis
            </span>
            <span className="text-annotation text-muted-foreground/40">Expand to read</span>
            <div className="flex-1 border-t border-border/30" />
          </div>

          {/* ===== DEEP ANALYSIS - Expandable sections ===== */}
          <section className="animate-fade-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <ExpandableSection
                title="Business Model"
                content={packet.deepAnalysis.businessModel}
                isExpanded={isExpanded("businessModel")}
                onToggle={() => toggleSection("businessModel")}
              />
              <ExpandableSection
                title="Competitive Position"
                content={packet.deepAnalysis.competitivePosition}
                isExpanded={isExpanded("competitivePosition")}
                onToggle={() => toggleSection("competitivePosition")}
              />
              <ExpandableSection
                title="Management Assessment"
                content={packet.deepAnalysis.management}
                isExpanded={isExpanded("management")}
                onToggle={() => toggleSection("management")}
              />
              <ExpandableSection
                title="Valuation Analysis"
                content={packet.deepAnalysis.valuation}
                isExpanded={isExpanded("valuation")}
                onToggle={() => toggleSection("valuation")}
              />
              <ExpandableSection
                title="Historical Context"
                content={packet.deepAnalysis.historicalContext}
                isExpanded={isExpanded("historicalContext")}
                onToggle={() => toggleSection("historicalContext")}
              />
            </div>
          </section>

          {/* ===== ACTIONS ===== */}
          <section 
            className="animate-fade-in border-t border-border/40"
            style={{ marginTop: 'var(--space-10)', paddingTop: 'var(--space-8)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center" style={{ gap: 'var(--space-3)' }}>
                <button
                  onClick={() => console.log("Allocate")}
                  className={cn(
                    "flex items-center gap-2 text-supporting rounded-md",
                    "bg-accent text-accent-foreground",
                    "hover:bg-accent/90 transition-calm"
                  )}
                  style={{ padding: 'var(--space-3) var(--space-5)', fontWeight: 450 }}
                >
                  <Check style={{ width: '16px', height: '16px' }} />
                  Confirm position
                </button>
                
                <button
                  onClick={() => console.log("Watch")}
                  className={cn(
                    "flex items-center gap-2 text-supporting rounded-md",
                    "bg-secondary text-secondary-foreground",
                    "hover:bg-secondary/70 transition-calm"
                  )}
                  style={{ padding: 'var(--space-3) var(--space-5)', fontWeight: 450 }}
                >
                  Add to watchlist
                </button>
                
                <button
                  onClick={() => console.log("Pass")}
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
              
              <button
                onClick={() => window.print()}
                className="text-annotation text-muted-foreground hover:text-foreground transition-calm"
              >
                Download packet
              </button>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}

// ===== SCENARIO CARD COMPONENT =====
interface ScenarioCardProps {
  type: "upside" | "base" | "downside";
  scenario: Scenario;
  icon: React.ReactNode;
  prominent?: boolean;
}

function ScenarioCard({ type, scenario, icon, prominent }: ScenarioCardProps) {
  const labels = {
    upside: "Upside Case",
    base: "Base Case",
    downside: "Downside Case"
  };

  return (
    <div 
      className={cn(
        "bg-card border rounded-md",
        prominent ? "border-border/60" : "border-border/40",
        type === "downside" && "bg-secondary/20"
      )}
      style={{ padding: 'var(--space-5)' }}
    >
      <div className="flex items-start justify-between" style={{ marginBottom: 'var(--space-3)' }}>
        <div className="flex items-center gap-2">
          <span className={cn(
            type === "upside" && "text-success/70",
            type === "base" && "text-muted-foreground",
            type === "downside" && "text-warning/70"
          )}>
            {icon}
          </span>
          <h4 className={cn(
            "text-subsection",
            type === "downside" ? "text-foreground" : "text-foreground/90"
          )} style={{ fontWeight: prominent ? 500 : 450 }}>
            {labels[type]}
          </h4>
          <span className="text-annotation text-muted-foreground/50">
            {scenario.probability}% probability
          </span>
        </div>
        
        <div className="flex items-center" style={{ gap: 'var(--space-4)' }}>
          <div className="text-right">
            <span className="text-annotation text-muted-foreground/60">Target</span>
            <p className="text-supporting font-mono text-foreground/80">{scenario.targetPrice}</p>
          </div>
          <div className="text-right">
            <span className="text-annotation text-muted-foreground/60">IRR</span>
            <p className={cn(
              "text-supporting font-mono",
              parseFloat(scenario.irr) > 0 ? "text-success/80" : "text-fail/80"
            )}>
              {scenario.irr}
            </p>
          </div>
        </div>
      </div>
      
      <p 
        className="text-supporting text-foreground/75 reading-width"
        style={{ lineHeight: 1.65, marginBottom: 'var(--space-4)' }}
      >
        {scenario.narrative}
      </p>
      
      <div className="border-t border-border/30" style={{ paddingTop: 'var(--space-3)' }}>
        <span className="text-annotation text-muted-foreground/60">Key Drivers</span>
        <ul 
          style={{ 
            marginTop: 'var(--space-2)', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 'var(--space-1)' 
          }}
        >
          {scenario.keyDrivers.map((driver, i) => (
            <li key={i} className="flex items-start gap-2">
              <span 
                className="rounded-full bg-muted-foreground/20 flex-shrink-0" 
                style={{ width: '4px', height: '4px', marginTop: '8px' }}
              />
              <span className="text-annotation text-foreground/70">{driver}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ===== EXPANDABLE SECTION COMPONENT =====
interface ExpandableSectionProps {
  title: string;
  content: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function ExpandableSection({ title, content, isExpanded, onToggle }: ExpandableSectionProps) {
  return (
    <div className="border border-border/40 rounded-md overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between bg-card hover:bg-secondary/20 transition-calm"
        style={{ padding: 'var(--space-4) var(--space-5)' }}
      >
        <span className="text-supporting text-foreground" style={{ fontWeight: 450 }}>
          {title}
        </span>
        <ChevronDown 
          className={cn(
            "text-muted-foreground/50 transition-calm",
            isExpanded && "rotate-180"
          )}
          style={{ width: '16px', height: '16px' }}
        />
      </button>
      
      {isExpanded && (
        <div 
          className="border-t border-border/30 bg-background animate-fade-in"
          style={{ padding: 'var(--space-5)' }}
        >
          {content.split('\n\n').map((paragraph, i) => (
            <p 
              key={i}
              className="text-body text-foreground/80 reading-width"
              style={{ 
                lineHeight: 1.8,
                marginTop: i > 0 ? 'var(--space-5)' : 0
              }}
            >
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
