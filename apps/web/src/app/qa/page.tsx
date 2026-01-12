"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CheckCircle, AlertCircle, XCircle, Download, ChevronDown, ChevronUp } from "lucide-react";
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

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "pass") return <CheckCircle className="w-4 h-4 text-success" />;
    if (status === "warn") return <AlertCircle className="w-4 h-4 text-warning" />;
    return <XCircle className="w-4 h-4 text-fail" />;
  };

  const latestReport = reports[0];

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        <header className="page-header">
          <h1 className="page-header-title">QA Report</h1>
          <p className="page-header-subtitle">Weekly governance and compliance review</p>
        </header>
        <main className="flex-1 p-8">
          <div className="content-area">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-muted-foreground">Loading reports...</div>
              </div>
            ) : !latestReport ? (
              <div className="text-center py-20 text-muted-foreground">
                <p>No QA reports recorded.</p>
                <p className="text-sm mt-2">Reports are generated every Friday at 18:00.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Current Report Summary */}
                <section className="governance-card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-section-title">Current Report</h2>
                      <p className="text-sm text-muted-foreground">
                        Week of {new Date(latestReport.week_start).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-3xl font-medium",
                        latestReport.overall_score >= 80 ? "text-success" :
                        latestReport.overall_score >= 60 ? "text-warning" : "text-fail"
                      )}>
                        {latestReport.overall_score}/100
                      </div>
                      <div className={cn(
                        "text-sm uppercase",
                        latestReport.status === "pass" ? "text-success" :
                        latestReport.status === "warn" ? "text-warning" : "text-fail"
                      )}>
                        {latestReport.status}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => window.open(`/api/qa/${latestReport.id}/json`, "_blank")}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-secondary transition-colors"
                  >
                    <Download className="w-4 h-4" /> Download JSON
                  </button>
                </section>

                {/* Section Breakdown */}
                <section className="space-y-4">
                  <h2 className="text-section-title">Section Breakdown</h2>
                  {latestReport.sections?.map((section: any) => (
                    <div
                      key={section.id}
                      className={cn(
                        "governance-card",
                        section.status === "fail" && "governance-card-fail",
                        section.status === "warn" && "governance-card-warn"
                      )}
                    >
                      <button
                        onClick={() => setExpanded(expanded === section.id ? null : section.id)}
                        className="w-full flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <StatusIcon status={section.status} />
                          <span className="font-medium">
                            Section {section.id}: {sectionLabels[section.id] || section.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">{section.score}/100</span>
                          {expanded === section.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </button>
                      {expanded === section.id && (
                        <div className="mt-4 pt-4 border-t border-border space-y-3">
                          {section.checks?.map((check: any, i: number) => (
                            <div key={i} className="flex items-start gap-3">
                              <StatusIcon status={check.status} />
                              <div className="flex-1">
                                <div className="text-sm font-medium">{check.id}: {check.name}</div>
                                <div className="text-xs text-muted-foreground">{check.detail}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </section>

                {/* Drift Alarms */}
                {latestReport.drift_alarms?.length > 0 && (
                  <section className="governance-card governance-card-fail">
                    <h2 className="text-section-title mb-4">Drift Alarms</h2>
                    <div className="space-y-3">
                      {latestReport.drift_alarms.map((alarm: any, i: number) => (
                        <div key={i} className="flex items-start gap-3">
                          <XCircle className="w-4 h-4 text-fail mt-0.5" />
                          <div>
                            <div className="font-medium text-sm">{alarm.name}</div>
                            <div className="text-xs text-muted-foreground">{alarm.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Previous Reports */}
                {reports.length > 1 && (
                  <section>
                    <h2 className="text-section-title mb-4">Previous Reports</h2>
                    <div className="governance-card">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="pb-3 font-medium">Week</th>
                            <th className="pb-3 font-medium">Score</th>
                            <th className="pb-3 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reports.slice(1, 8).map((report, idx) => (
                            <tr key={report.id} className={idx < reports.slice(1, 8).length - 1 ? "border-b border-border/50" : ""}>
                              <td className="py-3">{new Date(report.week_start).toLocaleDateString()}</td>
                              <td className={cn(
                                "py-3 font-medium",
                                report.overall_score >= 80 ? "text-success" :
                                report.overall_score >= 60 ? "text-warning" : "text-fail"
                              )}>
                                {report.overall_score}/100
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <StatusIcon status={report.status} />
                                  <span className={cn(
                                    report.status === "pass" ? "text-success" :
                                    report.status === "warn" ? "text-warning" : "text-fail"
                                  )}>
                                    {report.status}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
