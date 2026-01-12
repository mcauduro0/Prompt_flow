import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResearchPacket {
  id: string;
  company: string;
  ticker: string;
  completedAt: string;
  recommendation: "proceed" | "pass" | "watch";
  conviction: "high" | "medium" | "low";
  gatesPassed: number;
  totalGates: number;
}

const packets: ResearchPacket[] = [
  {
    id: "1",
    company: "Constellation Software",
    ticker: "CSU.TO",
    completedAt: "Today, 2:30 PM",
    recommendation: "proceed",
    conviction: "high",
    gatesPassed: 8,
    totalGates: 8,
  },
  {
    id: "2",
    company: "AutoZone",
    ticker: "AZO",
    completedAt: "Yesterday",
    recommendation: "watch",
    conviction: "medium",
    gatesPassed: 6,
    totalGates: 8,
  },
  {
    id: "3",
    company: "Fairfax Financial",
    ticker: "FFH.TO",
    completedAt: "3 days ago",
    recommendation: "pass",
    conviction: "low",
    gatesPassed: 4,
    totalGates: 8,
  },
];

const recommendationConfig = {
  proceed: {
    label: "Proceed",
    description: "Ready for allocation",
  },
  pass: {
    label: "Pass",
    description: "Does not meet criteria",
  },
  watch: {
    label: "Watch",
    description: "Monitor for developments",
  },
};

export default function ResearchPackets() {
  const [selectedPacket, setSelectedPacket] = useState<string | null>(null);
  const navigate = useNavigate();

  const handlePacketClick = (packetId: string) => {
    setSelectedPacket(packetId);
    navigate(`/research/${packetId}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="page-header">
        <div className="flex items-baseline" style={{ gap: 'var(--space-3)' }}>
          <h1 className="page-header-title">Research Packets</h1>
          <span className="text-supporting text-muted-foreground">
            {packets.length} complete
          </span>
        </div>
        <p className="page-header-subtitle">
          Completed analysis ready for decision
        </p>
      </header>

      {/* Main content */}
      <main 
        className="flex-1"
        style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-10)' }}
      >
        <div className="content-area">
          {/* Packets list with generous spacing */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {packets.map((packet, index) => {
              const config = recommendationConfig[packet.recommendation];

              return (
                <button
                  key={packet.id}
                  onClick={() => handlePacketClick(packet.id)}
                  className={cn(
                    "w-full rounded-md bg-card border text-left transition-calm animate-fade-in group",
                    selectedPacket === packet.id 
                      ? "border-accent/30 bg-secondary/20" 
                      : "border-border/50 hover:border-border/80 hover:bg-secondary/10"
                  )}
                  style={{ 
                    padding: 'var(--space-6)',
                    animationDelay: `${index * 100}ms` 
                  }}
                >
                  <div className="flex items-start justify-between" style={{ gap: 'var(--space-6)' }}>
                    <div className="flex-1 min-w-0">
                      {/* Company identification */}
                      <div 
                        className="flex items-baseline"
                        style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}
                      >
                        <h3 className="text-subsection text-foreground">{packet.company}</h3>
                        <span className="text-annotation font-mono text-muted-foreground/60">{packet.ticker}</span>
                      </div>
                      
                      {/* Completion time - Quiet annotation */}
                      <p 
                        className="text-annotation text-muted-foreground/60"
                        style={{ marginBottom: 'var(--space-4)' }}
                      >
                        Completed {packet.completedAt}
                      </p>
                      
                      {/* Recommendation and description */}
                      <div className="flex items-baseline" style={{ gap: 'var(--space-4)' }}>
                        <span className={cn(
                          "text-supporting",
                          packet.recommendation === "proceed" && "text-accent",
                          packet.recommendation === "watch" && "text-warning/70",
                          packet.recommendation === "pass" && "text-muted-foreground/70"
                        )} style={{ fontWeight: 450 }}>
                          {config.label}
                        </span>
                        <span className="text-annotation text-muted-foreground/50">
                          {config.description}
                        </span>
                      </div>
                    </div>

                    {/* Right side: Gates and navigation */}
                    <div className="flex items-center" style={{ gap: 'var(--space-5)' }}>
                      <div className="text-right">
                        <p className="text-supporting text-muted-foreground/70">
                          {packet.gatesPassed}/{packet.totalGates} gates
                        </p>
                        <p className={cn(
                          "text-annotation capitalize",
                          packet.conviction === "high" && "text-foreground/70",
                          packet.conviction === "medium" && "text-muted-foreground/60",
                          packet.conviction === "low" && "text-muted-foreground/40"
                        )}>
                          {packet.conviction} conviction
                        </p>
                      </div>

                      <ChevronRight 
                        className="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-calm" 
                        style={{ width: '16px', height: '16px' }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Empty state */}
          {packets.length === 0 && (
            <div className="text-center" style={{ padding: 'var(--space-12) 0' }}>
              <p className="text-muted-foreground">No completed research packets.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
