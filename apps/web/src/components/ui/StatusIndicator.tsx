import { cn } from "@/lib/utils";

type StatusType = "healthy" | "warning" | "fail";

interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  className?: string;
  showPulse?: boolean;
}

export function StatusIndicator({ 
  status, 
  label, 
  className,
  showPulse = true 
}: StatusIndicatorProps) {
  const statusConfig = {
    healthy: {
      dotClass: "bg-success",
      labelClass: "text-success",
      text: label || "Healthy"
    },
    warning: {
      dotClass: "bg-warning",
      labelClass: "text-warning", 
      text: label || "Warning"
    },
    fail: {
      dotClass: "bg-fail",
      labelClass: "text-fail",
      text: label || "Attention Required"
    }
  };

  const config = statusConfig[status];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="relative flex h-2.5 w-2.5">
        {showPulse && status === "healthy" && (
          <span className={cn(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-40",
            config.dotClass
          )} />
        )}
        <span className={cn(
          "relative inline-flex rounded-full h-2.5 w-2.5",
          config.dotClass
        )} />
      </span>
      <span className={cn("text-sm font-medium", config.labelClass)}>
        {config.text}
      </span>
    </div>
  );
}
