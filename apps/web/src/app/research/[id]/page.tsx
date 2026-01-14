"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface MonitoringPlanCatalyst {
  catalyst: string;
  timeframe: string;
  probability: string;
  impact: string;
}

interface MonitoringPlan {
  key_metrics?: string[];
  review_frequency?: string;
  red_flags?: string[];
  catalysts?: MonitoringPlanCatalyst[];
}

interface ModuleData {
  summary?: string;
  evidence?: string[];
  key_questions?: string[];
  unit_economics?: Record<string, unknown>;
}

interface RawPacketModules {
  business?: ModuleData;
  industry_moat?: ModuleData;
  financials?: ModuleData;
  capital_allocation?: ModuleData;
  management?: ModuleData;
  valuation?: ModuleData;
  risk?: ModuleData;
  synthesis?: ModuleData;
}

interface RawPacket {
  packet?: {
    modules?: RawPacketModules;
  };
}

interface Packet {
  id: string;
  ticker: string;
  company_name: string;
  headline: string;
  summary?: string;
  is_complete: boolean;
  style?: string;
  variant_perception?: string;
  historical_parallels?: string;
  pre_mortem?: string;
  monitoring_plan?: MonitoringPlan;
  _raw?: RawPacket;
}

const moduleConfig = [
  { key: "business", name: "Business Model" },
  { key: "industry_moat", name: "Industry & Moat" },
  { key: "financials", name: "Financial Forensics" },
  { key: "capital_allocation", name: "Capital Allocation" },
  { key: "management", name: "Management Quality" },
  { key: "valuation", name: "Valuation" },
  { key: "risk", name: "Risk & Stress" },
];

export default function ResearchDetailPage() {
  const params = useParams();
  const [packet, setPacket] = useState<Packet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const packetId = params?.id as string | undefined;

  useEffect(() => {
    const fetchPacket = async () => {
      if (!packetId) return;
      try {
        const res = await fetch(`/api/research/packets/${packetId}`);
        if (res.ok) {
          const data = await res.json();
          setPacket(data);
        } else {
          setError("Failed to fetch packet");
        }
      } catch (err) {
        setError("Error fetching packet");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (packetId) fetchPacket();
  }, [packetId]);

  const toggleModule = (key: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="animate-pulse">Loading packet...</div>
      </div>
    );
  }

  if (error || !packet) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <Link href="/research" className="text-accent hover:underline mb-4 block">
          Back to Research
        </Link>
        <div className="text-red-500">{error || "Packet not found"}</div>
      </div>
    );
  }

  const modules = packet._raw?.packet?.modules;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 px-8 py-6">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/research" className="p-2 rounded-md hover:bg-secondary transition-colors text-xl">
              Back
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{packet.ticker}</h1>
                {packet.style && (
                  <span className="text-sm text-accent uppercase">{packet.style.replace("_", " ")}</span>
                )}
                <span className={`px-2 py-0.5 rounded text-xs ${packet.is_complete ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                  {packet.is_complete ? "Complete" : "In Progress"}
                </span>
              </div>
              <p className="text-muted-foreground">{packet.company_name}</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors">
            Export PDF
          </button>
        </div>
      </header>
      
      <main className="p-8 max-w-6xl mx-auto space-y-8">
        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Executive Summary</h2>
          <p className="text-lg font-medium mb-4">{packet.headline}</p>
          {packet.summary && (
            <p className="text-muted-foreground">{packet.summary}</p>
          )}
        </section>

        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Research Modules</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {moduleConfig.map((mod) => {
              const moduleData = modules?.[mod.key as keyof RawPacketModules];
              const hasData = moduleData?.summary;
              const isExpanded = expandedModules.has(mod.key);
              
              return (
                <div
                  key={mod.key}
                  className={`p-4 rounded-md border cursor-pointer transition-all ${
                    hasData ? "border-green-500/30 bg-green-500/5 hover:bg-green-500/10" : "border-border bg-secondary/30"
                  }`}
                  onClick={() => hasData && toggleModule(mod.key)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{mod.name}</span>
                    <span className={hasData ? "text-green-500" : "text-muted-foreground"}>
                      {hasData ? "Complete" : "Pending"}
                    </span>
                  </div>
                  <p className={`text-sm text-muted-foreground ${isExpanded ? "" : "line-clamp-2"}`}>
                    {moduleData?.summary || "Pending analysis..."}
                  </p>
                  {hasData && (
                    <button 
                      className="text-xs text-accent mt-2 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleModule(mod.key);
                      }}
                    >
                      {isExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {packet.variant_perception && (
          <section className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Variant Perception</h2>
            <p className="text-sm text-foreground">{packet.variant_perception}</p>
          </section>
        )}

        {packet.historical_parallels && (
          <section className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Historical Parallels</h2>
            <p className="text-sm text-foreground">{packet.historical_parallels}</p>
          </section>
        )}

        {packet.pre_mortem && (
          <section className="bg-card border border-yellow-500/30 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Pre-Mortem Analysis</h2>
            <p className="text-sm text-foreground">{packet.pre_mortem}</p>
          </section>
        )}

        {packet.monitoring_plan && (
          <section className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Monitoring Plan</h2>
            
            {packet.monitoring_plan.review_frequency && (
              <div className="mb-4">
                <span className="text-sm text-muted-foreground">Review Frequency: </span>
                <span className="text-sm font-medium capitalize">{packet.monitoring_plan.review_frequency}</span>
              </div>
            )}

            {packet.monitoring_plan.key_metrics && packet.monitoring_plan.key_metrics.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2">Key Metrics to Monitor</h3>
                <ul className="list-disc list-inside space-y-1">
                  {packet.monitoring_plan.key_metrics.map((metric, i) => (
                    <li key={i} className="text-sm text-muted-foreground">{metric}</li>
                  ))}
                </ul>
              </div>
            )}

            {packet.monitoring_plan.red_flags && packet.monitoring_plan.red_flags.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2 text-red-400">Red Flags</h3>
                <ul className="list-disc list-inside space-y-1">
                  {packet.monitoring_plan.red_flags.map((flag, i) => (
                    <li key={i} className="text-sm text-red-300">{flag}</li>
                  ))}
                </ul>
              </div>
            )}

            {packet.monitoring_plan.catalysts && packet.monitoring_plan.catalysts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Catalysts</h3>
                <div className="space-y-3">
                  {packet.monitoring_plan.catalysts.map((cat, i) => (
                    <div key={i} className="p-3 bg-secondary/30 rounded-md">
                      <p className="text-sm text-foreground mb-2">{cat.catalyst}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Timeframe: {cat.timeframe}</span>
                        <span>Probability: {cat.probability}</span>
                        <span>Impact: {cat.impact}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
