"use client";

import Link from "next/link";
import { ArrowRight, Activity, Brain, Shield, Search, FileText, BarChart3 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const features = [
  { icon: Brain, title: "AI-Powered Discovery", description: "Systematic idea generation with novelty scoring and style classification" },
  { icon: Shield, title: "Governance Gates", description: "5-gate quality control ensuring only high-conviction ideas advance" },
  { icon: FileText, title: "Deep Research", description: "7 specialized agents producing IC-grade research packets" },
  { icon: BarChart3, title: "Weekly QA", description: "Automated governance reporting with drift detection" },
  { icon: Search, title: "Memory System", description: "Track rejection shadows and idea reappearances" },
  { icon: Activity, title: "Real-time Status", description: "Monitor pipeline health and job execution" }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 flex justify-between px-8 lg:px-16">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-px h-full bg-border/30" style={{ opacity: i === 0 || i === 5 ? 0.5 : 0.2 }} />
          ))}
        </div>
      </div>

      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-accent/20 flex items-center justify-center">
            <span className="text-accent font-semibold text-sm">A</span>
          </div>
          <span className="text-lg font-medium tracking-tight">ARC Investment Factory</span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/status" className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors">
            Enter Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="relative z-10 px-8 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-6">
            Investment Committee<br /><span className="text-accent">Intelligence Platform</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12">
            Systematic idea generation, rigorous governance, and deep research automation for institutional-grade investment decision making.
          </p>

          <div className="grid grid-cols-3 gap-8 max-w-xl mx-auto mb-20">
            <div className="text-center"><div className="text-3xl font-medium text-accent">120</div><div className="text-sm text-muted-foreground">Ideas/Day</div></div>
            <div className="text-center"><div className="text-3xl font-medium text-accent">5</div><div className="text-sm text-muted-foreground">Quality Gates</div></div>
            <div className="text-center"><div className="text-3xl font-medium text-accent">7</div><div className="text-sm text-muted-foreground">Research Agents</div></div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {features.map((feature, i) => (
              <div key={i} className="p-6 rounded-lg bg-card border border-border/50 hover:border-accent/30 transition-colors">
                <feature.icon className="w-8 h-8 text-accent mb-4" />
                <h3 className="font-medium mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="relative z-10 px-8 py-6 border-t border-border/50">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span>ARC Investment Factory v1.0</span>
          <span>Disciplined process. Superior outcomes.</span>
        </div>
      </footer>
    </div>
  );
}
