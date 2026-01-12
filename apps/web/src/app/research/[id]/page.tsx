"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeft, Download, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const modules = ["Business Model", "Industry & Moat", "Financial Forensics", "Capital Allocation", "Management Quality", "Valuation", "Risk & Stress"];

export default function ResearchDetailPage() {
  const params = useParams();
  const [packet, setPacket] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const packetId = params?.id as string | undefined;

  useEffect(() => { 
    const fetchPacket = async () => { 
      if (!packetId) return;
      try { 
        const res = await fetch(`/api/research/${packetId}`); 
        if (res.ok) { const data = await res.json(); setPacket(data); } 
      } catch (err) { console.error(err); } finally { setLoading(false); } 
    }; 
    if (packetId) fetchPacket(); 
  }, [packetId]);

  if (loading) return <AppLayout><div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-muted-foreground">Loading...</div></div></AppLayout>;
  if (!packet) return <AppLayout><div className="flex items-center justify-center min-h-screen text-muted-foreground">Packet not found</div></AppLayout>;

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        <header className="page-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4"><Link href="/research" className="p-2 rounded-md hover:bg-secondary transition-colors"><ArrowLeft className="w-5 h-5" /></Link><div><div className="flex items-center gap-3"><h1 className="page-header-title">{packet.ticker}</h1><span className="text-sm text-accent uppercase">{packet.style?.replace("_", " ")}</span>{packet.is_complete ? <CheckCircle className="w-5 h-5 text-success" /> : <AlertCircle className="w-5 h-5 text-warning" />}</div><p className="page-header-subtitle">{packet.company_name}</p></div></div>
            <button className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors"><Download className="w-4 h-4" /> Export PDF</button>
          </div>
        </header>
        <main className="flex-1 p-8">
          <div className="content-area space-y-8">
            <section className="governance-card"><h2 className="text-section-title mb-4">Executive Summary</h2><p className="text-lg font-medium mb-4">{packet.headline}</p><p className="text-muted-foreground">{packet.summary || "Summary not available"}</p></section>
            <section className="governance-card"><h2 className="text-section-title mb-4">Research Modules</h2>
              <div className="grid md:grid-cols-2 gap-4">{modules.map((mod, i) => { const moduleData = packet.modules?.[i] || {}; const isComplete = moduleData.status === "complete"; return (<div key={i} className={cn("p-4 rounded-md border", isComplete ? "border-success/30 bg-success/5" : "border-border bg-secondary/30")}><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-accent" /><span className="font-medium">{mod}</span></div>{isComplete ? <CheckCircle className="w-4 h-4 text-success" /> : <AlertCircle className="w-4 h-4 text-muted-foreground" />}</div><p className="text-sm text-muted-foreground">{moduleData.summary || "Pending analysis..."}</p></div>); })}</div>
            </section>
            {packet.variant_perception && (<section className="governance-card"><h2 className="text-section-title mb-4">Variant Perception</h2><p className="text-sm">{packet.variant_perception}</p></section>)}
            {packet.historical_parallels && (<section className="governance-card"><h2 className="text-section-title mb-4">Historical Parallels</h2><p className="text-sm">{packet.historical_parallels}</p></section>)}
            {packet.pre_mortem && (<section className="governance-card governance-card-warn"><h2 className="text-section-title mb-4">Pre-Mortem Analysis</h2><p className="text-sm">{packet.pre_mortem}</p></section>)}
            {packet.monitoring_plan && (<section className="governance-card"><h2 className="text-section-title mb-4">Monitoring Plan</h2><p className="text-sm">{packet.monitoring_plan}</p></section>)}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
