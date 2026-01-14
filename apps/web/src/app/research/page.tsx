"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { FileText, DollarSign, Clock } from "lucide-react";

interface ResearchPacket {
  id: string;
  ticker: string;
  company_name: string;
  headline: string;
  style: string;
  recommendation?: string;
  is_complete: boolean;
  created_at: string;
  total_cost_usd?: number;
  total_duration_ms?: number;
}

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

export default function ResearchPage() {
  const [packets, setPackets] = useState<ResearchPacket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total_cost: number; total_packets: number; avg_duration: number } | null>(null);

  useEffect(() => {
    const fetchPackets = async () => {
      try {
        const res = await fetch("/api/research/packets");
        if (res.ok) {
          const data = await res.json();
          const packetsData = data.packets || [];
          setPackets(packetsData);
          
          if (packetsData.length > 0) {
            const totalCost = packetsData.reduce((sum: number, p: ResearchPacket) => sum + (p.total_cost_usd || 0), 0);
            const avgDuration = packetsData.reduce((sum: number, p: ResearchPacket) => sum + (p.total_duration_ms || 0), 0) / packetsData.length;
            setStats({ 
              total_cost: totalCost, 
              total_packets: packetsData.length,
              avg_duration: avgDuration 
            });
          }
        } else {
          setError("Failed to fetch packets");
        }
      } catch (err) {
        setError("Error fetching packets: " + String(err));
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
        <header className="border-b border-border">
          <div className="px-8 py-6">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-medium text-foreground tracking-tight">
                Research Packets
              </h1>
              <span className="text-sm text-muted-foreground">
                {completedPackets.length} complete · {inProgressPackets.length} in progress
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              IC-grade research from Lane B deep analysis
            </p>
          </div>

          {stats && stats.total_packets > 0 && (
            <div className="px-8 pb-4 flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="text-muted-foreground">Total Packets:</span>
                <span className="font-medium text-foreground">{stats.total_packets}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span className="text-muted-foreground">Research Cost:</span>
                <span className="font-medium text-foreground">${stats.total_cost.toFixed(4)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-purple-400" />
                <span className="text-muted-foreground">Avg Duration:</span>
                <span className="font-medium text-foreground">{formatDuration(stats.avg_duration)}</span>
              </div>
            </div>
          )}
        </header>
        <main className="flex-1 py-10">
          <div className="max-w-3xl mx-auto px-8">
            {loading && (
              <div className="text-center py-16">
                <p className="text-muted-foreground">Loading packets...</p>
              </div>
            )}
            {error && (
              <div className="text-center py-16">
                <p className="text-red-400">{error}</p>
              </div>
            )}
            {!loading && !error && packets.length === 0 && (
              <div className="text-center py-16">
                <p className="text-muted-foreground">No research packets yet.</p>
                <p className="text-sm text-muted-foreground/60 mt-2">
                  Promote ideas from Inbox to start Lane B research.
                </p>
              </div>
            )}
            {!loading && !error && packets.length > 0 && (
              <div className="space-y-8">
                {completedPackets.length > 0 && (
                  <section>
                    <h2 className="text-sm font-medium text-muted-foreground mb-4">
                      Completed Research
                    </h2>
                    <div className="space-y-3">
                      {completedPackets.map((packet) => (
                        <Link
                          key={packet.id}
                          href={`/research/${packet.id}`}
                          className="block p-4 border border-border rounded-lg hover:bg-secondary/30 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-lg font-medium">{packet.ticker}</span>
                              <span className="text-muted-foreground ml-2">{packet.company_name}</span>
                            </div>
                            <span className="text-sm text-emerald-400">Complete</span>
                          </div>
                          <p className="text-sm text-foreground/80 mt-2 line-clamp-2">
                            {packet.headline}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
                {inProgressPackets.length > 0 && (
                  <section>
                    <h2 className="text-sm font-medium text-muted-foreground mb-4">
                      In Progress
                    </h2>
                    <div className="space-y-3">
                      {inProgressPackets.map((packet) => (
                        <Link
                          key={packet.id}
                          href={`/research/${packet.id}`}
                          className="block p-4 border border-border rounded-lg hover:bg-secondary/30 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-lg font-medium">{packet.ticker}</span>
                              <span className="text-muted-foreground ml-2">{packet.company_name}</span>
                            </div>
                            <span className="text-sm text-amber-400">In Progress</span>
                          </div>
                          <p className="text-sm text-foreground/80 mt-2 line-clamp-2">
                            {packet.headline}
                          </p>
                        </Link>
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
