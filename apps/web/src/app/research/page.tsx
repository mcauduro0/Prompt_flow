"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { FileText, Download, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";

export default function ResearchPage() {
  const [packets, setPackets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPackets = async () => {
      try { const res = await fetch("/api/research"); if (res.ok) { const data = await res.json(); setPackets(data.packets || []); } } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchPackets();
  }, []);

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        <header className="page-header"><h1 className="page-header-title">Research Packets</h1><p className="page-header-subtitle">{packets.length} completed IC-grade research packets</p></header>
        <main className="flex-1 p-8">
          <div className="content-area">
            {loading ? (<div className="flex items-center justify-center py-20"><div className="animate-pulse text-muted-foreground">Loading packets...</div></div>
            ) : packets.length === 0 ? (<div className="text-center py-20 text-muted-foreground"><p>No research packets yet</p><p className="text-sm mt-2">Completed Lane B research will appear here</p></div>
            ) : (
              <div className="space-y-4">
                {packets.map((packet, idx) => (
                  <div key={packet.id} className="governance-card hover:border-accent/30 transition-colors animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <FileText className="w-8 h-8 text-accent mt-1" />
                        <div>
                          <div className="flex items-center gap-3 mb-1"><span className="font-mono font-medium">{packet.ticker}</span><span className="text-xs text-accent uppercase">{packet.style?.replace("_", " ")}</span>{packet.is_complete ? <CheckCircle className="w-4 h-4 text-success" /> : <AlertCircle className="w-4 h-4 text-warning" />}</div>
                          <div className="text-sm text-muted-foreground mb-2">{packet.company_name}</div>
                          <div className="text-sm">{packet.headline}</div>
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground"><span>Version: {packet.version || 1}</span><span>Created: {new Date(packet.created_at).toLocaleDateString()}</span></div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Link href={`/research/${packet.id}`} className="p-2 rounded-md border border-border hover:bg-secondary transition-colors" title="View Details"><ExternalLink className="w-4 h-4" /></Link>
                        <button className="p-2 rounded-md border border-border hover:bg-secondary transition-colors" title="Download PDF"><Download className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
