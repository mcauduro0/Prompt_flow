"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const sectionLabels: Record<string, string> = {
  A: "System Health",
  B: "Novelty-First",
  C: "Gates & Promotion",
  D: "Packet Completeness",
  E: "Memory & Versioning",
  F: "Universe Coverage",
  G: "Operator Usability"
};

export default function QAPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await fetch("/api/qa");
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const latestReport = reports[0];

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border">
          <div className="px-8 py-6">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-medium text-foreground tracking-tight">
                QA Report
              </h1>
              {latestReport && (
                <span className={cn(
                  "text-sm font-medium",
                  latestReport.status === "pass" && "text-success",
                  latestReport.status === "warn" && "text-warning",
                  latestReport.status === "fail" && "text-fail"
                )}>
                  {latestReport.status === "pass" ? "Pass" : 
                   latestReport.status === "warn" ? "Warn" : "Fail"}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Weekly governance and compliance review
            </p>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 py-10">
          <div className="max-w-2xl mx-auto px-8">
            {loading ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground animate-pulse-calm">Loading reports...</p>
              </div>
            ) : !latestReport ? (
              <div className="text-center py-16 animate-fade-in">
                <p className="text-muted-foreground">No QA reports recorded.</p>
                <p className="text-sm text-muted-foreground/60 mt-2">
                  Reports are generated every Friday at 18:00.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Overall Status Card */}
                <div 
                  className={cn(
                    "p-6 rounded-md bg-card border animate-fade-in",
                    latestReport.status === "pass" && "border-success/30",
                    latestReport.status === "warn" && "border-warning/30",
                    latestReport.status === "fail" && "border-fail/30"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Week of {new Date(latestReport.week_start).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </p>
                      <div className="flex items-baseline gap-3">
                        <span className={cn(
                          "text-4xl font-medium tracking-tight",
                          latestReport.overall_score >= 80 ? "text-foreground" :
                          latestReport.overall_score >= 60 ? "text-warning" : "text-fail"
                        )}>
                          {latestReport.overall_score}
                        </span>
                        <span className="text-muted-foreground/50">/100</span>
                      </div>
                    </div>
                    <button
                      onClick={() => window.open(`/api/qa/${latestReport.id}/json`, "_blank")}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md",
                        "text-muted-foreground hover:text-foreground",
                        "hover:bg-secondary/50 transition-calm"
                      )}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export
                    </button>
                  </div>
                </div>

                {/* Section Breakdown */}
                <div className="space-y-3">
                  <h2 className="text-sm font-medium text-muted-foreground mb-4">
                    Section Breakdown
                  </h2>
                  
                  {latestReport.sections?.map((section: any, index: number) => (
                    <SectionCard
                      key={section.id}
                      section={section}
                      index={index}
                      expanded={expanded === section.id}
                      onToggle={() => setExpanded(expanded === section.id ? null : section.id)}
                    />
                  ))}
                </div>

                {/* Drift Alarms */}
                {latestReport.drift_alarms?.length > 0 && (
                  <div 
                    className="p-6 rounded-md bg-card border-l-2 border-fail animate-fade-in"
                    style={{ animationDelay: '300ms' }}
                  >
                    <h2 className="text-sm font-medium text-foreground mb-4">Drift Alarms</h2>
                    <div className="space-y-4">
                      {latestReport.drift_alarms.map((alarm: any, i: number) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-fail mt-2 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-foreground">{alarm.name}</p>
                            <p className="text-annotation text-muted-foreground mt-0.5">{alarm.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Previous Reports */}
                {reports.length > 1 && (
                  <div className="animate-fade-in" style={{ animationDelay: '375ms' }}>
                    <h2 className="text-sm font-medium text-muted-foreground mb-4">
                      Previous Reports
                    </h2>
                    <div className="p-6 rounded-md bg-card border border-border/60">
                      <div className="space-y-3">
                        {reports.slice(1, 6).map((report, idx) => (
                          <div 
                            key={report.id}
                            className={cn(
                              "flex items-center justify-between py-2",
                              idx < Math.min(reports.length - 2, 4) && "border-b border-border/30"
                            )}
                          >
                            <span className="text-sm text-muted-foreground">
                              {new Date(report.week_start).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric"
                              })}
                            </span>
                            <div className="flex items-center gap-4">
                              <span className={cn(
                                "text-sm font-medium",
                                report.overall_score >= 80 ? "text-foreground" :
                                report.overall_score >= 60 ? "text-warning" : "text-fail"
                              )}>
                                {report.overall_score}
                              </span>
                              <span className={cn(
                                "text-sm",
                                report.status === "pass" && "text-success",
                                report.status === "warn" && "text-warning",
                                report.status === "fail" && "text-fail"
                              )}>
                                {report.status === "pass" ? "Pass" : 
                                 report.status === "warn" ? "Warn" : "Fail"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}

interface SectionCardProps {
  section: any;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}

function SectionCard({ section, index, expanded, onToggle }: SectionCardProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-card border border-border/60 overflow-hidden animate-fade-in transition-calm",
        section.status === "fail" && "border-l-2 border-l-fail",
        section.status === "warn" && "border-l-2 border-l-warning/50"
      )}
      style={{ animationDelay: `${(index + 1) * 75}ms` }}
    >
      <button
        onClick={onToggle}
        className="w-full p-5 flex items-center justify-between hover:bg-secondary/20 transition-calm"
      >
        <div className="flex items-center gap-3">
          <span className={cn(
            "w-2 h-2 rounded-full",
            section.status === "pass" && "bg-success",
            section.status === "warn" && "bg-warning",
            section.status === "fail" && "bg-fail"
          )} />
          <span className="text-sm font-medium text-foreground">
            {sectionLabels[section.id] || section.title}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {section.score}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && section.checks && (
        <div className="px-5 pb-5 pt-2 border-t border-border/30 animate-fade-in">
          <div className="space-y-3">
            {section.checks.map((check: any, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0",
                  check.status === "pass" && "bg-success",
                  check.status === "warn" && "bg-warning",
                  check.status === "fail" && "bg-fail"
                )} />
                <div>
                  <p className="text-sm text-foreground/90">
                    {check.id}: {check.name}
                  </p>
                  <p className="text-annotation text-muted-foreground/70 mt-0.5">
                    {check.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
