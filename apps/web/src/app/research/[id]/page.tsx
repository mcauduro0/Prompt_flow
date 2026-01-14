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
  modules?: Array<{ status?: string; summary?: string }>;
}

const moduleNames = ["Business Model", "Industry & Moat", "Financial Forensics", "Capital Allocation", "Management Quality", "Valuation", "Risk & Stress"];

export default function ResearchDetailPage() {
  const params = useParams();
  const [packet, setPacket] = useState<Packet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
            {moduleNames.map((mod, i) => {
              const moduleData = packet.modules?.[i] || {};
              const isComplete = moduleData.status === "complete";
              return (
                <div
                  key={i}
                  className={`p-4 rounded-md border ${
                    isComplete ? "border-green-500/30 bg-green-500/5" : "border-border bg-secondary/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{mod}</span>
                    <span className={isComplete ? "text-green-500" : "text-muted-foreground"}>
                      {isComplete ? "Done" : "Pending"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {moduleData.summary || "Pending analysis..."}
                  </p>
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
