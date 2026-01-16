"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { FileText, DollarSign, Clock, CheckCircle, ArrowRight, Check } from "lucide-react";

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
  ic_memo_status?: string; // pending, generating, complete, failed, or null
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
  const [selectedPackets, setSelectedPackets] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState<string | null>(null);
  const [approvingBatch, setApprovingBatch] = useState(false);

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

  useEffect(() => {
    fetchPackets();
  }, []);

  const handleApproveForIC = async (packetId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setApproving(packetId);
    try {
      const res = await fetch(`/api/ic-memos/approve/${packetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedBy: "user" }),
      });
      
      if (res.ok) {
        // Refresh packets to get updated IC memo status
        await fetchPackets();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to approve for IC");
      }
    } catch (err) {
      alert("Error approving for IC: " + String(err));
    } finally {
      setApproving(null);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedPackets.size === 0) return;
    
    setApprovingBatch(true);
    try {
      const res = await fetch("/api/ic-memos/approve-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          packetIds: Array.from(selectedPackets),
          approvedBy: "user" 
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`Approved ${data.approved_count} packets for IC Memo generation`);
        setSelectedPackets(new Set());
        await fetchPackets();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to approve batch");
      }
    } catch (err) {
      alert("Error in batch approval: " + String(err));
    } finally {
      setApprovingBatch(false);
    }
  };

  const togglePacketSelection = (packetId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const newSelected = new Set(selectedPackets);
    if (newSelected.has(packetId)) {
      newSelected.delete(packetId);
    } else {
      newSelected.add(packetId);
    }
    setSelectedPackets(newSelected);
  };

  const selectAllEligible = () => {
    const eligible = completedPackets
      .filter(p => !p.ic_memo_status)
      .map(p => p.id);
    setSelectedPackets(new Set(eligible));
  };

  const clearSelection = () => {
    setSelectedPackets(new Set());
  };

  const completedPackets = packets.filter(p => p.is_complete);
  const inProgressPackets = packets.filter(p => !p.is_complete);
  const eligibleForIC = completedPackets.filter(p => !p.ic_memo_status);

  const getICMemoStatusBadge = (status: string | undefined) => {
    if (!status) return null;
    
    switch (status) {
      case 'pending':
        return <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">IC Pending</span>;
      case 'generating':
        return <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">IC Generating</span>;
      case 'complete':
        return <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">IC Complete</span>;
      case 'failed':
        return <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">IC Failed</span>;
      default:
        return null;
    }
  };

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

          {/* Batch Actions Bar */}
          {eligibleForIC.length > 0 && (
            <div className="px-8 pb-4 flex items-center gap-4 border-t border-border pt-4">
              <span className="text-sm text-muted-foreground">
                {eligibleForIC.length} eligible for IC Memo
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllEligible}
                  className="text-xs px-2 py-1 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Select All
                </button>
                {selectedPackets.size > 0 && (
                  <>
                    <button
                      onClick={clearSelection}
                      className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear ({selectedPackets.size})
                    </button>
                    <button
                      onClick={handleBatchApprove}
                      disabled={approvingBatch}
                      className="text-xs px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <ArrowRight className="w-3 h-3" />
                      {approvingBatch ? "Approving..." : `Approve ${selectedPackets.size} for IC`}
                    </button>
                  </>
                )}
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
                        <div
                          key={packet.id}
                          className="relative p-4 border border-border rounded-lg hover:bg-secondary/30 transition-colors"
                        >
                          {/* Selection checkbox for eligible packets */}
                          {!packet.ic_memo_status && (
                            <button
                              onClick={(e) => togglePacketSelection(packet.id, e)}
                              className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                selectedPackets.has(packet.id)
                                  ? "bg-emerald-600 border-emerald-600"
                                  : "border-border hover:border-emerald-600"
                              }`}
                            >
                              {selectedPackets.has(packet.id) && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </button>
                          )}
                          
                          <Link
                            href={`/research/${packet.id}`}
                            className={`block ${!packet.ic_memo_status ? "pl-8" : ""}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-medium">{packet.ticker}</span>
                                <span className="text-muted-foreground">{packet.company_name}</span>
                                {getICMemoStatusBadge(packet.ic_memo_status)}
                              </div>
                              <div className="flex items-center gap-2">
                                {!packet.ic_memo_status && (
                                  <button
                                    onClick={(e) => handleApproveForIC(packet.id, e)}
                                    disabled={approving === packet.id}
                                    className="text-xs px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                                  >
                                    <CheckCircle className="w-3 h-3" />
                                    {approving === packet.id ? "..." : "Approve for IC"}
                                  </button>
                                )}
                                <span className="text-sm text-emerald-400">Complete</span>
                              </div>
                            </div>
                            <p className="text-sm text-foreground/80 mt-2 line-clamp-2">
                              {packet.headline}
                            </p>
                          </Link>
                        </div>
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
