import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Eye, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type InvestmentStyle = "Quality" | "GARP" | "Cigar Butt";
type NoveltyStatus = "New" | "Reappearance" | "Repeat";

interface IdeaCardProps {
  id: string;
  company: string;
  ticker: string;
  hypothesis: string;
  style: InvestmentStyle;
  novelty: NoveltyStatus;
  hasEdge?: boolean;
  hasCatalyst?: boolean;
  lastSeen?: string;
  onPromote?: (id: string) => void;
  onReject?: (id: string) => void;
  onWatch?: (id: string) => void;
}

export function IdeaCard({
  id,
  company,
  ticker,
  hypothesis,
  style,
  novelty,
  hasEdge = false,
  hasCatalyst = false,
  lastSeen,
  onPromote,
  onReject,
  onWatch,
}: IdeaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const styleLabel = {
    "Quality": "Quality",
    "GARP": "GARP",
    "Cigar Butt": "Deep Value"
  };

  const handleCardClick = () => {
    setExpanded(!expanded);
  };

  const handleViewDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/inbox/${id}`);
  };

  return (
    <article 
      className={cn(
        "group bg-card rounded-md transition-calm cursor-pointer reveal-on-intent",
        "border border-transparent",
        expanded ? "bg-secondary/20 border-border/40" : "hover:bg-secondary/15"
      )}
      onClick={handleCardClick}
      style={{ padding: 'var(--space-6)' }}
    >
      {/* Top metadata row */}
      <div 
        className="flex items-center justify-between"
        style={{ marginBottom: 'var(--space-4)' }}
      >
        {/* Novelty status */}
        <span className={cn(
          "text-label",
          novelty === "New" && "text-accent",
          novelty === "Reappearance" && "text-muted-foreground/70",
          novelty === "Repeat" && "text-muted-foreground/40"
        )}>
          {novelty}
          {lastSeen && novelty !== "New" && (
            <span 
              className="normal-case text-annotation text-muted-foreground/40"
              style={{ letterSpacing: 'normal', marginLeft: 'var(--space-2)' }}
            >
              · {lastSeen}
            </span>
          )}
        </span>
        
        {/* Style classification */}
        <span className={cn(
          "text-annotation",
          style === "Quality" && "text-accent/60",
          style === "GARP" && "text-foreground/40",
          style === "Cigar Butt" && "text-warning/50"
        )}>
          {styleLabel[style]}
        </span>
      </div>

      {/* Company identification */}
      <div 
        className="flex items-baseline"
        style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}
      >
        <h3 className="text-subsection text-foreground">{company}</h3>
        <span className="text-annotation font-mono text-muted-foreground/60">{ticker}</span>
      </div>

      {/* Hypothesis - No adjectives, no recommendations */}
      <p 
        className={cn(
          "text-body text-foreground/85 reading-width",
          !expanded && "line-clamp-2"
        )}
        style={{ lineHeight: 1.75 }}
      >
        {hypothesis}
      </p>

      {/* Edge/Catalyst indicators */}
      {(hasEdge || hasCatalyst) && (
        <div 
          className="flex items-center border-t border-border/20"
          style={{ 
            gap: 'var(--space-5)', 
            marginTop: 'var(--space-4)', 
            paddingTop: 'var(--space-3)' 
          }}
        >
          {hasEdge && (
            <span className="text-annotation text-muted-foreground/60 flex items-center gap-2">
              <span 
                className="rounded-full bg-accent/40" 
                style={{ width: '4px', height: '4px' }}
              />
              Evidence edge noted
            </span>
          )}
          {hasCatalyst && (
            <span className="text-annotation text-muted-foreground/60 flex items-center gap-2">
              <span 
                className="rounded-full bg-accent/40" 
                style={{ width: '4px', height: '4px' }}
              />
              Near-term catalyst
            </span>
          )}
        </div>
      )}

      {/* Expanded: Actions */}
      {expanded && (
        <div 
          className="animate-fade-in"
          style={{ marginTop: 'var(--space-5)' }}
        >
          <div 
            className="border-t border-border/30" 
            style={{ paddingTop: 'var(--space-5)' }} 
          />
          
          {/* Actions - Describe what happens, not why */}
          <div className="flex items-center justify-between">
            <div className="flex items-center" style={{ gap: 'var(--space-3)' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPromote?.(id);
                }}
                className={cn(
                  "flex items-center gap-2 text-supporting rounded-md",
                  "bg-accent text-accent-foreground",
                  "hover:bg-accent/90 transition-calm"
                )}
                style={{ padding: 'var(--space-2) var(--space-4)', fontWeight: 450 }}
              >
                <ArrowUpRight style={{ width: '14px', height: '14px' }} />
                Promote to deep research
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onWatch?.(id);
                }}
                className={cn(
                  "flex items-center gap-2 text-supporting rounded-md",
                  "bg-secondary text-secondary-foreground",
                  "hover:bg-secondary/70 transition-calm"
                )}
                style={{ padding: 'var(--space-2) var(--space-4)', fontWeight: 450 }}
              >
                <Eye style={{ width: '14px', height: '14px' }} />
                Add to watchlist
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReject?.(id);
                }}
                className={cn(
                  "flex items-center gap-2 text-supporting rounded-md",
                  "text-muted-foreground",
                  "hover:text-foreground hover:bg-secondary/40 transition-calm"
                )}
                style={{ padding: 'var(--space-2) var(--space-4)' }}
              >
                <X style={{ width: '14px', height: '14px' }} />
                Reject with reason
              </button>
            </div>

            {/* View full detail link */}
            <button
              onClick={handleViewDetail}
              className={cn(
                "flex items-center gap-2 text-annotation text-muted-foreground",
                "hover:text-foreground transition-calm"
              )}
            >
              View detail
              <ChevronRight style={{ width: '14px', height: '14px' }} />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
