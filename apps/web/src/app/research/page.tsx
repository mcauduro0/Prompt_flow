"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { ChevronRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";

type RecommendationType = "proceed" | "watch" | "pass";

interface ResearchPacket {
  id: string;
  ticker: string;
  company_name: string;
  headline: string;
  style: string;
  recommendation?: RecommendationType;
  conviction_level?: "high" | "medium" | "low";
  gates_passed?: number;
  total_gates?: number;
  version: number;
  is_complete: boolean;
  created_at: string;
}

const recommendationConfig: Record<RecommendationType, { label: string; className: string }> = {
  proceed: { label: "Proceed", className: "text-accent" },
  watch: { label: "Watch", className: "text-warning" },
  pass: { label: "Pass", className: "text-muted-foreground" },
};

const styleLabels: Record<string, string> = {
  quality_compounder: "Quality",
  garp: "GARP",
  cigar_butt: "Deep Value",
  turnaround: "Turnaround",
  special_situation: "Special Situation",
};

export default function ResearchPage() {
  const [packets, setPackets] = useState<ResearchPacket[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchPackets = async () => {
      try {
        const res = await fetch("/api/research");
        if (res.ok) {
          const data = await res.json();
          setPackets(data.packets || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPackets();
  }, []);

  const completedPackets = packets.filter(p => p.is_complete);
  const inProgressPackets = packets.filter(p => !p.is_complete);

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border">
          <div className="px-8 py-6">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-medium text-foreground tracking-tight">
                Research Packets
              </h1>
              <span className="text-sm text-muted-foreground">
                {completedPackets.length} complete
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              IC-grade research for investment decisions
            </p>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 py-10">
          <div className="max-w-2xl mx-auto px-8">
            {loading ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground animate-pulse-calm">Loading packets...</p>
              </div>
            ) : packets.length === 0 ? (
              <div className="text-center py-16 animate-fade-in">
                <p className="text-muted-foreground">No research packets yet.</p>
                <p className="text-sm text-muted-foreground/60 mt-2">
                  Completed Lane B research will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Completed Packets */}
                {completedPackets.length > 0 && (
                  <section>
                    <h2 className="text-sm font-medium text-muted-foreground mb-4">
                      Completed
                    </h2>
                    <div className="space-y-3">
                      {completedPackets.map((packet, index) => (
                        <PacketCard
                          key={packet.id}
                          packet={packet}
                          index={index}
                          onClick={() => router.push(`/research/${packet.id}`)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* In Progress Packets */}
                {inProgressPackets.length > 0 && (
                  <section>
                    <h2 className="text-sm font-medium text-muted-foreground mb-4">
                      In Progress
                    </h2>
                    <div className="space-y-3">
                      {inProgressPackets.map((packet, index) => (
                        <PacketCard
                          key={packet.id}
                          packet={packet}
                          index={index + completedPackets.length}
                          onClick={() => router.push(`/research/${packet.id}`)}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}

interface PacketCardProps {
  packet: ResearchPacket;
  index: number;
  onClick: () => void;
}

function PacketCard({ packet, index, onClick }: PacketCardProps) {
  const recommendation = packet.recommendation || (packet.is_complete ? "proceed" : undefined);
  const recConfig = recommendation ? recommendationConfig[recommendation] : null;

  return (
    <article
      className={cn(
        "p-6 rounded-md bg-card border border-border/60 cursor-pointer animate-fade-in transition-calm",
        "hover:border-border hover:bg-secondary/10"
      )}
      style={{ animationDelay: `${index * 75}ms` }}
      onClick={onClick}
    >
      {/* Top row - Recommendation and style */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {recConfig && (
            <span className={cn("text-label", recConfig.className)}>
              {recConfig.label}
            </span>
          )}
          {!packet.is_complete && (
            <span className="text-label text-muted-foreground/50">
              In Progress
            </span>
          )}
        </div>
        <span className="text-annotation text-muted-foreground/50">
          {styleLabels[packet.style] || packet.style?.replace(/_/g, " ")}
        </span>
      </div>

      {/* Company identification */}
      <div className="flex items-baseline gap-2 mb-2">
        <h3 className="text-base font-medium text-foreground">{packet.company_name}</h3>
        <span className="text-sm font-mono text-muted-foreground/60">{packet.ticker}</span>
      </div>

      {/* Headline */}
      <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2 mb-4">
        {packet.headline}
      </p>

      {/* Bottom row - Metadata */}
      <div className="flex items-center justify-between pt-3 border-t border-border/20">
        <div className="flex items-center gap-4 text-annotation text-muted-foreground/50">
          {packet.gates_passed !== undefined && packet.total_gates && (
            <span>{packet.gates_passed}/{packet.total_gates} gates</span>
          )}
          {packet.conviction_level && (
            <span className={cn(
              packet.conviction_level === "high" && "text-accent/70",
              packet.conviction_level === "medium" && "text-foreground/50",
              packet.conviction_level === "low" && "text-muted-foreground/40"
            )}>
              {packet.conviction_level} conviction
            </span>
          )}
          <span>v{packet.version || 1}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Download PDF
            }}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-calm"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
        </div>
      </div>
    </article>
  );
}
