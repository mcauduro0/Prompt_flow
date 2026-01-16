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
  Activity,
  BookOpen,
  PieChart,
  Server,
  ClipboardCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: string;
}

const navItems: NavItem[] = [
  // Core workflow
  { path: "/status", label: "Status", icon: Home, section: "core" },
  { path: "/inbox", label: "Inbox", icon: Inbox, section: "core" },
  { path: "/queue", label: "Queue", icon: Clock, section: "core" },
  { path: "/research", label: "Research", icon: FileText, section: "core" },
  { path: "/ic-memo", label: "IC Memo", icon: ClipboardCheck, section: "core" },
  
  // Management
  { path: "/prompts", label: "Prompts", icon: BookOpen, section: "manage" },
  { path: "/portfolio", label: "Portfolio", icon: PieChart, section: "manage" },
  
  // System
  { path: "/telemetry", label: "Telemetry", icon: Activity, section: "system" },
  { path: "/system", label: "System", icon: Server, section: "system" },
  
  // Other
  { path: "/qa", label: "QA", icon: Shield, section: "other" },
  { path: "/memory", label: "Memory", icon: Search, section: "other" },
  { path: "/settings", label: "Settings", icon: Settings, section: "other" },
];

const sectionLabels: Record<string, string> = {
  core: "Workflow",
  manage: "Management",
  system: "System",
  other: "Other",
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // Group items by section
  const sections = navItems.reduce((acc, item) => {
    const section = item.section || 'other';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

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
        {Object.entries(sections).map(([section, items]) => (
          <div key={section} className="mb-4">
            {/* Section label */}
            {!collapsed && (
              <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 px-3 mb-2 animate-fade-in">
                {sectionLabels[section]}
              </p>
            )}
            
            <div className="space-y-0.5">
              {items.map((item) => {
                const isActive = pathname === item.path || 
                               (item.path !== "/status" && pathname?.startsWith(item.path + "/"));
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={cn(
                      "flex items-center gap-3 rounded-md transition-calm group",
                      collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
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
          </div>
        ))}
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
