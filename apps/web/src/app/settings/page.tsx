'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Save, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Screen 5: Settings
 * 
 * System configuration with:
 * - Locked parameters (read-only)
 * - Configurable parameters
 * - Manual trigger buttons
 */

interface SystemConfig {
  // Locked parameters (from Operating Parameters)
  locked: {
    timezone: string;
    lane_a_schedule: string;
    lane_b_schedule: string;
    ic_bundle_schedule: string;
    lane_a_daily_limit: number;
    lane_b_daily_target: number;
    lane_b_daily_max: number;
    lane_b_weekly_cap: number;
    novelty_new_threshold_days: number;
    novelty_penalty_window_days: number;
  };
  // Configurable parameters
  configurable: {
    llm_provider: string;
    llm_model: string;
    data_sources: string[];
    notification_email: string;
    dry_run_mode: boolean;
  };
}

// Mock config
const MOCK_CONFIG: SystemConfig = {
  locked: {
    timezone: 'America/Sao_Paulo',
    lane_a_schedule: '0 6 * * 1-5',
    lane_b_schedule: '0 8 * * 1-5',
    ic_bundle_schedule: '0 8 * * 5',
    lane_a_daily_limit: 120,
    lane_b_daily_target: 3,
    lane_b_daily_max: 4,
    lane_b_weekly_cap: 10,
    novelty_new_threshold_days: 90,
    novelty_penalty_window_days: 30,
  },
  configurable: {
    llm_provider: 'openai',
    llm_model: 'gpt-4-turbo',
    data_sources: ['fmp', 'polygon', 'sec_edgar'],
    notification_email: 'analyst@example.com',
    dry_run_mode: false,
  },
};

export default function SettingsPage() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const { isLoading } = useQuery({
    queryKey: ['system-config'],
    queryFn: async () => {
      // TODO: Replace with actual API call
      setConfig(MOCK_CONFIG);
      return MOCK_CONFIG;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newConfig: SystemConfig['configurable']) => {
      // TODO: Replace with actual API call
      console.log('Saving config:', newConfig);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true };
    },
    onSuccess: () => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    },
    onError: () => {
      setSaveStatus('error');
    },
  });

  const triggerMutation = useMutation({
    mutationFn: async (dagName: string) => {
      // TODO: Replace with actual API call
      console.log('Triggering DAG:', dagName);
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { success: true };
    },
  });

  const handleSave = () => {
    if (config) {
      setSaveStatus('saving');
      saveMutation.mutate(config.configurable);
    }
  };

  if (isLoading || !config) {
    return <div className="text-center py-12 text-gray-600">Loading settings...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">System configuration</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className={cn(
            'flex items-center space-x-2 px-4 py-2 rounded-md text-white',
            saveMutation.isPending ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          )}
        >
          {saveStatus === 'saving' ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : saveStatus === 'saved' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>{saveStatus === 'saved' ? 'Saved!' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Locked Parameters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900">Locked Parameters</h2>
          <span className="text-sm text-gray-500">(Read-only)</span>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          These parameters are defined in the Operating Parameters and cannot be changed.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <input
              type="text"
              value={config.locked.timezone}
              disabled
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-gray-600"
            />
          </div>

          {/* Lane A Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lane A Schedule</label>
            <input
              type="text"
              value={`${config.locked.lane_a_schedule} (06:00 Mon-Fri)`}
              disabled
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-gray-600"
            />
          </div>

          {/* Lane B Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lane B Schedule</label>
            <input
              type="text"
              value={`${config.locked.lane_b_schedule} (08:00 Mon-Fri)`}
              disabled
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-gray-600"
            />
          </div>

          {/* IC Bundle Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IC Bundle Schedule</label>
            <input
              type="text"
              value={`${config.locked.ic_bundle_schedule} (08:00 Fridays)`}
              disabled
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-gray-600"
            />
          </div>

          {/* Lane A Daily Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lane A Daily Limit</label>
            <input
              type="number"
              value={config.locked.lane_a_daily_limit}
              disabled
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-gray-600"
            />
          </div>

          {/* Lane B Weekly Cap */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lane B Weekly Cap</label>
            <input
              type="number"
              value={config.locked.lane_b_weekly_cap}
              disabled
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-gray-600"
            />
          </div>

          {/* Novelty New Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Novelty New Threshold (days)</label>
            <input
              type="number"
              value={config.locked.novelty_new_threshold_days}
              disabled
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-gray-600"
            />
          </div>

          {/* Novelty Penalty Window */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Novelty Penalty Window (days)</label>
            <input
              type="number"
              value={config.locked.novelty_penalty_window_days}
              disabled
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-gray-600"
            />
          </div>
        </div>
      </div>

      {/* Configurable Parameters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Configurable Parameters</h2>

        <div className="grid grid-cols-2 gap-4">
          {/* LLM Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LLM Provider</label>
            <select
              value={config.configurable.llm_provider}
              onChange={(e) =>
                setConfig({
                  ...config,
                  configurable: { ...config.configurable, llm_provider: e.target.value },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>

          {/* LLM Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LLM Model</label>
            <select
              value={config.configurable.llm_model}
              onChange={(e) =>
                setConfig({
                  ...config,
                  configurable: { ...config.configurable, llm_model: e.target.value },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="claude-3-opus">Claude 3 Opus</option>
              <option value="claude-3-sonnet">Claude 3 Sonnet</option>
            </select>
          </div>

          {/* Notification Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notification Email</label>
            <input
              type="email"
              value={config.configurable.notification_email}
              onChange={(e) =>
                setConfig({
                  ...config,
                  configurable: { ...config.configurable, notification_email: e.target.value },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {/* Dry Run Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dry Run Mode</label>
            <div className="flex items-center space-x-2 mt-2">
              <input
                type="checkbox"
                checked={config.configurable.dry_run_mode}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    configurable: { ...config.configurable, dry_run_mode: e.target.checked },
                  })
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-600">Enable dry run (no actual changes)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Triggers */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Manual Triggers</h2>
        <p className="text-sm text-gray-600 mb-4">
          Manually trigger DAG runs outside of scheduled times.
        </p>

        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => triggerMutation.mutate('daily_discovery')}
            disabled={triggerMutation.isPending}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            <RefreshCw className={cn('h-4 w-4', triggerMutation.isPending && 'animate-spin')} />
            <span>Run Lane A (Discovery)</span>
          </button>

          <button
            onClick={() => triggerMutation.mutate('daily_lane_b')}
            disabled={triggerMutation.isPending}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
          >
            <RefreshCw className={cn('h-4 w-4', triggerMutation.isPending && 'animate-spin')} />
            <span>Run Lane B (Research)</span>
          </button>

          <button
            onClick={() => triggerMutation.mutate('weekly_ic_bundle')}
            disabled={triggerMutation.isPending}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400"
          >
            <RefreshCw className={cn('h-4 w-4', triggerMutation.isPending && 'animate-spin')} />
            <span>Run IC Bundle</span>
          </button>
        </div>
      </div>
    </div>
  );
}
