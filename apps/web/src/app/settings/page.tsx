"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { Lock, Clock, Shield, Layers } from "lucide-react";

const lockedParams = [
  { category: "Lane A", name: "Daily Idea Limit", value: "120", description: "Maximum ideas generated per day" },
  { category: "Lane A", name: "Discovery Schedule", value: "06:00 Mon-Fri", description: "Daily discovery run time (São Paulo)" },
  { category: "Lane A", name: "Novelty New Threshold", value: "90 days", description: "Days without appearance to be considered new" },
  { category: "Lane A", name: "Novelty Penalty Window", value: "30 days", description: "Days after rejection before reappearance" },
  { category: "Lane B", name: "Daily Packet Limit", value: "3", description: "Maximum packets per day" },
  { category: "Lane B", name: "Weekly Packet Limit", value: "10", description: "Maximum packets per week" },
  { category: "Lane B", name: "Research Schedule", value: "08:00 Mon-Fri", description: "Daily Lane B run time (São Paulo)" },
  { category: "Gates", name: "Gate 3 (Downside)", value: "Hard Fail", description: "Binary override for leverage/liquidity/regulatory" },
  { category: "Gates", name: "Gate 4 (Style Fit)", value: "Hard Fail", description: "Style-specific threshold enforcement" },
  { category: "QA", name: "QA Report Schedule", value: "18:00 Friday", description: "Weekly QA report generation (São Paulo)" },
  { category: "QA", name: "IC Bundle Schedule", value: "19:00 Friday", description: "Weekly IC bundle generation (São Paulo)" },
];

const styleTargets = [{ style: "Quality", target: "30%", threshold: "0.75" }, { style: "GARP", target: "25%", threshold: "0.70" }, { style: "Cigar Butt", target: "15%", threshold: "0.65" }, { style: "Turnaround", target: "15%", threshold: "0.60" }, { style: "Special Situation", target: "15%", threshold: "0.60" }];

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        <header className="page-header"><h1 className="page-header-title">Settings</h1><p className="page-header-subtitle">System configuration and locked parameters</p></header>
        <main className="flex-1 p-8">
          <div className="content-area space-y-8">
            <section className="governance-card"><div className="flex items-center gap-3 mb-6"><Lock className="w-6 h-6 text-accent" /><h2 className="text-section-title">Locked Parameters</h2></div><p className="text-sm text-muted-foreground mb-6">These parameters are governed by the Operating Parameters specification and cannot be modified without explicit approval and documented rationale.</p><div className="space-y-4">{["Lane A", "Lane B", "Gates", "QA"].map((category) => (<div key={category}><h3 className="text-sm font-medium text-accent mb-3">{category}</h3><div className="grid gap-3">{lockedParams.filter((p) => p.category === category).map((param) => (<div key={param.name} className="flex items-center justify-between p-3 bg-secondary/50 rounded-md"><div><div className="font-medium text-sm">{param.name}</div><div className="text-xs text-muted-foreground">{param.description}</div></div><div className="flex items-center gap-2"><span className="font-mono text-sm">{param.value}</span><Lock className="w-3 h-3 text-muted-foreground" /></div></div>))}</div></div>))}</div></section>
            <section className="governance-card"><div className="flex items-center gap-3 mb-6"><Layers className="w-6 h-6 text-accent" /><h2 className="text-section-title">Style Mix Targets</h2></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border"><th className="text-left py-2 px-3 font-medium">Style</th><th className="text-left py-2 px-3 font-medium">Target Allocation</th><th className="text-left py-2 px-3 font-medium">Promotion Threshold</th></tr></thead><tbody>{styleTargets.map((s) => (<tr key={s.style} className="border-b border-border/50"><td className="py-2 px-3">{s.style}</td><td className="py-2 px-3 font-mono">{s.target}</td><td className="py-2 px-3 font-mono">{s.threshold}</td></tr>))}</tbody></table></div></section>
            <section className="governance-card"><div className="flex items-center gap-3 mb-6"><Clock className="w-6 h-6 text-accent" /><h2 className="text-section-title">Schedule Overview</h2></div><p className="text-sm text-muted-foreground mb-4">All times in America/Sao_Paulo timezone. Jobs run Monday-Friday only.</p><div className="grid md:grid-cols-2 gap-4"><div className="p-4 bg-secondary/50 rounded-md"><div className="font-medium mb-2">Daily Jobs</div><div className="space-y-2 text-sm"><div className="flex justify-between"><span>Lane A Discovery</span><span className="font-mono">06:00</span></div><div className="flex justify-between"><span>Lane B Research</span><span className="font-mono">08:00</span></div></div></div><div className="p-4 bg-secondary/50 rounded-md"><div className="font-medium mb-2">Weekly Jobs (Friday)</div><div className="space-y-2 text-sm"><div className="flex justify-between"><span>QA Report</span><span className="font-mono">18:00</span></div><div className="flex justify-between"><span>IC Bundle</span><span className="font-mono">19:00</span></div></div></div></div></section>
            <section className="governance-card governance-card-warn"><div className="flex items-center gap-3 mb-4"><Shield className="w-6 h-6 text-warning" /><h2 className="text-section-title">Governance Notice</h2></div><p className="text-sm">The Weekly QA Report is a <strong>locked governance layer</strong>. No thresholds, alarms, or section logic may be changed without an explicit request and documented rationale. All changes require approval and must be reflected in the Operating Parameters specification.</p></section>
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
