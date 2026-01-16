"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  ArrowLeft, 
  ClipboardCheck, 
  RefreshCw, 
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Lightbulb,
  Scale,
  Users,
  Calendar,
  DollarSign,
  BarChart3,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  Eye,
  Building2,
  Briefcase,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ICMemoDetail {
  id: string;
  packet_id: string;
  idea_id: string;
  ticker: string;
  company_name: string;
  style_tag: string;
  as_of: string;
  status: 'pending' | 'generating' | 'complete' | 'failed';
  generation_progress: number;
  recommendation: string | null;
  conviction: number | null;
  memo_content: any;
  supporting_analyses: any;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error_message: string | null;
  research_synthesis: any;
  original_thesis: string | null;
}

const statusConfig = {
  pending: { icon: Clock, label: "Pending", color: "text-yellow-500" },
  generating: { icon: Loader2, label: "Generating", color: "text-blue-500" },
  complete: { icon: CheckCircle, label: "Complete", color: "text-green-500" },
  failed: { icon: XCircle, label: "Failed", color: "text-red-500" },
};

const recommendationColors: Record<string, string> = {
  strong_buy: "text-green-600 bg-green-500/10 border-green-500/20",
  buy: "text-green-600 bg-green-500/10 border-green-500/20",
  invest: "text-green-500 bg-green-500/10 border-green-500/20",
  increase: "text-green-400 bg-green-400/10 border-green-400/20",
  hold: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
  reduce: "text-orange-500 bg-orange-500/10 border-orange-500/20",
  wait: "text-gray-500 bg-gray-500/10 border-gray-500/20",
  sell: "text-red-400 bg-red-400/10 border-red-400/20",
  strong_sell: "text-red-600 bg-red-500/10 border-red-500/20",
  reject: "text-red-500 bg-red-500/10 border-red-500/20",
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Section component for consistent styling
function Section({ 
  title, 
  icon: Icon, 
  children,
  className,
  defaultOpen = true
}: { 
  title: string; 
  icon: React.ComponentType<{ className?: string }>; 
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className={cn("border border-border rounded-lg overflow-hidden", className)}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-muted/30 px-4 py-3 border-b border-border flex items-center justify-between hover:bg-muted/50 transition-calm"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-accent" />
          <h3 className="font-medium text-foreground">{title}</h3>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
}

// Risk item component
function RiskItem({ risk }: { risk: any }) {
  return (
    <div className="border-l-2 border-red-500/50 pl-4 py-2">
      <p className="font-medium text-foreground mb-1">{risk.risk}</p>
      {risk.manifestation && (
        <p className="text-sm text-muted-foreground mb-1">
          <span className="text-foreground/70">Manifestation:</span> {risk.manifestation}
        </p>
      )}
      {risk.impact && (
        <p className="text-sm text-muted-foreground mb-1">
          <span className="text-foreground/70">Impact:</span> {risk.impact}
        </p>
      )}
      {risk.early_signals && risk.early_signals.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Early Signals</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground">
            {risk.early_signals.map((signal: string, i: number) => (
              <li key={i}>{signal}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Catalyst item component
function CatalystItem({ catalyst }: { catalyst: any }) {
  const isControllable = catalyst.controllable === true || catalyst.controllable === "true";
  const isPartial = typeof catalyst.controllable === "string" && catalyst.controllable.toLowerCase().includes("partial");
  
  return (
    <div className="flex items-start gap-3 py-2">
      <div className={cn(
        "w-2 h-2 rounded-full mt-2",
        isControllable ? "bg-green-500" : isPartial ? "bg-yellow-500" : "bg-orange-500"
      )} />
      <div>
        <p className="font-medium text-foreground">{catalyst.event}</p>
        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {catalyst.timeline}
          </span>
          <span className={cn(
            "px-2 py-0.5 rounded text-xs",
            isControllable 
              ? "bg-green-500/10 text-green-600" 
              : isPartial
              ? "bg-yellow-500/10 text-yellow-600"
              : "bg-orange-500/10 text-orange-600"
          )}>
            {isControllable ? "Controllable" : isPartial ? "Partially Controllable" : "External"}
          </span>
        </div>
      </div>
    </div>
  );
}

// Supporting Analysis Card
function SupportingAnalysisCard({ name, data }: { name: string; data: any }) {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!data || !data.success) return null;
  
  const displayName = name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-calm"
      >
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="font-medium text-foreground">{displayName}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 border-t border-border bg-muted/10">
          <pre className="text-sm text-foreground whitespace-pre-wrap overflow-x-auto">
            {typeof data.result === 'string' 
              ? data.result 
              : JSON.stringify(data.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// Raw Content Viewer for failed parsing
function RawContentViewer({ content }: { content: string }) {
  const [isOpen, setIsOpen] = useState(true);
  
  // Try to parse and format the raw content
  let formattedContent = content;
  try {
    // Try to fix common JSON issues and parse
    let fixed = content
      .replace(/:\s*(partially)\s*([,}\]])/gi, ': "partially"$2')
      .replace(/,(\s*[}\]])/g, '$1');
    const parsed = JSON.parse(fixed);
    formattedContent = JSON.stringify(parsed, null, 2);
  } catch {
    // Keep original if parsing fails
  }
  
  return (
    <Section title="Raw IC Memo Content" icon={Eye} defaultOpen={isOpen}>
      <div className="bg-muted/20 rounded-lg p-4 max-h-[600px] overflow-y-auto">
        <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
          {formattedContent}
        </pre>
      </div>
    </Section>
  );
}

export default function ICMemoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [memo, setMemo] = useState<ICMemoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const fetchMemo = async () => {
    try {
      const res = await fetch(`/api/ic-memos/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setMemo(data);
      } else if (res.status === 404) {
        router.push("/ic-memo");
      }
    } catch (error) {
      console.error("Error fetching IC memo:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMemo();
    // Auto-refresh if generating
    const interval = setInterval(() => {
      if (memo?.status === "generating") {
        fetchMemo();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [params.id, memo?.status]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMemo();
  };

  const handleDownloadPdf = async () => {
    if (!memo) return;
    
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/ic-memos/${memo.id}/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `IC_Memo_${memo.ticker}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Failed to download PDF');
        alert('Failed to generate PDF. Please try again.');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Error downloading PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!memo) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">IC Memo not found</p>
          <Link href="/ic-memo" className="text-accent hover:underline mt-2">
            Back to IC Memos
          </Link>
        </div>
      </AppLayout>
    );
  }

  const content = memo.memo_content;
  const statusInfo = statusConfig[memo.status];
  const StatusIcon = statusInfo.icon;
  
  // Check if content has parsing error (raw content fallback)
  const hasParseError = content?._parse_error || content?.executive_summary?.opportunity === 'Failed to generate - see raw content';
  const rawContent = content?._raw_content;

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/ic-memo"
              className="p-2 rounded-md hover:bg-muted/50 transition-calm"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-medium text-foreground">{memo.ticker}</h1>
                <span className={cn(
                  "px-2 py-1 rounded text-xs font-medium",
                  "bg-muted text-muted-foreground"
                )}>
                  {memo.style_tag}
                </span>
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded",
                  statusInfo.color === "text-green-500" ? "bg-green-500/10" :
                  statusInfo.color === "text-blue-500" ? "bg-blue-500/10" :
                  statusInfo.color === "text-yellow-500" ? "bg-yellow-500/10" : "bg-red-500/10"
                )}>
                  <StatusIcon className={cn(
                    "w-3.5 h-3.5",
                    statusInfo.color,
                    memo.status === "generating" && "animate-spin"
                  )} />
                  <span className={cn("text-xs font-medium", statusInfo.color)}>
                    {statusInfo.label}
                    {memo.status === "generating" && ` (${memo.generation_progress}%)`}
                  </span>
                </div>
              </div>
              <p className="text-muted-foreground mt-1">{memo.company_name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {memo.status === "complete" && (
              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md",
                  "bg-accent text-accent-foreground text-sm font-medium",
                  "hover:bg-accent/90 transition-calm",
                  downloadingPdf && "opacity-50 cursor-not-allowed"
                )}
              >
                {downloadingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download PDF
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md",
                "border border-border text-sm",
                "hover:bg-muted/50 transition-calm",
                refreshing && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        {/* Status: Generating */}
        {memo.status === "generating" && (
          <div className="mb-8 p-6 rounded-lg border border-blue-500/30 bg-blue-500/5">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              <p className="font-medium text-blue-600">Generating IC Memo...</p>
            </div>
            <div className="w-full h-2 bg-blue-500/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${memo.generation_progress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Progress: {memo.generation_progress}% - Running supporting prompts and generating memo content
            </p>
          </div>
        )}

        {/* Status: Failed */}
        {memo.status === "failed" && (
          <div className="mb-8 p-6 rounded-lg border border-red-500/30 bg-red-500/5">
            <div className="flex items-center gap-3 mb-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <p className="font-medium text-red-600">Generation Failed</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {memo.error_message || "An error occurred during IC Memo generation."}
            </p>
          </div>
        )}

        {/* Status: Pending */}
        {memo.status === "pending" && (
          <div className="mb-8 p-6 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              <p className="font-medium text-yellow-600">Pending Generation</p>
            </div>
            <p className="text-sm text-muted-foreground">
              This IC Memo is queued for generation. Run Lane C to process pending memos.
            </p>
          </div>
        )}

        {/* Complete: Show Full Memo */}
        {memo.status === "complete" && content && (
          <div className="space-y-6">
            {/* Parse Error Warning */}
            {hasParseError && (
              <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                  <p className="font-medium text-yellow-600">Content Parsing Issue</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  The IC Memo content could not be fully parsed. The raw content is displayed below.
                  {content._parse_error && <span className="block mt-1 text-xs">Error: {content._parse_error}</span>}
                </p>
              </div>
            )}

            {/* Recommendation Banner */}
            {memo.recommendation && (
              <div className={cn(
                "p-6 rounded-lg border",
                recommendationColors[memo.recommendation.toLowerCase()] || "bg-muted border-border"
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-wider opacity-70 mb-1">Recommendation</p>
                    <p className="text-3xl font-bold uppercase">{memo.recommendation.replace(/_/g, ' ')}</p>
                  </div>
                  {memo.conviction !== null && (
                    <div className="text-right">
                      <p className="text-sm uppercase tracking-wider opacity-70 mb-1">Conviction</p>
                      <p className="text-3xl font-bold">{memo.conviction}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* If we have raw content due to parse error, show it */}
            {hasParseError && rawContent && (
              <RawContentViewer content={rawContent} />
            )}

            {/* Executive Summary */}
            {content.executive_summary && !hasParseError && (
              <Section title="Executive Summary" icon={FileText}>
                <div className="space-y-4">
                  {content.executive_summary.opportunity && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Opportunity</p>
                      <p className="text-foreground">{content.executive_summary.opportunity}</p>
                    </div>
                  )}
                  {content.executive_summary.why_now && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Why Now</p>
                      <p className="text-foreground">{content.executive_summary.why_now}</p>
                    </div>
                  )}
                  {content.executive_summary.risk_reward_asymmetry && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Risk/Reward Asymmetry</p>
                      <p className="text-foreground">{content.executive_summary.risk_reward_asymmetry}</p>
                    </div>
                  )}
                  {content.executive_summary.decision_required && (
                    <div className="p-4 bg-accent/5 rounded-lg border border-accent/20">
                      <p className="text-sm text-accent uppercase tracking-wider mb-1">Decision Required</p>
                      <p className="text-foreground font-medium">{content.executive_summary.decision_required}</p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Investment Thesis */}
            {content.investment_thesis && !hasParseError && (
              <Section title="Investment Thesis" icon={Lightbulb}>
                <div className="space-y-4">
                  {content.investment_thesis.central_thesis && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Central Thesis</p>
                      <p className="text-foreground font-medium">{content.investment_thesis.central_thesis}</p>
                    </div>
                  )}
                  {content.investment_thesis.value_creation_mechanism && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Value Creation Mechanism</p>
                      <p className="text-foreground">{content.investment_thesis.value_creation_mechanism}</p>
                    </div>
                  )}
                  {content.investment_thesis.sustainability && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Sustainability</p>
                      <p className="text-foreground">{content.investment_thesis.sustainability}</p>
                    </div>
                  )}
                  {content.investment_thesis.structural_vs_cyclical && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Structural vs Cyclical</p>
                      <p className="text-foreground">{content.investment_thesis.structural_vs_cyclical}</p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Business Analysis */}
            {content.business_analysis && !hasParseError && (
              <Section title="Business Analysis" icon={Building2}>
                <div className="space-y-4">
                  {content.business_analysis.how_company_makes_money && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">How Company Makes Money</p>
                      <p className="text-foreground">{content.business_analysis.how_company_makes_money}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    {content.business_analysis.competitive_advantages?.length > 0 && (
                      <div>
                        <p className="text-sm text-green-600 uppercase tracking-wider mb-2">Competitive Advantages</p>
                        <ul className="space-y-1">
                          {content.business_analysis.competitive_advantages.map((adv: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <TrendingUp className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{adv}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {content.business_analysis.competitive_weaknesses?.length > 0 && (
                      <div>
                        <p className="text-sm text-red-600 uppercase tracking-wider mb-2">Competitive Weaknesses</p>
                        <ul className="space-y-1">
                          {content.business_analysis.competitive_weaknesses.map((weak: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <TrendingDown className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                              <span>{weak}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {content.business_analysis.industry_structure && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Industry Structure</p>
                      <p className="text-foreground">{content.business_analysis.industry_structure}</p>
                    </div>
                  )}
                  
                  {content.business_analysis.competitive_dynamics && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Competitive Dynamics</p>
                      <p className="text-foreground">{content.business_analysis.competitive_dynamics}</p>
                    </div>
                  )}
                  
                  {content.business_analysis.barriers_to_entry && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Barriers to Entry</p>
                      <p className="text-foreground">{content.business_analysis.barriers_to_entry}</p>
                    </div>
                  )}
                  
                  {content.business_analysis.pricing_power && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Pricing Power</p>
                      <p className="text-foreground">{content.business_analysis.pricing_power}</p>
                    </div>
                  )}
                  
                  {content.business_analysis.disruption_risks && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Disruption Risks</p>
                      <p className="text-foreground">{content.business_analysis.disruption_risks}</p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Financial Quality */}
            {content.financial_quality && !hasParseError && (
              <Section title="Financial Quality" icon={BarChart3}>
                <div className="space-y-4">
                  {content.financial_quality.revenue_quality && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Revenue Quality</p>
                      <p className="text-foreground">{content.financial_quality.revenue_quality}</p>
                    </div>
                  )}
                  
                  {content.financial_quality.margin_analysis && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Margin Analysis</p>
                      <p className="text-foreground">{content.financial_quality.margin_analysis}</p>
                    </div>
                  )}
                  
                  {content.financial_quality.capital_intensity && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Capital Intensity</p>
                      <p className="text-foreground">{content.financial_quality.capital_intensity}</p>
                    </div>
                  )}
                  
                  {content.financial_quality.return_on_capital && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Return on Capital</p>
                      <p className="text-foreground">{content.financial_quality.return_on_capital}</p>
                    </div>
                  )}
                  
                  {content.financial_quality.accounting_distortions?.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Accounting Distortions</p>
                      <ul className="list-disc list-inside text-foreground space-y-1">
                        {content.financial_quality.accounting_distortions.map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {content.financial_quality.earnings_quality_risks?.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Earnings Quality Risks</p>
                      <ul className="list-disc list-inside text-foreground space-y-1">
                        {content.financial_quality.earnings_quality_risks.map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {content.financial_quality.growth_capital_dynamics && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Growth Capital Dynamics</p>
                      <p className="text-foreground">{content.financial_quality.growth_capital_dynamics}</p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Valuation */}
            {content.valuation && !hasParseError && (
              <Section title="Valuation" icon={DollarSign}>
                <div className="space-y-4">
                  {content.valuation.methodology && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Methodology</p>
                      <p className="text-foreground">{content.valuation.methodology}</p>
                    </div>
                  )}
                  
                  {content.valuation.key_assumptions?.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Key Assumptions</p>
                      <ul className="list-disc list-inside text-foreground space-y-1">
                        {content.valuation.key_assumptions.map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {content.valuation.value_range && (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
                        <p className="text-xs text-red-600 uppercase tracking-wider mb-1">Bear Case</p>
                        <p className="text-2xl font-bold text-red-600">
                          ${typeof content.valuation.value_range.bear === 'number' 
                            ? content.valuation.value_range.bear.toLocaleString() 
                            : content.valuation.value_range.bear || "-"}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center">
                        <p className="text-xs text-blue-600 uppercase tracking-wider mb-1">Base Case</p>
                        <p className="text-2xl font-bold text-blue-600">
                          ${typeof content.valuation.value_range.base === 'number' 
                            ? content.valuation.value_range.base.toLocaleString() 
                            : content.valuation.value_range.base || "-"}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20 text-center">
                        <p className="text-xs text-green-600 uppercase tracking-wider mb-1">Bull Case</p>
                        <p className="text-2xl font-bold text-green-600">
                          ${typeof content.valuation.value_range.bull === 'number' 
                            ? content.valuation.value_range.bull.toLocaleString() 
                            : content.valuation.value_range.bull || "-"}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {content.valuation.sensitivities?.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Sensitivities</p>
                      <ul className="list-disc list-inside text-foreground space-y-1">
                        {content.valuation.sensitivities.map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {content.valuation.expected_return && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Expected Return</p>
                      <p className="text-foreground">{content.valuation.expected_return}</p>
                    </div>
                  )}
                  
                  {content.valuation.opportunity_cost && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Opportunity Cost</p>
                      <p className="text-foreground">{content.valuation.opportunity_cost}</p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Risks */}
            {content.risks && !hasParseError && (
              <Section title="Risks" icon={Shield}>
                <div className="space-y-4">
                  {content.risks.material_risks?.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-3">Material Risks</p>
                      <div className="space-y-4">
                        {content.risks.material_risks.map((risk: any, i: number) => (
                          <RiskItem key={i} risk={risk} />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {content.risks.thesis_error_risks?.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Thesis Error Risks</p>
                      <ul className="list-disc list-inside text-foreground space-y-1">
                        {content.risks.thesis_error_risks.map((risk: string, i: number) => (
                          <li key={i}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {content.risks.asymmetric_risks?.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Asymmetric Risks</p>
                      <ul className="list-disc list-inside text-foreground space-y-1">
                        {content.risks.asymmetric_risks.map((risk: string, i: number) => (
                          <li key={i}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Variant Perception */}
            {content.variant_perception && !hasParseError && (
              <Section title="Variant Perception" icon={Target}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {content.variant_perception.consensus_view && (
                      <div className="p-4 rounded-lg bg-muted/30">
                        <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Consensus View</p>
                        <p className="text-foreground">{content.variant_perception.consensus_view}</p>
                      </div>
                    )}
                    {content.variant_perception.our_view && (
                      <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                        <p className="text-sm text-accent uppercase tracking-wider mb-1">Our View</p>
                        <p className="text-foreground">{content.variant_perception.our_view}</p>
                      </div>
                    )}
                  </div>
                  
                  {content.variant_perception.why_market_wrong && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Why Market May Be Wrong</p>
                      <p className="text-foreground">{content.variant_perception.why_market_wrong}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    {content.variant_perception.confirming_facts?.length > 0 && (
                      <div>
                        <p className="text-sm text-green-600 uppercase tracking-wider mb-2">Confirming Facts</p>
                        <ul className="list-disc list-inside text-foreground space-y-1">
                          {content.variant_perception.confirming_facts.map((fact: string, i: number) => (
                            <li key={i}>{fact}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {content.variant_perception.invalidating_facts?.length > 0 && (
                      <div>
                        <p className="text-sm text-red-600 uppercase tracking-wider mb-2">Invalidating Facts</p>
                        <ul className="list-disc list-inside text-foreground space-y-1">
                          {content.variant_perception.invalidating_facts.map((fact: string, i: number) => (
                            <li key={i}>{fact}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </Section>
            )}

            {/* Catalysts */}
            {content.catalysts && !hasParseError && (
              <Section title="Catalysts" icon={Calendar}>
                <div className="space-y-2">
                  {content.catalysts.value_unlocking_events?.map((catalyst: any, i: number) => (
                    <CatalystItem key={i} catalyst={catalyst} />
                  ))}
                  {content.catalysts.expected_horizon && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Expected Horizon:</span> {content.catalysts.expected_horizon}
                      </p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Portfolio Fit */}
            {content.portfolio_fit && !hasParseError && (
              <Section title="Portfolio Fit" icon={Briefcase}>
                <div className="grid grid-cols-2 gap-4">
                  {content.portfolio_fit.portfolio_role && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Portfolio Role</p>
                      <p className="text-foreground">{content.portfolio_fit.portfolio_role}</p>
                    </div>
                  )}
                  {content.portfolio_fit.correlation && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Correlation</p>
                      <p className="text-foreground">{content.portfolio_fit.correlation}</p>
                    </div>
                  )}
                  {content.portfolio_fit.concentration_impact && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Concentration Impact</p>
                      <p className="text-foreground">{content.portfolio_fit.concentration_impact}</p>
                    </div>
                  )}
                  {content.portfolio_fit.liquidity && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Liquidity</p>
                      <p className="text-foreground">{content.portfolio_fit.liquidity}</p>
                    </div>
                  )}
                  {content.portfolio_fit.drawdown_impact && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Drawdown Impact</p>
                      <p className="text-foreground">{content.portfolio_fit.drawdown_impact}</p>
                    </div>
                  )}
                  {content.portfolio_fit.sizing_rationale && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Sizing Rationale</p>
                      <p className="text-foreground">{content.portfolio_fit.sizing_rationale}</p>
                    </div>
                  )}
                  {content.portfolio_fit.suggested_position_size && (
                    <div className="col-span-2 p-4 bg-accent/5 rounded-lg border border-accent/20">
                      <p className="text-sm text-accent uppercase tracking-wider mb-1">Suggested Position Size</p>
                      <p className="text-foreground font-medium">{content.portfolio_fit.suggested_position_size}</p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Decision */}
            {content.decision && !hasParseError && (
              <Section title="Decision" icon={Scale}>
                <div className="space-y-4">
                  {content.decision.revisit_conditions?.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Revisit Conditions</p>
                      <ul className="list-disc list-inside text-foreground space-y-1">
                        {content.decision.revisit_conditions.map((cond: string, i: number) => (
                          <li key={i}>{cond}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {content.decision.change_of_mind_triggers?.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Change of Mind Triggers</p>
                      <ul className="list-disc list-inside text-foreground space-y-1">
                        {content.decision.change_of_mind_triggers.map((trigger: string, i: number) => (
                          <li key={i}>{trigger}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Supporting Analyses */}
            {memo.supporting_analyses && Object.keys(memo.supporting_analyses).length > 0 && (
              <Section title="Supporting Analyses" icon={ClipboardCheck} defaultOpen={false}>
                <div className="space-y-3">
                  {Object.entries(memo.supporting_analyses).map(([name, data]) => (
                    <SupportingAnalysisCard key={name} name={name} data={data} />
                  ))}
                </div>
              </Section>
            )}

            {/* Metadata */}
            <div className="text-sm text-muted-foreground border-t border-border pt-6 mt-8">
              <div className="flex items-center justify-between">
                <div>
                  <p>Approved by: {memo.approved_by || "System"}</p>
                  <p>Approved at: {formatDate(memo.approved_at)}</p>
                </div>
                <div className="text-right">
                  <p>Generated at: {formatDate(memo.completed_at)}</p>
                  <p>As of: {formatDate(memo.as_of)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
