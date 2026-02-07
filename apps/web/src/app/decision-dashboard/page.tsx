"use client";
import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  BarChart3,
  Brain,
  FileText,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DecisionDashboard } from "@/components/decision/DecisionDashboard";
import { LearningLoopInsights } from "@/components/decision/LearningLoopInsights";

type Tab = 'dashboard' | 'insights';

export default function DecisionDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="w-6 h-6" />
              Decision Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Analyze, rank, and compare investment opportunities with structured data
            </p>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="border-b">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "flex items-center gap-2 px-4 py-3 border-b-2 transition-colors",
                activeTab === 'dashboard' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Target className="w-4 h-4" />
              Investment Ranking
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={cn(
                "flex items-center gap-2 px-4 py-3 border-b-2 transition-colors",
                activeTab === 'insights' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <BarChart3 className="w-4 h-4" />
              Learning Loop Insights
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' && <DecisionDashboard />}
        {activeTab === 'insights' && <LearningLoopInsights />}
      </div>
    </AppLayout>
  );
}
