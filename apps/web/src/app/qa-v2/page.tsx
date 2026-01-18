'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from "@/components/layout/AppLayout";
import { RefreshCw, Download, AlertTriangle, CheckCircle, Info, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { cn } from "@/lib/utils";

// API calls use relative URLs via Next.js rewrites

interface TrendData {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  subcategory?: string;
  message: string;
  recommendation: string;
  metric?: string;
  currentValue?: number;
  threshold?: number;
  trend?: string;
}

interface QAReport {
  reportId: string;
  version: string;
  generatedAt: string;
  weekOf: string;
  overallScore: number;
  status: 'healthy' | 'warn' | 'fail';
  sectionScores: {
    lane0: number;
    laneA: number;
    laneB: number;
    laneC: number;
    infrastructure: number;
    funnel: number;
  };
  lane0Metrics: any;
  laneAMetrics: any;
  laneBMetrics: any;
  laneCMetrics: any;
  infrastructureMetrics: any;
  funnelMetrics: any;
  alerts: Alert[];
  alertSummary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  trends: {
    lane0Trend: TrendData;
    laneATrend: TrendData;
    laneBTrend: TrendData;
    laneCTrend: TrendData;
    overallTrend: TrendData;
    weekOverWeek: any[];
  };
  executionTimeMs: number;
  dataQuality: {
    completeness: number;
    freshness: number;
  };
}

export default function QADashboardV2Page() {
  const [report, setReport] = useState<QAReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    alerts: true,
    lane0: false,
    laneA: false,
    laneB: false,
    laneC: false,
    infrastructure: false,
    funnel: false,
  });

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/qa-v2/latest`);
      const data = await res.json();
      if (data.success && data.report) {
        setReport(data.report);
      } else {
        setError('No QA report found. Click "Generate Report" to create one.');
      }
    } catch (err) {
      setError('Failed to fetch QA report');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      setGenerating(true);
      setError(null);
      const res = await fetch(`/api/qa-v2/generate`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.report) {
        setReport(data.report);
      } else {
        setError('Failed to generate report: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      setError('Failed to generate QA report');
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = () => {
    if (report) {
      window.open(`/api/qa-v2/${report.reportId}/pdf`, '_blank');
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-success';
      case 'warn': return 'bg-warning';
      case 'fail': return 'bg-fail';
      default: return 'bg-muted';
    }
  };

  const getStatusBorder = (status: string) => {
    switch (status) {
      case 'healthy': return 'border-success/30';
      case 'warn': return 'border-warning/30';
      case 'fail': return 'border-fail/30';
      default: return 'border-border';
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-fail/10 border-l-2 border-fail text-fail';
      case 'warning': return 'bg-warning/10 border-l-2 border-warning text-warning';
      case 'info': return 'bg-primary/10 border-l-2 border-primary text-primary';
      default: return 'bg-muted/10 border-l-2 border-muted text-muted-foreground';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'info': return <Info className="w-4 h-4" />;
      default: return null;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-success" />;
      case 'declining': return <TrendingDown className="w-4 h-4 text-fail" />;
      default: return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-success';
    if (score >= 40) return 'text-warning';
    return 'text-fail';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-success';
    if (score >= 40) return 'bg-warning';
    return 'bg-fail';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground animate-pulse-calm">Loading QA Dashboard...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-baseline gap-3">
                  <h1 className="text-2xl font-medium text-foreground tracking-tight">
                    QA Dashboard v2.0
                  </h1>
                  {report && (
                    <span className={cn(
                      "text-sm font-medium px-2 py-0.5 rounded",
                      report.status === "healthy" && "text-success bg-success/10",
                      report.status === "warn" && "text-warning bg-warning/10",
                      report.status === "fail" && "text-fail bg-fail/10"
                    )}>
                      {report.status.toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {report ? `Week of ${report.weekOf}` : 'Comprehensive pipeline health monitoring'}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={fetchReport}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md",
                    "text-muted-foreground hover:text-foreground",
                    "hover:bg-secondary/50 transition-calm border border-border"
                  )}
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
                <button
                  onClick={generateReport}
                  disabled={generating}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    "transition-calm disabled:opacity-50"
                  )}
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Generate Report
                    </>
                  )}
                </button>
                {report && (
                  <button
                    onClick={downloadPdf}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-md",
                      "bg-success/20 text-success hover:bg-success/30",
                      "transition-calm border border-success/30"
                    )}
                  >
                    <Download className="w-4 h-4" />
                    PDF
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 py-8">
          <div className="max-w-6xl mx-auto px-8">
            {error && !report && (
              <div className="bg-warning/10 border border-warning/30 rounded-md p-4 mb-8 animate-fade-in">
                <p className="text-warning">{error}</p>
              </div>
            )}

            {report && (
              <div className="space-y-6 animate-fade-in">
                {/* Overall Score Card */}
                <div className={cn("p-6 rounded-md bg-card border", getStatusBorder(report.status))}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className={cn("w-20 h-20 rounded-full flex items-center justify-center", getStatusColor(report.status))}>
                        <span className="text-3xl font-bold text-white">{report.overallScore}</span>
                      </div>
                      <div>
                        <h2 className="text-xl font-medium text-foreground">Overall Health Score</h2>
                        <div className="flex items-center gap-2 mt-1">
                          {getTrendIcon(report.trends.overallTrend.trend)}
                          <span className={report.trends.overallTrend.changePercent >= 0 ? 'text-success' : 'text-fail'}>
                            {report.trends.overallTrend.changePercent >= 0 ? '+' : ''}{report.trends.overallTrend.changePercent.toFixed(1)}%
                          </span>
                          <span className="text-muted-foreground text-sm">vs last week</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-fail">{report.alertSummary.critical}</div>
                        <div className="text-sm text-muted-foreground">Critical</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-warning">{report.alertSummary.warning}</div>
                        <div className="text-sm text-muted-foreground">Warning</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{report.alertSummary.info}</div>
                        <div className="text-sm text-muted-foreground">Info</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section Scores Grid */}
                <div className="grid grid-cols-6 gap-4">
                  {[
                    { key: 'lane0', label: 'Lane 0', subtitle: 'Ingestion', trend: report.trends.lane0Trend },
                    { key: 'laneA', label: 'Lane A', subtitle: 'Discovery', trend: report.trends.laneATrend },
                    { key: 'laneB', label: 'Lane B', subtitle: 'Research', trend: report.trends.laneBTrend },
                    { key: 'laneC', label: 'Lane C', subtitle: 'IC Memo', trend: report.trends.laneCTrend },
                    { key: 'infrastructure', label: 'Infra', subtitle: 'Health', trend: null },
                    { key: 'funnel', label: 'Funnel', subtitle: 'Conversion', trend: null },
                  ].map(({ key, label, subtitle, trend }) => (
                    <div key={key} className="bg-card rounded-md p-4 border border-border">
                      <div className="text-sm text-muted-foreground">{label}</div>
                      <div className="text-xs text-muted-foreground/60">{subtitle}</div>
                      <div className={cn("text-2xl font-bold mt-1", getScoreColor(report.sectionScores[key as keyof typeof report.sectionScores]))}>
                        {report.sectionScores[key as keyof typeof report.sectionScores]}
                      </div>
                      {trend && (
                        <div className="flex items-center gap-1 mt-1">
                          {getTrendIcon(trend.trend)}
                          <span className={cn("text-xs", trend.changePercent >= 0 ? 'text-success' : 'text-fail')}>
                            {trend.changePercent >= 0 ? '+' : ''}{trend.changePercent.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Alerts Section */}
                <div className="bg-card rounded-md border border-border">
                  <button
                    onClick={() => toggleSection('alerts')}
                    className="w-full flex items-center justify-between p-4 hover:bg-secondary/20 transition-calm"
                  >
                    <div className="flex items-center gap-2">
                      {expandedSections.alerts ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                      <h3 className="text-lg font-medium">Alerts ({report.alertSummary.total})</h3>
                    </div>
                  </button>
                  {expandedSections.alerts && (
                    <div className="p-4 pt-0 space-y-3">
                      {report.alerts.length === 0 ? (
                        <div className="flex items-center gap-2 text-success p-4 bg-success/10 rounded-md">
                          <CheckCircle className="w-5 h-5" />
                          <span>No alerts - all systems healthy!</span>
                        </div>
                      ) : (
                        report.alerts.map(alert => (
                          <div key={alert.id} className={cn("rounded-md p-4", getSeverityStyle(alert.severity))}>
                            <div className="flex items-center gap-2 mb-1">
                              {getSeverityIcon(alert.severity)}
                              <span className="font-medium uppercase text-sm">{alert.severity}</span>
                              <span className="text-muted-foreground">|</span>
                              <span className="text-muted-foreground text-sm">{alert.category}</span>
                            </div>
                            <p className="font-medium text-foreground">{alert.message}</p>
                            <p className="text-sm text-muted-foreground mt-1">{alert.recommendation}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Lane A Section */}
                <SectionCard
                  title="Lane A - Discovery"
                  score={report.sectionScores.laneA}
                  expanded={expandedSections.laneA}
                  onToggle={() => toggleSection('laneA')}
                  getScoreColor={getScoreColor}
                >
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <MetricCard label="Runs Completed" value={report.laneAMetrics?.runsCompleted || 0} />
                    <MetricCard label="Ideas Generated" value={report.laneAMetrics?.ideasGenerated || 0} />
                    <MetricCard label="Ideas Promoted" value={report.laneAMetrics?.ideasPromoted || 0} />
                    <MetricCard label="Promotion Rate" value={`${(report.laneAMetrics?.promotionRate || 0).toFixed(1)}%`} />
                  </div>
                  {report.laneAMetrics?.gateStats?.byGate && (
                    <div className="bg-secondary/30 rounded-md p-4">
                      <h4 className="font-medium mb-3 text-foreground">Gate Pass Rates</h4>
                      <div className="space-y-2">
                        {Object.entries(report.laneAMetrics.gateStats.byGate).map(([gateId, gate]: [string, any]) => (
                          <ProgressRow key={gateId} label={gate.gateName} value={gate.passRate} />
                        ))}
                      </div>
                    </div>
                  )}
                </SectionCard>

                {/* Lane B Section */}
                <SectionCard
                  title="Lane B - Research"
                  score={report.sectionScores.laneB}
                  expanded={expandedSections.laneB}
                  onToggle={() => toggleSection('laneB')}
                  getScoreColor={getScoreColor}
                >
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <MetricCard label="Runs Completed" value={report.laneBMetrics?.runsCompleted || 0} />
                    <MetricCard label="Packets Completed" value={report.laneBMetrics?.packetsCompleted || 0} />
                    <MetricCard label="Avg Time" value={`${((report.laneBMetrics?.avgCompletionTime || 0) / 60).toFixed(1)}m`} />
                    <MetricCard label="Agent Success" value={`${(report.laneBMetrics?.agentStats?.overallSuccessRate || 0).toFixed(1)}%`} />
                  </div>
                  {report.laneBMetrics?.agentStats?.byAgent && (
                    <div className="bg-secondary/30 rounded-md p-4">
                      <h4 className="font-medium mb-3 text-foreground">Agent Performance</h4>
                      <div className="space-y-2">
                        {Object.entries(report.laneBMetrics.agentStats.byAgent).map(([agentId, agent]: [string, any]) => (
                          <ProgressRow key={agentId} label={agent.agentName} value={agent.successRate} suffix={`${agent.avgLatencyMs?.toFixed(0) || 0}ms`} />
                        ))}
                      </div>
                    </div>
                  )}
                </SectionCard>

                {/* Lane C Section */}
                <SectionCard
                  title="Lane C - IC Memo"
                  score={report.sectionScores.laneC}
                  expanded={expandedSections.laneC}
                  onToggle={() => toggleSection('laneC')}
                  getScoreColor={getScoreColor}
                >
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <MetricCard label="Memos Generated" value={report.laneCMetrics?.memosGenerated || 0} />
                    <MetricCard label="Memos Completed" value={report.laneCMetrics?.memosCompleted || 0} />
                    <MetricCard label="Avg Conviction" value={(report.laneCMetrics?.avgConviction || 0).toFixed(1)} />
                    <MetricCard label="Conviction Std Dev" value={(report.laneCMetrics?.convictionStdDev || 0).toFixed(1)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary/30 rounded-md p-4">
                      <h4 className="font-medium mb-3 text-foreground">Recommendation Distribution</h4>
                      <div className="space-y-2">
                        {Object.entries(report.laneCMetrics?.recommendationDistribution || {}).map(([rec, count]: [string, any]) => (
                          <div key={rec} className="flex items-center justify-between">
                            <span className="text-muted-foreground capitalize">{rec.replace('_', ' ')}</span>
                            <span className="font-bold text-foreground">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {report.laneCMetrics?.supportingPromptStats?.byPrompt && (
                      <div className="bg-secondary/30 rounded-md p-4">
                        <h4 className="font-medium mb-3 text-foreground">Supporting Prompts</h4>
                        <div className="space-y-2">
                          {Object.entries(report.laneCMetrics.supportingPromptStats.byPrompt).slice(0, 5).map(([promptId, prompt]: [string, any]) => (
                            <div key={promptId} className="flex items-center justify-between">
                              <span className="text-muted-foreground text-sm truncate max-w-[150px]">{prompt.promptName}</span>
                              <span className={cn("font-medium", prompt.successRate >= 70 ? 'text-success' : prompt.successRate >= 50 ? 'text-warning' : 'text-fail')}>
                                {prompt.successRate?.toFixed(0) || 0}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* Infrastructure Section */}
                <SectionCard
                  title="Infrastructure Health"
                  score={report.sectionScores.infrastructure}
                  expanded={expandedSections.infrastructure}
                  onToggle={() => toggleSection('infrastructure')}
                  getScoreColor={getScoreColor}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-secondary/30 rounded-md p-4">
                      <h4 className="font-medium mb-3 text-foreground">Data Sources</h4>
                      <div className="space-y-2">
                        {Object.entries(report.infrastructureMetrics?.dataSourceHealth?.bySource || {}).map(([source, health]: [string, any]) => (
                          <ProgressRow key={source} label={source} value={health.availability} />
                        ))}
                      </div>
                    </div>
                    <div className="bg-secondary/30 rounded-md p-4">
                      <h4 className="font-medium mb-3 text-foreground">LLM Performance</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Success Rate</span>
                          <span className={cn("font-medium", (report.infrastructureMetrics?.llmPerformance?.overallSuccessRate || 0) >= 90 ? 'text-success' : 'text-warning')}>
                            {(report.infrastructureMetrics?.llmPerformance?.overallSuccessRate || 0).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Total Calls</span>
                          <span className="text-foreground">{report.infrastructureMetrics?.llmPerformance?.totalCalls || 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Total Tokens</span>
                          <span className="text-foreground">{((report.infrastructureMetrics?.llmPerformance?.totalTokensUsed || 0) / 1000).toFixed(1)}K</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                {/* Funnel Section */}
                <SectionCard
                  title="Funnel Conversion"
                  score={report.sectionScores.funnel}
                  expanded={expandedSections.funnel}
                  onToggle={() => toggleSection('funnel')}
                  getScoreColor={getScoreColor}
                >
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <MetricCard label="Lane 0 → A" value={`${(report.funnelMetrics?.lane0ToLaneA || 0).toFixed(1)}%`} />
                    <MetricCard label="Lane A → B" value={`${(report.funnelMetrics?.laneAToLaneB || 0).toFixed(1)}%`} />
                    <MetricCard label="Lane B → C" value={`${(report.funnelMetrics?.laneBToLaneC || 0).toFixed(1)}%`} />
                    <MetricCard label="Overall" value={`${(report.funnelMetrics?.overallConversion || 0).toFixed(2)}%`} />
                  </div>
                  {report.funnelMetrics?.bottlenecks?.length > 0 && (
                    <div className="bg-warning/10 border border-warning/30 rounded-md p-4">
                      <h4 className="font-medium text-warning mb-2">Bottlenecks Identified</h4>
                      {report.funnelMetrics.bottlenecks.map((bottleneck: any, idx: number) => (
                        <div key={idx} className="text-sm mb-2">
                          <span className="text-foreground">{bottleneck.stage}:</span>{' '}
                          <span className="text-warning">{bottleneck.dropoffRate?.toFixed(1) || 0}% drop-off</span>
                          <p className="text-muted-foreground">{bottleneck.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                {/* Footer */}
                <div className="text-center text-muted-foreground text-sm pt-4 border-t border-border">
                  <p>Generated: {new Date(report.generatedAt).toLocaleString()}</p>
                  <p>Report ID: {report.reportId} | Execution Time: {report.executionTimeMs}ms</p>
                  <p>Data Quality: {report.dataQuality.completeness}% complete, {report.dataQuality.freshness}% fresh</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}

// Helper Components
function SectionCard({ title, score, expanded, onToggle, getScoreColor, children }: {
  title: string;
  score: number;
  expanded: boolean;
  onToggle: () => void;
  getScoreColor: (score: number) => string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-md border border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/20 transition-calm"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
          <h3 className="text-lg font-medium text-foreground">{title}</h3>
        </div>
        <span className={cn("text-2xl font-bold", getScoreColor(score))}>{score}</span>
      </button>
      {expanded && <div className="p-4 pt-0">{children}</div>}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-secondary/30 rounded-md p-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function ProgressRow({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  const getBarColor = (v: number) => {
    if (v >= 70) return 'bg-success';
    if (v >= 40) return 'bg-warning';
    return 'bg-fail';
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
        <div className="w-24 bg-secondary rounded-full h-2">
          <div className={cn("h-2 rounded-full", getBarColor(value))} style={{ width: `${Math.min(value, 100)}%` }} />
        </div>
        <span className="w-10 text-right text-sm text-foreground">{value.toFixed(0)}%</span>
      </div>
    </div>
  );
}
