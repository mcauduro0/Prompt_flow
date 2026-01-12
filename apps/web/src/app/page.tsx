"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle grid background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 flex justify-between px-8 lg:px-16">
          {[...Array(6)].map((_, i) => (
            <div 
              key={i} 
              className="w-px h-full bg-border/20" 
              style={{ opacity: i === 0 || i === 5 ? 0.4 : 0.15 }} 
            />
          ))}
        </div>
      </div>

      {/* Main content - centered vertically */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-8">
        <div className="max-w-lg w-full text-center animate-fade-in">
          {/* Logo mark */}
          <div className="mb-8">
            <div 
              className={cn(
                "inline-flex items-center justify-center",
                "w-12 h-12 rounded-md",
                "bg-accent/10 border border-accent/20"
              )}
            >
              <span className="text-xl font-medium text-accent tracking-tight">A</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-medium text-foreground tracking-tight mb-4">
            ARC Investment Factory
          </h1>

          {/* Subtitle - neutral, no marketing */}
          <p className="text-muted-foreground mb-10 leading-relaxed">
            Idea discovery, governance gates, and research automation.
          </p>

          {/* Enter button */}
          <Link 
            href="/status"
            className={cn(
              "inline-flex items-center gap-2",
              "px-6 py-3 rounded-md",
              "bg-accent text-accent-foreground",
              "hover:bg-accent/90 transition-calm",
              "text-sm font-medium"
            )}
          >
            Enter
            <ArrowRight className="w-4 h-4" />
          </Link>

          {/* Stats - subtle, not prominent */}
          <div 
            className="mt-16 pt-8 border-t border-border/30 animate-fade-in"
            style={{ animationDelay: '150ms' }}
          >
            <div className="flex items-center justify-center gap-10 text-sm text-muted-foreground/60">
              <div className="text-center">
                <span className="block text-foreground/70 font-medium">120</span>
                <span className="text-annotation">ideas/day</span>
              </div>
              <div className="w-px h-8 bg-border/30" />
              <div className="text-center">
                <span className="block text-foreground/70 font-medium">5</span>
                <span className="text-annotation">gates</span>
              </div>
              <div className="w-px h-8 bg-border/30" />
              <div className="text-center">
                <span className="block text-foreground/70 font-medium">7</span>
                <span className="text-annotation">agents</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer - minimal */}
      <footer className="absolute bottom-0 left-0 right-0 z-10 px-8 py-6">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-annotation text-muted-foreground/40">
            Disciplined process.
          </p>
        </div>
      </footer>
    </div>
  );
}
