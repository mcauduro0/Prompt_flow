"use client";

import { useState, useRef, useCallback } from "react";
import { Plus, Upload, Search, X, Check, AlertCircle, Loader2, FileSpreadsheet, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  ticker: string;
  companyName: string;
  exchange?: string;
}

interface SubmissionResult {
  input: string;
  success: boolean;
  ticker?: string;
  companyName?: string;
  ideaId?: string;
  error?: string;
}

interface ManualIdeaInputProps {
  onSuccess?: () => void;
  className?: string;
}

export function ManualIdeaInput({ onSuccess, className }: ManualIdeaInputProps) {
  const [mode, setMode] = useState<"single" | "batch" | "upload">("single");
  const [singleInput, setSingleInput] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<SubmissionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Search for companies as user types
  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch("/api/manual-ideas/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
        setShowDropdown(true);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSingleInputChange = (value: string) => {
    setSingleInput(value);
    setError(null);
    
    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(value);
    }, 300);
  };

  const selectSearchResult = (result: SearchResult) => {
    setSingleInput(result.ticker);
    setShowDropdown(false);
    setSearchResults([]);
  };

  // Submit single ticker
  const handleSingleSubmit = async () => {
    if (!singleInput.trim()) return;
    
    setSubmitting(true);
    setError(null);
    setResults(null);
    
    try {
      const res = await fetch("/api/manual-ideas/single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: singleInput.trim() }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setResults([{
          input: singleInput,
          success: true,
          ticker: data.idea.ticker,
          companyName: data.idea.companyName,
          ideaId: data.idea.ideaId,
        }]);
        setSingleInput("");
        onSuccess?.();
      } else {
        setError(data.error || "Failed to add idea");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit batch tickers
  const handleBatchSubmit = async () => {
    if (!batchInput.trim()) return;
    
    setSubmitting(true);
    setError(null);
    setResults(null);
    
    try {
      const res = await fetch("/api/manual-ideas/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: batchInput }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setResults(data.results);
        setBatchInput("");
        onSuccess?.();
      } else {
        setError(data.error || "Failed to process batch");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setSubmitting(true);
    setError(null);
    setResults(null);
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch("/api/manual-ideas/upload", {
        method: "POST",
        body: formData,
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setResults(data.results);
        onSuccess?.();
      } else {
        setError(data.error || "Failed to process file");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Download template
  const handleDownloadTemplate = () => {
    window.open("/api/manual-ideas/template", "_blank");
  };

  const clearResults = () => {
    setResults(null);
    setError(null);
  };

  return (
    <div className={cn("rounded-lg border border-border bg-card p-6", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-foreground">Add Ideas Manually</h3>
        <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
          <button
            onClick={() => { setMode("single"); clearResults(); }}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-calm",
              mode === "single"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Single
          </button>
          <button
            onClick={() => { setMode("batch"); clearResults(); }}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-calm",
              mode === "batch"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Batch
          </button>
          <button
            onClick={() => { setMode("upload"); clearResults(); }}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-calm",
              mode === "upload"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Upload
          </button>
        </div>
      </div>

      {/* Single Input Mode */}
      {mode === "single" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Enter a ticker symbol (e.g., AAPL) or company name (e.g., Apple Inc.)
          </p>
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={singleInput}
                  onChange={(e) => handleSingleInputChange(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="AAPL or Apple Inc."
                  className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  disabled={submitting}
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                )}
              </div>
              <button
                onClick={handleSingleSubmit}
                disabled={!singleInput.trim() || submitting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add
              </button>
            </div>
            
            {/* Search dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectSearchResult(result)}
                    className="w-full px-4 py-2 text-left hover:bg-secondary/50 flex items-center justify-between"
                  >
                    <span className="font-medium text-foreground">{result.ticker}</span>
                    <span className="text-sm text-muted-foreground truncate ml-2">{result.companyName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Batch Input Mode */}
      {mode === "batch" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Enter multiple tickers or company names, separated by commas (max 50)
          </p>
          <textarea
            value={batchInput}
            onChange={(e) => { setBatchInput(e.target.value); setError(null); }}
            placeholder="AAPL, MSFT, GOOGL, Tesla Inc., Amazon"
            rows={4}
            className="w-full px-4 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            disabled={submitting}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {batchInput.split(",").filter(s => s.trim()).length} items
            </span>
            <button
              onClick={handleBatchSubmit}
              disabled={!batchInput.trim() || submitting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add All
            </button>
          </div>
        </div>
      )}

      {/* Upload Mode */}
      {mode === "upload" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload a CSV or Excel file with tickers/company names (max 200 items)
          </p>
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              disabled={submitting}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              className="flex-1 px-4 py-8 border-2 border-dashed border-border rounded-lg hover:border-primary/50 hover:bg-secondary/30 transition-calm flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              ) : (
                <Upload className="w-8 h-8 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {submitting ? "Processing..." : "Click to upload CSV or Excel"}
              </span>
            </button>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={handleDownloadTemplate}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Download template
            </button>
            <span className="text-xs text-muted-foreground">
              File must have a column named "ticker", "symbol", "company", or "name"
            </span>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* Results display */}
      {results && results.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">Results</h4>
            <button
              onClick={clearResults}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-48 overflow-auto space-y-1">
            {results.map((result, idx) => (
              <div
                key={idx}
                className={cn(
                  "px-3 py-2 rounded-md flex items-center justify-between text-sm",
                  result.success
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-destructive/10 text-destructive"
                )}
              >
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  <span className="font-medium">{result.ticker || result.input}</span>
                  {result.companyName && (
                    <span className="text-muted-foreground">— {result.companyName}</span>
                  )}
                </div>
                {result.error && (
                  <span className="text-xs">{result.error}</span>
                )}
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            {results.filter(r => r.success).length} added, {results.filter(r => !r.success).length} failed
          </div>
        </div>
      )}
    </div>
  );
}
