"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { ChevronRight, Download, FileText, Cpu, DollarSign, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type RecommendationType = "BUY" | "HOLD" | "SELL" | "proceed" | "watch" | "pass";

interface PromptExecution {
  prompt_id: string;
  status: "completed" | "failed" | "skipped";
  tokens_used: number;
  cost_usd: number;
  execution_time_ms: number;
}

interface ResearchPacket {
  id: string;
  ticker: string;
  company_name: string;
  headline: string;
  style: string;
  recommendation?: RecommendationType;
  conviction_level?: "high" | "medium" | "low";
  conviction_score?: number;
  target_price?: number;
  current_price?: number;
  upside_percent?: number;
  gates_passed?: number;
  total_gates?: number;
  version: number;
  is_complete: boolean;
  created_at: string;
  // New fields
  prompts_executed?: PromptExecution[];
  total_tokens?: number;
  total_cost_usd?: number;
  total_duration_ms?: number;
  llm_provider?: string;
  llm_model?: string;
  modules_completed?: string[];
  key_findings?: string[];
}

const recommendationConfig: Record<string, { label: string; className: string; bgClass: string }> = {
  BUY: { label: "BUY", className: "text-emerald-400", bgClass: "bg-emerald-500/10" },
  HOLD: { label: "HOLD", className: "text-amber-400", bgClass: "bg-amber-500/10" },
  SELL: { label: "SELL", className: "text-red-400", bgClass: "bg-red-500/10" },
  proceed: { label: "Proceed", className: "text-emerald-400", bgClass: "bg-emerald-500/10" },
  watch: { label: "Watch", className: "text-amber-400", bgClass: "bg-amber-500/10" },
  pass: { label: "Pass", className: "text-muted-foreground", bgClass: "bg-muted/30" },
};

const styleLabels: Record<string, string> = {
  quality_compounder: "Quality",
  garp: "GARP",
  cigar_butt: "Deep Value",
  turnaround: "Turnaround",
  special_situation: "Special Situation",
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

export default function ResearchPage() {
  const [packets, setPackets] = useState<ResearchPacket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total_cost: number; total_packets: number; avg_duration: number } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchPackets = async () => {
      try {
        const res = await fetch("/api/research/packets");
        if (res.ok) {
          const data = await res.json();
          const packetsData = data.packets || [];
          setPackets(packetsData);
          
          // Calculate stats
          if (packetsData.length > 0) {
            const totalCost = packetsData.reduce((sum: number, p: ResearchPacket) => sum + (p.total_cost_usd || 0), 0);
            const avgDuration = packetsData.reduce((sum: number, p: ResearchPacket) => sum + (p.total_duration_ms || 0), 0) / packetsData.length;
            setStats({ 
              total_cost: totalCost, 
              total_packets: packetsData.length,
              avg_duration: avgDuration 
            });
          }
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

  const handleDownloadMemo = async (packet: ResearchPacket, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/research/${packet.id}/memo`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${packet.ticker}_research_memo_v${packet.version}.md`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Failed to download memo:', err);
    }
  };

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
                {completedPackets.length} complete · {inProgressPackets.length} in progress
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              IC-grade research from Lane B deep analysis
            </p>
          </div>

          {/* Stats bar */}
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

        {/* Main content */}
        <main className="flex-1 py-10">
          <div className="max-w-3xl mx-auto px-8">
            {loading ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground animate-pulse-calm">Loading packets...</p>
              </div>
            ) : packets.length === 0 ? (
              <div className="text-center py-16 animate-fade-in">
                <p className="text-muted-foreground">No research packets yet.</p>
                <p className="text-sm text-muted-foreground/60 mt-2">
                  Promote ideas from Inbox to start Lane B research.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Completed Packets */}
                {completedPackets.length > 0 && (
                  <section>
                    <h2 className="text-sm font-medium text-muted-foreground mb-4">
                      Completed Research
                    </h2>
                    <div className="space-y-3">
                      {completedPackets.map((packet, index) => (
                        <PacketCard
                          key={packet.id}
                          packet={packet}
                          index={index}
                          expanded={expandedId === packet.id}
                          onToggle={() => setExpandedId(expandedId === packet.id ? null : packet.id)}
                          onClick={() => router.push(`/research/${packet.id}`)}
                          onDownload={(e) => handleDownloadMemo(packet, e)}
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
                          expanded={expandedId === packet.id}
                          onToggle={() => setExpandedId(expandedId === packet.id ? null : packet.id)}
                          onClick={() => router.push(`/research/${packet.id}`)}
                          onDownload={(e) => handleDownloadMemo(packet, e)}
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
  expanded: boolean;
  onToggle: () => void;
  onClick: () => void;
  onDownload: (e: React.MouseEvent) => void;
}

function PacketCard({ packet, index, expanded, onToggle, onClick, onDownload }: PacketCardProps) {
  const recommendation = packet.recommendation || (packet.is_complete ? "proceed" : undefined);
  const recConfig = recommendation ? recommendationConfig[recommendation] : null;

  return (
    <article
      className={cn(
        "rounded-md bg-card border border-border/60 cursor-pointer animate-fade-in transition-calm",
        "hover:border-border hover:bg-secondary/10",
        expanded && "border-border bg-secondary/10"
      )}
      style={{ animationDelay: `${index * 75}ms` }}
    >
      {/* Main clickable area */}
      <div className="p-6" onClick={onToggle}>
        {/* Top row - Recommendation, upside, and style */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {recConfig && (
              <span className={cn("text-label px-2 py-0.5 rounded", recConfig.className, recConfig.bgClass)}>
                {recConfig.label}
              </span>
            )}
            {packet.upside_percent !== undefined && (
              <span className={cn(
                "text-annotation",
                packet.upside_percent > 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {packet.upside_percent > 0 ? "+" : ""}{packet.upside_percent.toFixed(1)}% upside
              </span>
            )}
            {!packet.is_complete && (
              <span className="text-label text-amber-400 animate-pulse">
                Processing...
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {packet.conviction_score && (
              <span className={cn(
                "text-annotation",
                packet.conviction_score >= 8 ? "text-emerald-400" :
                packet.conviction_score >= 6 ? "text-amber-400" : "text-muted-foreground"
              )}>
                Conv: {packet.conviction_score}/10
              </span>
            )}
            <span className="text-annotation text-muted-foreground/50">
              {styleLabels[packet.style] || packet.style?.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* Company identification */}
        <div className="flex items-baseline gap-2 mb-2">
          <h3 className="text-base font-medium text-foreground">{packet.company_name}</h3>
          <span className="text-sm font-mono text-muted-foreground/60">{packet.ticker}</span>
          {packet.target_price && packet.current_price && (
            <span className="text-sm text-muted-foreground ml-2">
              ${packet.current_price.toFixed(2)} → ${packet.target_price.toFixed(2)}
            </span>
          )}
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
            {packet.llm_model && (
              <span className="font-mono">{packet.llm_model}</span>
            )}
            {packet.total_cost_usd !== undefined && (
              <span>${packet.total_cost_usd.toFixed(4)}</span>
            )}
            <span>v{packet.version || 1}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onDownload}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-calm"
              title="Download Research Memo"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <ChevronRight className={cn(
              "w-4 h-4 text-muted-foreground/40 transition-transform",
              expanded && "rotate-90"
            )} />
          </div>
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="px-6 pb-6 animate-fade-in">
          <div className="pt-4 border-t border-border/30">
            {/* Execution metrics */}
            <div className="grid grid-cols-4 gap-4 mb-5 p-3 bg-secondary/20 rounded-lg">
              <div>
                <p className="text-annotation text-muted-foreground/60">Total Tokens</p>
                <p className="text-sm font-medium text-foreground">
                  {(packet.total_tokens || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-annotation text-muted-foreground/60">Total Cost</p>
                <p className="text-sm font-medium text-foreground">
                  ${(packet.total_cost_usd || 0).toFixed(4)}
                </p>
              </div>
              <div>
                <p className="text-annotation text-muted-foreground/60">Duration</p>
                <p className="text-sm font-medium text-foreground">
                  {formatDuration(packet.total_duration_ms || 0)}
                </p>
              </div>
              <div>
                <p className="text-annotation text-muted-foreground/60">LLM Provider</p>
                <p className="text-sm font-medium text-foreground capitalize">
                  {packet.llm_provider || 'openai'}
                </p>
              </div>
            </div>

            {/* Modules completed */}
            {packet.modules_completed && packet.modules_completed.length > 0 && (
              <div className="mb-5">
                <p className="text-annotation text-muted-foreground/60 mb-2">Modules Completed</p>
                <div className="flex flex-wrap gap-1.5">
                  {packet.modules_completed.map((module) => (
                    <span key={module} className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {module}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Prompts executed */}
            {packet.prompts_executed && packet.prompts_executed.length > 0 && (
              <div className="mb-5">
                <p className="text-annotation text-muted-foreground/60 mb-2">
                  Prompts Executed ({packet.prompts_executed.length})
                </p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {packet.prompts_executed.map((exec, i) => (
                    <div 
                      key={`${exec.prompt_id}-${i}`}
                      className="flex items-center justify-between text-xs p-2 bg-secondary/30 rounded"
                    >
                      <div className="flex items-center gap-2">
                        {exec.status === 'completed' ? (
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                        ) : exec.status === 'failed' ? (
                          <AlertCircle className="w-3 h-3 text-red-400" />
                        ) : (
                          <span className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                        )}
                        <span className="font-mono">{exec.prompt_id}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{exec.tokens_used.toLocaleString()} tokens</span>
                        <span>${exec.cost_usd.toFixed(4)}</span>
                        <span>{formatDuration(exec.execution_time_ms)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key findings */}
            {packet.key_findings && packet.key_findings.length > 0 && (
              <div className="mb-5">
                <p className="text-annotation text-muted-foreground/60 mb-2">Key Findings</p>
                <ul className="space-y-1">
                  {packet.key_findings.map((finding, i) => (
                    <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                      <span className="text-accent mt-1">•</span>
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-border/30">
              <button
                onClick={onClick}
                className={cn(
                  "flex items-center gap-2 text-sm rounded-md",
                  "bg-accent text-accent-foreground",
                  "hover:bg-accent/90 transition-calm"
                )}
                style={{ padding: '8px 16px', fontWeight: 450 }}
              >
                <FileText className="w-3.5 h-3.5" />
                View Full Research
              </button>
              
              <button
                onClick={onDownload}
                className={cn(
                  "flex items-center gap-2 text-sm rounded-md",
                  "bg-secondary text-secondary-foreground",
                  "hover:bg-secondary/70 transition-calm"
                )}
                style={{ padding: '8px 16px', fontWeight: 450 }}
              >
                <Download className="w-3.5 h-3.5" />
                Download Memo
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
