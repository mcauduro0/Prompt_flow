import { StatusIndicator } from "@/components/ui/StatusIndicator";

export default function SystemStatus() {
  const currentTime = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-medium text-foreground tracking-tight">
              System Status
            </h1>
            <StatusIndicator status="healthy" showPulse />
          </div>
          <span className="text-sm text-muted-foreground font-mono">
            {currentTime}
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-lg text-center animate-fade-in">
          {/* Primary message - Neutral orientation */}
          <h2 className="text-3xl font-light text-foreground leading-tight mb-3 text-balance">
            System status: operating normally.
          </h2>
          <p className="text-lg text-muted-foreground mb-16">
            No action required.
          </p>

          {/* Status grid */}
          <div className="grid grid-cols-2 gap-6 text-left">
            <StatusCard
              label="Last Discovery Run"
              value="Completed at 06:02"
              detail="47 ideas screened"
            />
            <StatusCard
              label="Next Scheduled Run"
              value="Tomorrow at 06:00"
              detail="Local time"
            />
            <StatusCard
              label="Active Research"
              value="3 items"
              detail="Awaiting synthesis"
            />
            <StatusCard
              label="Governance"
              value="Pass"
              detail="Last check 1 hour ago"
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-4">
        <p className="text-xs text-muted-foreground/50 text-center">
          {currentDate}
        </p>
      </footer>
    </div>
  );
}

interface StatusCardProps {
  label: string;
  value: string;
  detail: string;
}

function StatusCard({ label, value, detail }: StatusCardProps) {
  return (
    <div className="p-5 rounded-md bg-card border border-border/60 transition-calm hover:border-border">
      <span className="text-xs text-muted-foreground/70 uppercase tracking-wider">
        {label}
      </span>
      <p className="text-base font-medium text-foreground mt-2 mb-1">
        {value}
      </p>
      <p className="text-sm text-muted-foreground">
        {detail}
      </p>
    </div>
  );
}
