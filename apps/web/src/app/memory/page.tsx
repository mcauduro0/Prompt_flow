"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Clock, XCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MemoryPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => { if (!query.trim()) return; setLoading(true); try { const res = await fetch(`/api/memory/search?q=${encodeURIComponent(query)}`); if (res.ok) { const data = await res.json(); setResults(data.results || []); } } catch (err) { console.error(err); } finally { setLoading(false); } };

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        <header className="page-header"><h1 className="page-header-title">Memory Search</h1><p className="page-header-subtitle">Search rejection history and idea reappearances</p></header>
        <main className="flex-1 p-8">
          <div className="content-area">
            <div className="governance-card mb-8"><div className="flex gap-4"><div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" /><input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Search by ticker, company name, or keyword..." className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-md focus:outline-none focus:border-accent" /></div><button onClick={handleSearch} disabled={loading} className="px-6 py-3 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50">{loading ? "Searching..." : "Search"}</button></div></div>
            {results.length === 0 ? (<div className="text-center py-20 text-muted-foreground"><p>Search for past ideas and rejections</p><p className="text-sm mt-2">Find rejection shadows and track reappearances</p></div>
            ) : (
              <div className="space-y-4">{results.map((item, idx) => (<div key={idx} className={cn("governance-card animate-fade-in", item.status === "rejected" && "border-fail/30")} style={{ animationDelay: `${idx * 50}ms` }}><div className="flex items-start justify-between gap-4"><div className="flex-1"><div className="flex items-center gap-3 mb-2"><span className="font-mono font-medium">{item.ticker}</span>{item.status === "rejected" && <span className="flex items-center gap-1 text-xs text-fail"><XCircle className="w-3 h-3" /> Rejected</span>}{item.reappearance_count > 0 && <span className="flex items-center gap-1 text-xs text-warning"><RefreshCw className="w-3 h-3" /> {item.reappearance_count}x reappeared</span>}</div><div className="text-sm text-muted-foreground mb-2">{item.company_name}</div><div className="text-sm">{item.headline}</div>{item.rejection_reason && (<div className="mt-3 p-3 bg-fail/10 rounded-md"><div className="text-xs text-fail font-medium mb-1">Rejection Reason</div><div className="text-sm text-muted-foreground">{item.rejection_reason}</div></div>)}{item.whats_new && (<div className="mt-3 p-3 bg-accent/10 rounded-md"><div className="text-xs text-accent font-medium mb-1">What&apos;s New Since Rejection</div><div className="text-sm text-muted-foreground">{item.whats_new}</div></div>)}</div><div className="text-right text-xs text-muted-foreground"><div className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(item.last_seen).toLocaleDateString()}</div>{item.days_since_rejection && <div className="mt-1">{item.days_since_rejection} days ago</div>}</div></div></div>))}</div>
            )}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
