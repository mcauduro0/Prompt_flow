"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Home, Inbox, FileText, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface WarmUpStatus {
  laneA: {
    runId: string;
    status: string;
    runDate: string;
    completedAt: string | null;
    summary: any;
  } | null;
  laneB: {
    runId: string;
    status: string;
    runDate: string;
    completedAt: string | null;
    summary: any;
  } | null;
  qa: {
    runId: string;
    status: string;
    runDate: string;
    completedAt: string | null;
    summary: any;
  } | null;
}

interface ServiceStatus {
  api: string;
  database: string;
  worker: string;
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "No runs yet";
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrentDate = (): string => {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export default function StatusPage() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [warmUp, setWarmUp] = useState<WarmUpStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [healthRes, warmUpRes] = await Promise.all([
          fetch("/api/health"),
          fetch("/api/runs/warmup-status"),
        ]);

        if (healthRes.ok) {
          const data = await healthRes.json();
          setStatus({
            api: "operational",
            database: data.services?.database === "connected" ? "operational" : "unavailable",
            worker: "operational",
          });
        } else {
          setStatus({ api: "degraded", database: "unavailable", worker: "unavailable" });
        }

        if (warmUpRes.ok) {
          const warmUpData = await warmUpRes.json();
          setWarmUp(warmUpData);
        }
      } catch {
        setStatus({ api: "unavailable", database: "unavailable", worker: "unavailable" });
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const isSystemHealthy = status?.api === "operational" && 
                          status?.database === "operational" && 
                          status?.worker === "operational";

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        {/* Centered hero content */}
        <main className="flex-1 flex flex-col items-center justify-center px-8 py-16">
          <div className="max-w-lg w-full text-center">
            {loading ? (
              <div className="animate-fade-in">
                <p className="text-muted-foreground">Checking system status...</p>
              </div>
            ) : (
              <>
                {/* Main status headline */}
                <div className="animate-fade-in">
                  <h1 className="text-2xl font-medium text-foreground tracking-tight mb-3">
                    {isSystemHealthy 
                      ? "System status: operating normally."
                      : "System status: attention required."
                    }
                  </h1>
                  <p className="text-muted-foreground">
                    {isSystemHealthy 
                      ? "No action required."
                      : "Review service status below."
                    }
                  </p>
                </div>

                {/* Status cards grid */}
                <div 
                  className="grid grid-cols-2 gap-4 animate-fade-in"
                  style={{ marginTop: 'var(--space-10)', animationDelay: '150ms' }}
                >
                  <StatusCard
                    icon={Inbox}
                    label="Lane A"
                    value={warmUp?.laneA 
                      ? formatDate(warmUp.laneA.completedAt || warmUp.laneA.runDate)
                      : "No runs yet"
                    }
                    status={warmUp?.laneA?.status === "completed" ? "healthy" : "neutral"}
                    delay={0}
                  />
                  <StatusCard
                    icon={FileText}
                    label="Lane B"
                    value={warmUp?.laneB 
                      ? formatDate(warmUp.laneB.completedAt || warmUp.laneB.runDate)
                      : "No runs yet"
                    }
                    status={warmUp?.laneB?.status === "completed" ? "healthy" : "neutral"}
                    delay={75}
                  />
                  <StatusCard
                    icon={Shield}
                    label="QA Report"
                    value={warmUp?.qa 
                      ? formatDate(warmUp.qa.completedAt || warmUp.qa.runDate)
                      : "No runs yet"
                    }
                    status={warmUp?.qa?.status === "completed" ? "healthy" : "neutral"}
                    delay={150}
                  />
                  <StatusCard
                    icon={Home}
                    label="Services"
                    value={isSystemHealthy ? "All operational" : "Check required"}
                    status={isSystemHealthy ? "healthy" : "warning"}
                    delay={225}
                  />
                </div>

                {/* Service details - only show if there's an issue */}
                {!isSystemHealthy && (
                  <div 
                    className="mt-8 p-6 bg-card rounded-md border border-border animate-fade-in"
                    style={{ animationDelay: '300ms' }}
                  >
                    <h2 className="text-sm font-medium text-foreground mb-4 text-left">Service Status</h2>
                    <div className="space-y-3">
                      <ServiceRow name="API Server" status={status?.api || "unavailable"} />
                      <ServiceRow name="Database" status={status?.database || "unavailable"} />
                      <ServiceRow name="Worker" status={status?.worker || "unavailable"} />
                    </div>
                  </div>
                )}

                {/* Footer with current date */}
                <div 
                  className="animate-fade-in"
                  style={{ marginTop: 'var(--space-12)', animationDelay: '375ms' }}
                >
                  <p className="text-annotation text-muted-foreground/50">
                    {formatCurrentDate()}
                  </p>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}

interface StatusCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  status: "healthy" | "warning" | "neutral";
  delay: number;
}

function StatusCard({ icon: Icon, label, value, status, delay }: StatusCardProps) {
  return (
    <div 
      className={cn(
        "p-5 bg-card rounded-md border border-border/60 text-left animate-fade-in transition-calm",
        "hover:border-border"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {status !== "neutral" && (
          <span className={cn(
            "relative flex h-2 w-2",
          )}>
            {status === "healthy" && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-40" />
            )}
            <span className={cn(
              "relative inline-flex rounded-full h-2 w-2",
              status === "healthy" && "bg-success",
              status === "warning" && "bg-warning"
            )} />
          </span>
        )}
        <span className={cn(
          "text-sm font-medium",
          status === "healthy" && "text-foreground",
          status === "warning" && "text-warning",
          status === "neutral" && "text-muted-foreground"
        )}>
          {value}
        </span>
      </div>
    </div>
  );
}

interface ServiceRowProps {
  name: string;
  status: string;
}

function ServiceRow({ name, status }: ServiceRowProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{name}</span>
      <div className="flex items-center gap-2">
        <span className={cn(
          "relative flex h-2 w-2",
        )}>
          <span className={cn(
            "relative inline-flex rounded-full h-2 w-2",
            status === "operational" && "bg-success",
            status === "degraded" && "bg-warning",
            status === "unavailable" && "bg-fail"
          )} />
        </span>
        <span className={cn(
          "capitalize",
          status === "operational" && "text-success",
          status === "degraded" && "text-warning",
          status === "unavailable" && "text-fail"
        )}>
          {status}
        </span>
      </div>
    </div>
  );
}
