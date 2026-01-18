'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { Lock, Layers, Clock, Shield, Zap, Calendar } from 'lucide-react';

const lockedParams = [
  // Lane 0
  { category: "Lane 0", name: "Daily Limit", value: "200 ideas", description: "Max ideas from Substack + Reddit per day" },
  { category: "Lane 0", name: "Max Per Source", value: "100 ideas", description: "Max ideas per source (Substack/Reddit)" },
  { category: "Lane 0", name: "Schedule", value: "05:00 daily", description: "Lane 0 run time (São Paulo)" },
  
  // Lane A
  { category: "Lane A", name: "Daily Target", value: "200 ideas", description: "Target ideas for daily discovery" },
  { category: "Lane A", name: "Daily Cap", value: "200 ideas", description: "Hard cap on daily idea processing" },
  { category: "Lane A", name: "LLM Enrichment Cap", value: "200 ideas", description: "Max ideas for LLM enrichment" },
  { category: "Lane A", name: "Exploration Rate", value: "10%", description: "Random selection for diversity" },
  { category: "Lane A", name: "Schedule", value: "06:00 daily", description: "Lane A run time (São Paulo)" },
  
  // Lane B
  { category: "Lane B", name: "Daily Packet Limit", value: "50 packets", description: "Max research packets per day" },
  { category: "Lane B", name: "Weekly Packet Limit", value: "200 packets", description: "Max research packets per week" },
  { category: "Lane B", name: "Max Concurrency", value: "3 jobs", description: "Parallel research jobs" },
  { category: "Lane B", name: "Time Per Name", value: "60-120 min", description: "Time budget per research packet" },
  { category: "Lane B", name: "Schedule", value: "08:00 daily", description: "Lane B run time (São Paulo)" },
  
  // Lane C
  { category: "Lane C", name: "Max Packets Per Bundle", value: "10 packets", description: "Max packets in IC Bundle" },
  { category: "Lane C", name: "Min Conviction", value: "6/10", description: "Minimum conviction for IC Bundle" },
  { category: "Lane C", name: "Schedule", value: "10:00 daily", description: "Lane C run time (São Paulo)" },
  
  // Gates
  { category: "Gates", name: "Gate 0 (Data)", value: "Soft Fail", description: "Data sufficiency check" },
  { category: "Gates", name: "Gate 1 (Coherence)", value: "Soft Fail", description: "Thesis coherence check" },
  { category: "Gates", name: "Gate 2 (Edge)", value: "Soft Fail", description: "Edge claim validation" },
  { category: "Gates", name: "Gate 3 (Downside)", value: "Hard Fail", description: "Leverage/liquidity/regulatory check" },
  { category: "Gates", name: "Gate 4 (Style Fit)", value: "Hard Fail", description: "Style-specific threshold enforcement" },
  
  // QA
  { category: "QA", name: "QA Report Schedule", value: "18:00 Friday", description: "Weekly QA report generation (São Paulo)" },
];

const styleTargets = [
  { style: "Quality Compounder", target: "40%", threshold: "0.70" },
  { style: "GARP", target: "40%", threshold: "0.70" },
  { style: "Cigar Butt", target: "20%", threshold: "0.72" },
];

const scheduleOverview = [
  { lane: "Lane 0", time: "05:00", description: "Substack + Reddit Ingestion", frequency: "Daily (Mon-Sun)" },
  { lane: "Lane A", time: "06:00", description: "Daily Discovery", frequency: "Daily (Mon-Sun)" },
  { lane: "Lane B", time: "08:00", description: "Deep Research", frequency: "Daily (Mon-Sun)" },
  { lane: "Lane C", time: "10:00", description: "IC Bundle Generation", frequency: "Daily (Mon-Sun)" },
  { lane: "QA Report", time: "18:00", description: "Weekly QA Report", frequency: "Friday only" },
];

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        <header className="page-header">
          <h1 className="page-header-title">Settings</h1>
          <p className="page-header-subtitle">System configuration and locked parameters</p>
        </header>
        
        <main className="flex-1 p-8">
          <div className="content-area space-y-8">
            
            {/* Schedule Overview - NEW PROMINENT SECTION */}
            <section className="governance-card">
              <div className="flex items-center gap-3 mb-6">
                <Calendar className="w-6 h-6 text-accent" />
                <h2 className="text-section-title">Pipeline Schedule Overview</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                All times in America/Sao_Paulo timezone. Pipeline runs sequentially: Lane 0 → Lane A → Lane B → Lane C.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium">Lane</th>
                      <th className="text-left py-3 px-4 font-medium">Time</th>
                      <th className="text-left py-3 px-4 font-medium">Description</th>
                      <th className="text-left py-3 px-4 font-medium">Frequency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleOverview.map((item) => (
                      <tr key={item.lane} className="border-b border-border/50">
                        <td className="py-3 px-4 font-medium">{item.lane}</td>
                        <td className="py-3 px-4 font-mono text-accent">{item.time}</td>
                        <td className="py-3 px-4">{item.description}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs ${
                            item.frequency === 'Daily (Mon-Sun)' 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {item.frequency}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Locked Parameters */}
            <section className="governance-card">
              <div className="flex items-center gap-3 mb-6">
                <Lock className="w-6 h-6 text-accent" />
                <h2 className="text-section-title">Locked Parameters</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                These parameters are governed by the Operating Parameters specification and cannot be modified without explicit approval and documented rationale.
              </p>
              <div className="space-y-6">
                {["Lane 0", "Lane A", "Lane B", "Lane C", "Gates", "QA"].map((category) => (
                  <div key={category}>
                    <h3 className="text-sm font-medium text-accent mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      {category}
                    </h3>
                    <div className="grid gap-3">
                      {lockedParams
                        .filter((p) => p.category === category)
                        .map((param) => (
                          <div
                            key={param.name}
                            className="flex items-center justify-between p-3 bg-secondary/50 rounded-md"
                          >
                            <div>
                              <div className="font-medium text-sm">{param.name}</div>
                              <div className="text-xs text-muted-foreground">{param.description}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{param.value}</span>
                              <Lock className="w-3 h-3 text-muted-foreground" />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Style Mix Targets */}
            <section className="governance-card">
              <div className="flex items-center gap-3 mb-6">
                <Layers className="w-6 h-6 text-accent" />
                <h2 className="text-section-title">Style Mix Targets</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-medium">Style</th>
                      <th className="text-left py-2 px-3 font-medium">Target Allocation</th>
                      <th className="text-left py-2 px-3 font-medium">Promotion Threshold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {styleTargets.map((s) => (
                      <tr key={s.style} className="border-b border-border/50">
                        <td className="py-2 px-3">{s.style}</td>
                        <td className="py-2 px-3 font-mono">{s.target}</td>
                        <td className="py-2 px-3 font-mono">{s.threshold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Daily Schedule Visual */}
            <section className="governance-card">
              <div className="flex items-center gap-3 mb-6">
                <Clock className="w-6 h-6 text-accent" />
                <h2 className="text-section-title">Daily Pipeline Flow</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Sequential execution ensures each lane has fresh data from the previous lane.
              </p>
              <div className="flex flex-wrap gap-4 items-center justify-center py-4">
                <div className="flex flex-col items-center p-4 bg-secondary/50 rounded-lg min-w-[120px]">
                  <div className="text-xs text-muted-foreground mb-1">05:00</div>
                  <div className="font-bold text-accent">Lane 0</div>
                  <div className="text-xs mt-1">Ingestion</div>
                </div>
                <div className="text-2xl text-muted-foreground">→</div>
                <div className="flex flex-col items-center p-4 bg-secondary/50 rounded-lg min-w-[120px]">
                  <div className="text-xs text-muted-foreground mb-1">06:00</div>
                  <div className="font-bold text-accent">Lane A</div>
                  <div className="text-xs mt-1">Discovery</div>
                </div>
                <div className="text-2xl text-muted-foreground">→</div>
                <div className="flex flex-col items-center p-4 bg-secondary/50 rounded-lg min-w-[120px]">
                  <div className="text-xs text-muted-foreground mb-1">08:00</div>
                  <div className="font-bold text-accent">Lane B</div>
                  <div className="text-xs mt-1">Research</div>
                </div>
                <div className="text-2xl text-muted-foreground">→</div>
                <div className="flex flex-col items-center p-4 bg-secondary/50 rounded-lg min-w-[120px]">
                  <div className="text-xs text-muted-foreground mb-1">10:00</div>
                  <div className="font-bold text-accent">Lane C</div>
                  <div className="text-xs mt-1">IC Bundle</div>
                </div>
              </div>
            </section>

            {/* Governance Notice */}
            <section className="governance-card governance-card-warn">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-warning" />
                <h2 className="text-section-title">Governance Notice</h2>
              </div>
              <p className="text-sm">
                The Weekly QA Report is a <strong>locked governance layer</strong>. No thresholds, alarms, or section logic may be changed without an explicit request and documented rationale. All changes require approval and must be reflected in the Operating Parameters specification.
              </p>
            </section>

          </div>
        </main>
      </div>
    </AppLayout>
  );
}
