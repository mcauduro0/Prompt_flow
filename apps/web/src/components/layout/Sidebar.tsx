"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  Inbox, 
  FileText, 
  Clock, 
  Shield, 
  Search,
  ChevronLeft,
  ChevronRight,
  Settings,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/status", label: "Status", icon: Home },
  { path: "/inbox", label: "Inbox", icon: Inbox },
  { path: "/queue", label: "Queue", icon: Clock },
  { path: "/research", label: "Research", icon: FileText },
  { path: "/qa", label: "QA", icon: Shield },
  { path: "/memory", label: "Memory", icon: Search },
  { path: "/telemetry", label: "Telemetry", icon: Activity },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside 
      className={cn(
        "h-screen fixed left-0 top-0 z-40",
        "border-r border-sidebar-border bg-sidebar",
        "flex flex-col transition-calm",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "h-16 flex items-center border-b border-sidebar-border",
        collapsed ? "justify-center px-3" : "px-5"
      )}>
        <Link href="/" className="flex items-center gap-3">
          <div 
            className={cn(
              "flex items-center justify-center rounded-md",
              "bg-accent/10 border border-accent/20",
              "w-8 h-8"
            )}
          >
            <span className="text-sm font-medium text-accent tracking-tight">A</span>
          </div>
          {!collapsed && (
            <span className="text-sm font-medium text-sidebar-foreground tracking-tight animate-fade-in">
              ARC
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path || 
                           (item.path !== "/status" && pathname?.startsWith(item.path + "/"));
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-md transition-calm group",
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className={cn(
                  "flex-shrink-0 transition-calm",
                  collapsed ? "w-5 h-5" : "w-4 h-4",
                  isActive ? "text-accent" : "text-muted-foreground group-hover:text-sidebar-foreground"
                )} />
                {!collapsed && (
                  <span className="text-sm animate-fade-in">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center gap-2 w-full rounded-md transition-calm",
            "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/30",
            collapsed ? "justify-center p-2" : "px-3 py-2"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs animate-fade-in">Collapse</span>
            </>
          )}
        </button>

        {/* Tagline - only when expanded */}
        {!collapsed && (
          <p className="text-[11px] text-sidebar-foreground/30 text-center mt-4 animate-fade-in">
            Disciplined process.
          </p>
        )}
      </div>
    </aside>
  );
}
