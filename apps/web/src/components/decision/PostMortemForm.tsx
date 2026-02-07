"use client";
import { useState } from "react";
import { 
  CheckCircle,
  XCircle,
  Clock,
  Save,
  Loader2,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PostMortemFormProps {
  memoId: string;
  ticker: string;
  companyName: string;
  expectedReturn: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://159.203.86.246:3001';

export function PostMortemForm({ 
  memoId, 
  ticker, 
  companyName, 
  expectedReturn,
  onSuccess,
  onCancel 
}: PostMortemFormProps) {
  const [realizedReturn, setRealizedReturn] = useState<number>(0);
  const [holdingPeriodDays, setHoldingPeriodDays] = useState<number>(0);
  const [postMortemStatus, setPostMortemStatus] = useState<'success' | 'failure' | 'ongoing'>('ongoing');
  const [postMortemNotes, setPostMortemNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/learning-loop/post-mortem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memoId,
          realizedReturnPct: realizedReturn,
          holdingPeriodDays,
          postMortemStatus,
          postMortemNotes,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit post-mortem');
      }

      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const deviation = realizedReturn - expectedReturn;
  const isModelError = Math.abs(deviation) > 20;

  if (success) {
    return (
      <div className="bg-card rounded-lg border p-6 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Post-Mortem Recorded</h3>
        <p className="text-muted-foreground mb-4">
          The post-mortem data for {ticker} has been successfully recorded.
        </p>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border p-6">
      <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5" />
        Post-Mortem: {ticker}
      </h3>
      <p className="text-sm text-muted-foreground mb-6">{companyName}</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Status Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Position Status</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPostMortemStatus('success')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md border transition-colors",
                postMortemStatus === 'success' 
                  ? "bg-green-500/20 border-green-500 text-green-500" 
                  : "hover:bg-muted"
              )}
            >
              <CheckCircle className="w-5 h-5" />
              Success
            </button>
            <button
              type="button"
              onClick={() => setPostMortemStatus('failure')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md border transition-colors",
                postMortemStatus === 'failure' 
                  ? "bg-red-500/20 border-red-500 text-red-500" 
                  : "hover:bg-muted"
              )}
            >
              <XCircle className="w-5 h-5" />
              Failure
            </button>
            <button
              type="button"
              onClick={() => setPostMortemStatus('ongoing')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md border transition-colors",
                postMortemStatus === 'ongoing' 
                  ? "bg-blue-500/20 border-blue-500 text-blue-500" 
                  : "hover:bg-muted"
              )}
            >
              <Clock className="w-5 h-5" />
              Ongoing
            </button>
          </div>
        </div>

        {/* Realized Return */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Realized Return (%)
          </label>
          <div className="relative">
            {realizedReturn >= 0 ? (
              <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
            ) : (
              <TrendingDown className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
            )}
            <input
              type="number"
              step="0.1"
              value={realizedReturn}
              onChange={(e) => setRealizedReturn(Number(e.target.value))}
              className="w-full pl-10 pr-4 py-2 bg-background border rounded-md"
              placeholder="e.g., 15.5"
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Expected: {expectedReturn >= 0 ? '+' : ''}{expectedReturn.toFixed(1)}%
            </span>
            <span className={cn(
              deviation >= 0 ? 'text-green-500' : 'text-red-500'
            )}>
              Deviation: {deviation >= 0 ? '+' : ''}{deviation.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Model Error Warning */}
        {isModelError && (
          <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-500">Model Error Detected</p>
              <p className="text-sm text-muted-foreground">
                The realized return deviates more than 20% from the expected return. 
                This will be flagged for model improvement analysis.
              </p>
            </div>
          </div>
        )}

        {/* Holding Period */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Holding Period (days)
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="number"
              min="0"
              value={holdingPeriodDays}
              onChange={(e) => setHoldingPeriodDays(Number(e.target.value))}
              className="w-full pl-10 pr-4 py-2 bg-background border rounded-md"
              placeholder="e.g., 180"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Post-Mortem Notes
          </label>
          <textarea
            value={postMortemNotes}
            onChange={(e) => setPostMortemNotes(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 bg-background border rounded-md resize-none"
            placeholder="What went right? What went wrong? What can we learn?"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive rounded-md text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border rounded-md hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Post-Mortem
          </button>
        </div>
      </form>
    </div>
  );
}
