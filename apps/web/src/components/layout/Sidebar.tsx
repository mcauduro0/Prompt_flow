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
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/status", label: "Status", icon: Home },
  { path: "/inbox", label: "Inbox", icon: Inbox },
  { path: "/queue", label: "Queue", icon: Clock },
  { path: "/research", label: "Research", icon: FileText },
  { path: "/qa", label: "QA", icon: Shield },
  { path: "/memory", label: "Memory", icon: Search },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside 
      className={cn(
        "h-screen sticky top-0 border-r border-sidebar-border bg-sidebar flex flex-col transition-all duration-300",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "h-16 flex items-center border-b border-sidebar-border",
        collapsed ? "justify-center px-2" : "justify-between px-4"
      )}>
        {!collapsed && (
          <Link href="/" className="animate-fade-in">
            <span className="text-sm font-medium tracking-tight text-foreground">ARC</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-calm"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path || pathname?.startsWith(item.path + "/");
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-calm group",
                  collapsed && "justify-center px-2",
                  isActive 
                    ? "bg-secondary text-foreground" 
                    : "text-sidebar-foreground hover:text-foreground hover:bg-secondary/40"
                )}
              >
                <item.icon className={cn(
                  "h-4 w-4 flex-shrink-0 transition-calm",
                  isActive ? "text-accent" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {!collapsed && (
                  <span className="text-sm font-medium animate-fade-in">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-sidebar-border animate-fade-in">
          <p className="text-xs text-muted-foreground/50 leading-relaxed">
            Disciplined process.
          </p>
        </div>
      )}
    </aside>
  );
}
