import { cn } from "@/lib/utils";

interface QAMetric {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  value: string;
  detail: string;
  trend?: "improving" | "declining" | "stable";
  trendDetail?: string;
}

const qaMetrics: QAMetric[] = [
  {
    id: "1",
    label: "System Integrity",
    status: "pass",
    value: "All components operational",
    detail: "No anomalies detected in the last 30 days",
    trend: "stable",
  },
  {
    id: "2",
    label: "Novelty Rate",
    status: "pass",
    value: "12% of ideas are new",
    detail: "Within expected range of 8–18%",
    trend: "improving",
    trendDetail: "Up from 9% last month",
  },
  {
    id: "3",
    label: "Style Distribution",
    status: "warn",
    value: "Quality bias detected",
    detail: "65% Quality vs. target 50%. Review sourcing criteria.",
    trend: "declining",
    trendDetail: "Bias increasing over 3 months",
  },
  {
    id: "4",
    label: "Gate Consistency",
    status: "pass",
    value: "100% consistent",
    detail: "No gate drift detected. All thresholds holding.",
    trend: "stable",
  },
  {
    id: "5",
    label: "Evidence Quality",
    status: "pass",
    value: "94% verified sources",
    detail: "High confidence in underlying data quality",
    trend: "stable",
  },
  {
    id: "6",
    label: "Thesis Stability",
    status: "warn",
    value: "3 revisions this week",
    detail: "Above normal. Review underlying assumptions.",
    trend: "declining",
    trendDetail: "Increased revision frequency",
  },
];

export default function QAReport() {
  const passCount = qaMetrics.filter(m => m.status === "pass").length;
  const warnCount = qaMetrics.filter(m => m.status === "warn").length;
  const failCount = qaMetrics.filter(m => m.status === "fail").length;

  const overallStatus = failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header - Governance authority */}
      <header className="page-header">
        <h1 className="page-header-title">Quality Assurance Report</h1>
        <p className="page-header-subtitle">
          System governance and process integrity
        </p>
      </header>

      {/* Main content */}
      <main 
        className="flex-1"
        style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-10)' }}
      >
        <div className="content-area">
          
          {/* Overall Status - Typography and weight driven */}
          <section className="animate-fade-in">
            <div className={cn(
              "governance-card",
              overallStatus === "fail" && "governance-card-fail",
              overallStatus === "warn" && "governance-card-warn"
            )}>
              {/* Header row */}
              <div 
                className="flex items-baseline justify-between"
                style={{ marginBottom: 'var(--space-4)' }}
              >
                <h2 className={cn(
                  "text-section-title",
                  overallStatus === "fail" && "text-fail"
                )}>
                  {overallStatus === "pass" && "System Health: Normal"}
                  {overallStatus === "warn" && "System Health: Review Recommended"}
                  {overallStatus === "fail" && "System Health: Action Required"}
                </h2>
                <span className="text-annotation text-muted-foreground/60">
                  Updated 1 hour ago
                </span>
              </div>
              
              {/* Status description */}
              <p 
                className="text-body text-muted-foreground reading-width-narrow"
                style={{ marginBottom: 'var(--space-5)', lineHeight: 1.7 }}
              >
                {overallStatus === "pass" && "All governance checks are passing. The system is operating within expected parameters."}
                {overallStatus === "warn" && "Some metrics require attention before proceeding with new investment decisions."}
                {overallStatus === "fail" && "Critical issues detected. Resolve before making investment decisions."}
              </p>
              
              {/* Summary counts - Formal spacing */}
              <div 
                className="flex items-center text-supporting"
                style={{ gap: 'var(--space-6)' }}
              >
                <span className="text-muted-foreground">
                  <span className="text-foreground" style={{ fontWeight: 450 }}>{passCount}</span> passing
                </span>
                {warnCount > 0 && (
                  <span className="text-warning/80">
                    <span style={{ fontWeight: 450 }}>{warnCount}</span> {warnCount === 1 ? 'warning' : 'warnings'}
                  </span>
                )}
                {failCount > 0 && (
                  <span className="text-fail" style={{ fontWeight: 450 }}>
                    {failCount} {failCount === 1 ? 'failure' : 'failures'}
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Section label - Formal, quiet */}
          <div 
            className="flex items-center"
            style={{ 
              gap: 'var(--space-4)', 
              marginTop: 'var(--space-10)',
              marginBottom: 'var(--space-6)'
            }}
          >
            <span className="text-label text-muted-foreground/50">
              Detailed Metrics
            </span>
            <div className="flex-1 border-t border-border/30" />
          </div>

          {/* Metrics - Vertical, formal reading */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {qaMetrics.map((metric, index) => (
              <MetricCard 
                key={metric.id} 
                metric={metric} 
                index={index}
              />
            ))}
          </section>

          {/* Governance footer */}
          <footer 
            className="border-t border-border/30 animate-fade-in delay-450"
            style={{ marginTop: 'var(--space-10)', paddingTop: 'var(--space-8)' }}
          >
            <p className="text-annotation text-muted-foreground/50 text-center reading-width mx-auto" style={{ lineHeight: 1.6 }}>
              This report supports disciplined investment process.
              All metrics should be reviewed before major allocation decisions.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

interface MetricCardProps {
  metric: QAMetric;
  index: number;
}

function MetricCard({ metric, index }: MetricCardProps) {
  return (
    <div 
      className={cn(
        "governance-card animate-fade-in",
        metric.status === "fail" && "governance-card-fail",
        metric.status === "warn" && "governance-card-warn"
      )}
      style={{ animationDelay: `${(index + 1) * 100}ms` }}
    >
      {/* Header: Label and trend */}
      <div 
        className="flex items-start justify-between"
        style={{ marginBottom: 'var(--space-3)' }}
      >
        <span className={cn(
          "text-label",
          metric.status === "pass" && "text-muted-foreground/70",
          metric.status === "warn" && "text-warning/70",
          metric.status === "fail" && "text-fail/80"
        )}>
          {metric.label}
        </span>
        
        {metric.trend && (
          <span className={cn(
            "text-annotation",
            metric.trend === "improving" && "text-success/60",
            metric.trend === "declining" && "text-muted-foreground/60",
            metric.trend === "stable" && "text-muted-foreground/40"
          )}>
            {metric.trend === "improving" && "↑ Improving"}
            {metric.trend === "declining" && "↓ Declining"}
            {metric.trend === "stable" && "— Stable"}
          </span>
        )}
      </div>
      
      {/* Value - Primary reading */}
      <p 
        className={cn(
          "text-subsection",
          metric.status === "fail" && "text-fail"
        )}
        style={{ marginBottom: 'var(--space-2)' }}
      >
        {metric.value}
      </p>
      
      {/* Detail - Supporting context */}
      <p className="text-supporting text-muted-foreground" style={{ lineHeight: 1.65 }}>
        {metric.detail}
      </p>
      
      {/* Trend detail - Whisper quiet */}
      {metric.trendDetail && (
        <p 
          className="text-annotation text-muted-foreground/50"
          style={{ marginTop: 'var(--space-2)' }}
        >
          {metric.trendDetail}
        </p>
      )}
    </div>
  );
}
