"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Filter, ChevronDown, ChevronRight, Cpu, DollarSign, Zap, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Prompt {
  id: string;
  name: string;
  description: string;
  lane: string;
  stage: string;
  category: string;
  provider: string;
  model: string;
  expected_value_score: number;
  expected_cost_score: number;
  value_cost_ratio: number;
  status_institucional: string;
  dependency_type: string;
  template_version: string;
  variables: string[];
}

interface Stats {
  total: number;
  filtered: number;
  by_lane: Record<string, number>;
  by_status: Record<string, number>;
  by_provider: Record<string, number>;
  avg_value_score: number;
  avg_cost_score: number;
}

type SortField = 'id' | 'lane' | 'expected_value_score' | 'value_cost_ratio' | 'status_institucional';
type SortOrder = 'asc' | 'desc';

const laneColors: Record<string, string> = {
  lane_a: 'bg-blue-500/10 text-blue-400',
  lane_b: 'bg-purple-500/10 text-purple-400',
  portfolio: 'bg-emerald-500/10 text-emerald-400',
  monitoring: 'bg-amber-500/10 text-amber-400',
  utility: 'bg-gray-500/10 text-gray-400',
};

const statusColors: Record<string, string> = {
  core: 'bg-emerald-500/10 text-emerald-400',
  supporting: 'bg-blue-500/10 text-blue-400',
  optional: 'bg-gray-500/10 text-gray-400',
  experimental: 'bg-amber-500/10 text-amber-400',
  deprecated: 'bg-red-500/10 text-red-400',
};

const providerIcons: Record<string, string> = {
  openai: '🤖',
  google: '🔮',
  anthropic: '🧠',
  code: '⚙️',
};

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [laneFilter, setLaneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const params = new URLSearchParams();
        if (laneFilter !== 'all') params.set('lane', laneFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (providerFilter !== 'all') params.set('provider', providerFilter);
        if (search) params.set('search', search);
        
        const res = await fetch(`/api/prompts?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setPrompts(data.prompts || []);
          setStats(data.stats || null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPrompts();
  }, [laneFilter, statusFilter, providerFilter, search]);

  // Sort prompts
  const sortedPrompts = [...prompts].sort((a, b) => {
    let aVal: string | number = a[sortField];
    let bVal: string | number = b[sortField];
    
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border">
          <div className="px-8 py-6">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-medium text-foreground tracking-tight">
                Prompt Manager
              </h1>
              <span className="text-sm text-muted-foreground">
                {stats?.total || 0} prompts
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Master catalog of all prompts in the ARC Investment Factory
            </p>
          </div>

          {/* Stats bar */}
          {stats && (
            <div className="px-8 pb-4 flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span className="text-muted-foreground">Avg Value:</span>
                <span className="font-medium text-foreground">{stats.avg_value_score.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span className="text-muted-foreground">Avg Cost:</span>
                <span className="font-medium text-foreground">{stats.avg_cost_score.toFixed(2)}</span>
              </div>
              {Object.entries(stats.by_lane).map(([lane, count]) => (
                <div key={lane} className="flex items-center gap-1.5 text-sm">
                  <span className={cn("px-2 py-0.5 rounded text-xs", laneColors[lane])}>
                    {lane.replace('_', ' ')}
                  </span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="px-8 pb-4 flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search prompts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-secondary/50 border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent w-64"
              />
            </div>

            {/* Lane filter */}
            <select
              value={laneFilter}
              onChange={(e) => setLaneFilter(e.target.value)}
              className="px-3 py-2 bg-secondary/50 border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">All Lanes</option>
              <option value="lane_a">Lane A</option>
              <option value="lane_b">Lane B</option>
              <option value="portfolio">Portfolio</option>
              <option value="monitoring">Monitoring</option>
              <option value="utility">Utility</option>
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-secondary/50 border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">All Status</option>
              <option value="core">Core</option>
              <option value="supporting">Supporting</option>
              <option value="optional">Optional</option>
              <option value="experimental">Experimental</option>
              <option value="deprecated">Deprecated</option>
            </select>

            {/* Provider filter */}
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-3 py-2 bg-secondary/50 border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">All Providers</option>
              <option value="openai">OpenAI</option>
              <option value="google">Google</option>
              <option value="anthropic">Anthropic</option>
              <option value="code">Code</option>
            </select>

            <span className="text-sm text-muted-foreground ml-auto">
              Showing {sortedPrompts.length} of {stats?.total || 0}
            </span>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 py-6">
          <div className="px-8">
            {loading ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground animate-pulse-calm">Loading prompts...</p>
              </div>
            ) : sortedPrompts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">No prompts found.</p>
              </div>
            ) : (
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-secondary/30 border-b border-border text-sm font-medium text-muted-foreground">
                  <button 
                    className="col-span-3 flex items-center gap-1 hover:text-foreground text-left"
                    onClick={() => handleSort('id')}
                  >
                    Prompt ID
                    {sortField === 'id' && (
                      <ChevronDown className={cn("w-4 h-4", sortOrder === 'desc' && "rotate-180")} />
                    )}
                  </button>
                  <button 
                    className="col-span-1 flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort('lane')}
                  >
                    Lane
                    {sortField === 'lane' && (
                      <ChevronDown className={cn("w-4 h-4", sortOrder === 'desc' && "rotate-180")} />
                    )}
                  </button>
                  <div className="col-span-2">Stage</div>
                  <div className="col-span-1">Provider</div>
                  <button 
                    className="col-span-1 flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort('expected_value_score')}
                  >
                    Value
                    {sortField === 'expected_value_score' && (
                      <ChevronDown className={cn("w-4 h-4", sortOrder === 'desc' && "rotate-180")} />
                    )}
                  </button>
                  <button 
                    className="col-span-1 flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort('value_cost_ratio')}
                  >
                    V/C
                    {sortField === 'value_cost_ratio' && (
                      <ChevronDown className={cn("w-4 h-4", sortOrder === 'desc' && "rotate-180")} />
                    )}
                  </button>
                  <button 
                    className="col-span-2 flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort('status_institucional')}
                  >
                    Status
                    {sortField === 'status_institucional' && (
                      <ChevronDown className={cn("w-4 h-4", sortOrder === 'desc' && "rotate-180")} />
                    )}
                  </button>
                  <div className="col-span-1"></div>
                </div>

                {/* Table rows */}
                <div className="divide-y divide-border/50">
                  {sortedPrompts.map((prompt, index) => (
                    <PromptRow
                      key={prompt.id}
                      prompt={prompt}
                      index={index}
                      expanded={expandedId === prompt.id}
                      onToggle={() => setExpandedId(expandedId === prompt.id ? null : prompt.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}

interface PromptRowProps {
  prompt: Prompt;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}

function PromptRow({ prompt, index, expanded, onToggle }: PromptRowProps) {
  return (
    <div className={cn("transition-colors", expanded && "bg-secondary/20")}>
      {/* Main row */}
      <div 
        className="grid grid-cols-12 gap-4 px-4 py-3 text-sm cursor-pointer hover:bg-secondary/10"
        onClick={onToggle}
      >
        <div className="col-span-3 font-mono text-foreground truncate" title={prompt.id}>
          {prompt.id}
        </div>
        <div className="col-span-1">
          <span className={cn("px-2 py-0.5 rounded text-xs", laneColors[prompt.lane])}>
            {prompt.lane.replace('lane_', '').toUpperCase()}
          </span>
        </div>
        <div className="col-span-2 text-muted-foreground truncate" title={prompt.stage}>
          {prompt.stage}
        </div>
        <div className="col-span-1">
          <span title={prompt.provider}>
            {providerIcons[prompt.provider] || '❓'} {prompt.provider.slice(0, 3)}
          </span>
        </div>
        <div className="col-span-1">
          <span className={cn(
            "font-medium",
            prompt.expected_value_score >= 0.8 ? "text-emerald-400" :
            prompt.expected_value_score >= 0.6 ? "text-amber-400" : "text-muted-foreground"
          )}>
            {prompt.expected_value_score.toFixed(2)}
          </span>
        </div>
        <div className="col-span-1">
          <span className={cn(
            "font-medium",
            prompt.value_cost_ratio >= 2.0 ? "text-emerald-400" :
            prompt.value_cost_ratio >= 1.5 ? "text-amber-400" : "text-muted-foreground"
          )}>
            {prompt.value_cost_ratio.toFixed(2)}
          </span>
        </div>
        <div className="col-span-2">
          <span className={cn("px-2 py-0.5 rounded text-xs capitalize", statusColors[prompt.status_institucional])}>
            {prompt.status_institucional}
          </span>
        </div>
        <div className="col-span-1 flex justify-end">
          <ChevronRight className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            expanded && "rotate-90"
          )} />
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 animate-fade-in">
          <div className="ml-4 p-4 bg-secondary/30 rounded-lg space-y-4">
            {/* Description */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-sm text-foreground">{prompt.description}</p>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Category</p>
                <p className="text-sm text-foreground">{prompt.category}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Model</p>
                <p className="text-sm text-foreground font-mono">{prompt.model}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Expected Cost</p>
                <p className="text-sm text-foreground">{prompt.expected_cost_score.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Dependency Type</p>
                <p className="text-sm text-foreground">{prompt.dependency_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Version</p>
                <p className="text-sm text-foreground">{prompt.template_version}</p>
              </div>
            </div>

            {/* Variables */}
            {prompt.variables && prompt.variables.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {prompt.variables.map((v) => (
                    <span key={v} className="text-xs px-2 py-0.5 bg-secondary rounded font-mono">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
