"use client";

import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "../ThemeToggle";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
