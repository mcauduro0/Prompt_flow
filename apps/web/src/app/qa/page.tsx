'use client';

import { useState, useEffect } from 'react';

/**
 * QA Report Page - Governance Contract UI
 * 
 * Displays weekly QA reports per governance spec:
 * - 7 sections (A-G) with pass/warn/fail status
 * - 5 drift alarms
 * - Overall score 0-100
 * - Week-over-week diff view
 * - Last 8 reports
 * - JSON download
 */

// ============================================================================
// TYPES (matching governance schema)
// ============================================================================

type QAStatus = 'pass' | 'warn' | 'fail';

interface QACheck {
  id: string;
  description: string;
  status: QAStatus;
  value: number | string | Record<string, unknown>;
  expected: string;
  evidence?: {
    query_ids?: string[];
    counts?: Record<string, number>;
    sample_ids?: string[];
  };
}

interface QASection {
  name: string;
  status: QAStatus;
  score_0_100: number;
  checks: QACheck[];
}

interface DriftAlarm {
  id: string;
  severity: 'warn' | 'fail';
  triggered: boolean;
  message: string;
  remediation: string;
  related_check_ids: string[];
}

interface KeyMetrics {
  discovery_runs: number;
  lane_b_runs: number;
  weekend_runs: number;
  ideas_generated: number;
  ideas_promoted: number;
  packets_completed: number;
  novelty_rate_top30: number;
  gate_pass_rate: number;
  evidence_grounding_rate: number;
  universe_coverage_rate: number;
  non_us_share: number;
  error_rate: number;
}

interface QAReport {
  report_id: string;
  as_of: string;
  window_start: string;
  window_end: string;
  timezone: string;
  overall_status: QAStatus;
  overall_score_0_100: number;
  sections: QASection[];
  drift_alarms: DriftAlarm[];
  key_metrics: KeyMetrics;
  links: {
    json_artifact?: string;
    ui_page?: string;
    previous_report?: string;
  };
}

// ============================================================================
// MOCK DATA (for demonstration)
// ============================================================================

const mockReport: QAReport = {
  report_id: 'qa-2026-01-10',
  as_of: '2026-01-10T18:00:00-03:00',
  window_start: '2026-01-03',
  window_end: '2026-01-10',
  timezone: 'America/Sao_Paulo',
  overall_status: 'pass',
  overall_score_0_100: 92,
  sections: [
    {
      name: 'A: System Health and Cadence',
      status: 'pass',
      score_0_100: 100,
      checks: [
        { id: 'A1', description: 'Scheduler cadence', status: 'pass', value: { discovery: 5, lane_b: 5 }, expected: 'discovery=5, lane_b=5' },
        { id: 'A2', description: 'Weekend suppression', status: 'pass', value: 0, expected: '0' },
        { id: 'A3', description: 'Caps and concurrency', status: 'pass', value: { low_days: 0, packets_this_week: 8 }, expected: 'lane_a: 100-200/day, lane_b: ≤10/week' },
        { id: 'A4', description: 'Error rate', status: 'pass', value: '2.1%', expected: '<5%' },
      ],
    },
    {
      name: 'B: Novelty-First Behavior',
      status: 'pass',
      score_0_100: 100,
      checks: [
        { id: 'B1', description: 'Top 30 novelty rate', status: 'pass', value: '14.2', expected: '≥12/30' },
        { id: 'B2', description: 'Repetition violations', status: 'pass', value: 0, expected: '0' },
        { id: 'B3', description: 'Reappearance delta quality', status: 'pass', value: '85.0%', expected: '≥80%' },
      ],
    },
    {
      name: 'C: Gates and Promotion Discipline',
      status: 'pass',
      score_0_100: 100,
      checks: [
        { id: 'C1', description: 'Gate completeness', status: 'pass', value: '100.0%', expected: '100%' },
        { id: 'C2', description: 'Promotion gate integrity', status: 'pass', value: '100.0%', expected: '100%' },
        { id: 'C3', description: 'Downside gate integrity', status: 'pass', value: '100.0%', expected: '100%' },
        { id: 'C4', description: 'Style fit integrity', status: 'pass', value: '100.0%', expected: '100%' },
      ],
    },
    {
      name: 'D: Deep Packet Completeness',
      status: 'warn',
      score_0_100: 70,
      checks: [
        { id: 'D1', description: 'Completed packets count', status: 'pass', value: 8, expected: '≤10' },
        { id: 'D2', description: 'Mandatory fields present', status: 'pass', value: '100.0%', expected: '100%' },
        { id: 'D3', description: 'Evidence grounding rate', status: 'warn', value: '87.5%', expected: '≥90%' },
        { id: 'D4', description: 'Open questions quality', status: 'pass', value: '92.0%', expected: '≥80%' },
      ],
    },
    {
      name: 'E: Memory and Versioning',
      status: 'pass',
      score_0_100: 100,
      checks: [
        { id: 'E1', description: 'Immutable thesis versioning', status: 'pass', value: '100.0%', expected: '100%' },
        { id: 'E2', description: 'Rejection shadow enforcement', status: 'pass', value: '88.0%', expected: '≥80%' },
      ],
    },
    {
      name: 'F: Global Universe Coverage',
      status: 'pass',
      score_0_100: 100,
      checks: [
        { id: 'F1', description: 'Universe coverage rate', status: 'pass', value: '92.0%', expected: '≥90%' },
        { id: 'F2', description: 'Non-US share in inbox', status: 'pass', value: '35.0%', expected: '≥30%' },
        { id: 'F3', description: 'Non-US retrieval success', status: 'pass', value: '85.0%', expected: '≥80%' },
      ],
    },
    {
      name: 'G: Operator Usability',
      status: 'pass',
      score_0_100: 100,
      checks: [
        { id: 'G1', description: 'UI workflow integrity', status: 'pass', value: { can_promote: true, has_packets: true }, expected: 'all true' },
      ],
    },
  ],
  drift_alarms: [
    { id: 'novelty_collapse', severity: 'fail', triggered: false, message: 'Novelty collapse not triggered', remediation: 'Review novelty-first shortlist logic', related_check_ids: ['B1'] },
    { id: 'promotion_gate_breach', severity: 'fail', triggered: false, message: 'No promotion gate breaches', remediation: 'Review gate enforcement', related_check_ids: ['C2'] },
    { id: 'weekly_packet_cap_breach', severity: 'fail', triggered: false, message: 'Weekly cap respected', remediation: 'Review Lane B cap enforcement', related_check_ids: ['D1'] },
    { id: 'evidence_grounding_collapse', severity: 'fail', triggered: false, message: 'Evidence grounding above threshold', remediation: 'Review evidence locator validation', related_check_ids: ['D3'] },
    { id: 'global_coverage_collapse', severity: 'warn', triggered: false, message: 'Global coverage above threshold', remediation: 'Review security master', related_check_ids: ['F1'] },
  ],
  key_metrics: {
    discovery_runs: 5,
    lane_b_runs: 5,
    weekend_runs: 0,
    ideas_generated: 600,
    ideas_promoted: 15,
    packets_completed: 8,
    novelty_rate_top30: 0.47,
    gate_pass_rate: 0.75,
    evidence_grounding_rate: 0.875,
    universe_coverage_rate: 0.92,
    non_us_share: 0.35,
    error_rate: 0.021,
  },
  links: {
    json_artifact: 'qa_reports/2026-01-10.json',
    ui_page: '/qa',
  },
};

// Previous week mock for diff view
const mockPreviousReport: QAReport = {
  ...mockReport,
  report_id: 'qa-2026-01-03',
  as_of: '2026-01-03T18:00:00-03:00',
  window_start: '2025-12-27',
  window_end: '2026-01-03',
  overall_score_0_100: 88,
  key_metrics: {
    ...mockReport.key_metrics,
    ideas_generated: 550,
    ideas_promoted: 12,
    packets_completed: 7,
    novelty_rate_top30: 0.42,
    evidence_grounding_rate: 0.82,
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function QAReportPage() {
  const [reports, setReports] = useState<QAReport[]>([mockReport, mockPreviousReport]);
  const [selectedReport, setSelectedReport] = useState<QAReport>(mockReport);
  const [showDiff, setShowDiff] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Status colors
  const statusColors = {
    pass: 'bg-green-100 text-green-800 border-green-200',
    warn: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    fail: 'bg-red-100 text-red-800 border-red-200',
  };

  const statusBadgeColors = {
    pass: 'bg-green-500',
    warn: 'bg-yellow-500',
    fail: 'bg-red-500',
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  const toggleSection = (name: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedSections(newExpanded);
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(selectedReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qa_report_${selectedReport.window_end}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getPreviousReport = (): QAReport | undefined => {
    const currentIndex = reports.findIndex(r => r.report_id === selectedReport.report_id);
    return currentIndex < reports.length - 1 ? reports[currentIndex + 1] : undefined;
  };

  const renderDiff = (current: number, previous: number | undefined, format: 'number' | 'percent' = 'number') => {
    if (previous === undefined) return null;
    const diff = current - previous;
    const color = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-500';
    const sign = diff > 0 ? '+' : '';
    const value = format === 'percent' ? `${sign}${(diff * 100).toFixed(1)}%` : `${sign}${diff}`;
    return <span className={`text-xs ml-1 ${color}`}>({value})</span>;
  };

  // Limit to last 8 reports
  const displayReports = reports.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Weekly QA Report</h1>
          <p className="text-gray-600">
            Governance Contract - System health and compliance monitoring
          </p>
        </div>
        <div className="flex gap-2">
          <select
            className="border rounded-lg px-3 py-2"
            value={selectedReport.report_id}
            onChange={(e) => {
              const report = reports.find(r => r.report_id === e.target.value);
              if (report) setSelectedReport(report);
            }}
          >
            {displayReports.map(report => (
              <option key={report.report_id} value={report.report_id}>
                Week of {formatDate(report.window_end)}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowDiff(!showDiff)}
            className={`px-4 py-2 rounded-lg border ${showDiff ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}
          >
            {showDiff ? 'Hide Diff' : 'Show Diff'}
          </button>
          <button
            onClick={downloadJSON}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Download JSON
          </button>
        </div>
      </div>

      {/* Overall Status Card */}
      <div className={`border rounded-lg p-6 ${statusColors[selectedReport.overall_status]}`}>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold">
              Overall Status: {selectedReport.overall_status.toUpperCase()}
            </h2>
            <p className="text-sm mt-1">
              Period: {formatDate(selectedReport.window_start)} - {formatDate(selectedReport.window_end)}
            </p>
            <p className="text-sm">
              Generated: {new Date(selectedReport.as_of).toLocaleString('pt-BR')} ({selectedReport.timezone})
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">{selectedReport.overall_score_0_100}</div>
            <div className="text-sm">Score / 100</div>
            {showDiff && getPreviousReport() && renderDiff(
              selectedReport.overall_score_0_100,
              getPreviousReport()?.overall_score_0_100
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Key Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: 'Discovery Runs', value: selectedReport.key_metrics.discovery_runs, prev: getPreviousReport()?.key_metrics.discovery_runs },
            { label: 'Lane B Runs', value: selectedReport.key_metrics.lane_b_runs, prev: getPreviousReport()?.key_metrics.lane_b_runs },
            { label: 'Ideas Generated', value: selectedReport.key_metrics.ideas_generated, prev: getPreviousReport()?.key_metrics.ideas_generated },
            { label: 'Ideas Promoted', value: selectedReport.key_metrics.ideas_promoted, prev: getPreviousReport()?.key_metrics.ideas_promoted },
            { label: 'Packets Completed', value: selectedReport.key_metrics.packets_completed, prev: getPreviousReport()?.key_metrics.packets_completed },
            { label: 'Novelty Rate (Top 30)', value: formatPercent(selectedReport.key_metrics.novelty_rate_top30), prev: getPreviousReport()?.key_metrics.novelty_rate_top30, format: 'percent' as const },
            { label: 'Gate Pass Rate', value: formatPercent(selectedReport.key_metrics.gate_pass_rate), prev: getPreviousReport()?.key_metrics.gate_pass_rate, format: 'percent' as const },
            { label: 'Evidence Grounding', value: formatPercent(selectedReport.key_metrics.evidence_grounding_rate), prev: getPreviousReport()?.key_metrics.evidence_grounding_rate, format: 'percent' as const },
            { label: 'Universe Coverage', value: formatPercent(selectedReport.key_metrics.universe_coverage_rate), prev: getPreviousReport()?.key_metrics.universe_coverage_rate, format: 'percent' as const },
            { label: 'Non-US Share', value: formatPercent(selectedReport.key_metrics.non_us_share), prev: getPreviousReport()?.key_metrics.non_us_share, format: 'percent' as const },
            { label: 'Error Rate', value: formatPercent(selectedReport.key_metrics.error_rate), prev: getPreviousReport()?.key_metrics.error_rate, format: 'percent' as const },
            { label: 'Weekend Runs', value: selectedReport.key_metrics.weekend_runs, prev: getPreviousReport()?.key_metrics.weekend_runs },
          ].map(metric => (
            <div key={metric.label} className="bg-gray-50 rounded-lg p-3">
              <div className="text-xl font-bold">
                {typeof metric.value === 'string' ? metric.value : metric.value}
                {showDiff && metric.prev !== undefined && (
                  metric.format === 'percent' 
                    ? renderDiff(parseFloat(String(metric.value).replace('%', '')) / 100, metric.prev as number, 'percent')
                    : renderDiff(metric.value as number, metric.prev as number)
                )}
              </div>
              <div className="text-xs text-gray-600">{metric.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Drift Alarms */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Drift Alarms</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {selectedReport.drift_alarms.map(alarm => (
            <div
              key={alarm.id}
              className={`p-3 rounded-lg border ${
                alarm.triggered
                  ? alarm.severity === 'fail'
                    ? 'bg-red-50 border-red-300'
                    : 'bg-yellow-50 border-yellow-300'
                  : 'bg-green-50 border-green-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  alarm.triggered
                    ? alarm.severity === 'fail' ? 'bg-red-500' : 'bg-yellow-500'
                    : 'bg-green-500'
                }`} />
                <span className="font-medium text-sm">{alarm.id.replace(/_/g, ' ')}</span>
              </div>
              <div className="text-xs mt-1 text-gray-600">
                {alarm.triggered ? alarm.message : 'Not triggered'}
              </div>
              {alarm.triggered && (
                <div className="text-xs mt-1 text-gray-500">
                  Fix: {alarm.remediation}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sections (A-G) */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Sections</h2>
        {selectedReport.sections.map(section => (
          <div key={section.name} className="bg-white border rounded-lg overflow-hidden">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(section.name)}
              className={`w-full p-4 flex justify-between items-center ${statusColors[section.status]} hover:opacity-90`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${statusBadgeColors[section.status]}`} />
                <span className="font-semibold">{section.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm">Score: {section.score_0_100}/100</span>
                <span className="text-sm font-medium">{section.status.toUpperCase()}</span>
                <span>{expandedSections.has(section.name) ? '▼' : '▶'}</span>
              </div>
            </button>

            {/* Section Checks */}
            {expandedSections.has(section.name) && (
              <div className="p-4 border-t">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-600">
                      <th className="pb-2">Check</th>
                      <th className="pb-2">Description</th>
                      <th className="pb-2">Value</th>
                      <th className="pb-2">Expected</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.checks.map(check => (
                      <tr key={check.id} className="border-t">
                        <td className="py-2 font-mono text-sm">{check.id}</td>
                        <td className="py-2 text-sm">{check.description}</td>
                        <td className="py-2 text-sm font-medium">
                          {typeof check.value === 'object' 
                            ? JSON.stringify(check.value) 
                            : String(check.value)}
                        </td>
                        <td className="py-2 text-sm text-gray-600">{check.expected}</td>
                        <td className="py-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            check.status === 'pass' ? 'bg-green-100 text-green-800' :
                            check.status === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {check.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Section Weights Reference */}
      <div className="bg-gray-50 border rounded-lg p-4">
        <h3 className="font-semibold mb-2">Section Weights (for Overall Score)</h3>
        <div className="grid grid-cols-7 gap-2 text-sm">
          <div className="text-center">
            <div className="font-bold">A</div>
            <div className="text-gray-600">15%</div>
          </div>
          <div className="text-center">
            <div className="font-bold">B</div>
            <div className="text-gray-600">20%</div>
          </div>
          <div className="text-center">
            <div className="font-bold">C</div>
            <div className="text-gray-600">15%</div>
          </div>
          <div className="text-center">
            <div className="font-bold">D</div>
            <div className="text-gray-600">25%</div>
          </div>
          <div className="text-center">
            <div className="font-bold">E</div>
            <div className="text-gray-600">10%</div>
          </div>
          <div className="text-center">
            <div className="font-bold">F</div>
            <div className="text-gray-600">10%</div>
          </div>
          <div className="text-center">
            <div className="font-bold">G</div>
            <div className="text-gray-600">5%</div>
          </div>
        </div>
      </div>

      {/* Report History */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Report History (Last 8)</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-600 border-b">
                <th className="pb-2">Week Ending</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Score</th>
                <th className="pb-2">Ideas</th>
                <th className="pb-2">Promoted</th>
                <th className="pb-2">Packets</th>
                <th className="pb-2">Alarms</th>
              </tr>
            </thead>
            <tbody>
              {displayReports.map(report => (
                <tr 
                  key={report.report_id} 
                  className={`border-b cursor-pointer hover:bg-gray-50 ${
                    report.report_id === selectedReport.report_id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedReport(report)}
                >
                  <td className="py-2">{formatDate(report.window_end)}</td>
                  <td className="py-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      report.overall_status === 'pass' ? 'bg-green-100 text-green-800' :
                      report.overall_status === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {report.overall_status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2 font-medium">{report.overall_score_0_100}</td>
                  <td className="py-2">{report.key_metrics.ideas_generated}</td>
                  <td className="py-2">{report.key_metrics.ideas_promoted}</td>
                  <td className="py-2">{report.key_metrics.packets_completed}</td>
                  <td className="py-2">
                    {report.drift_alarms.filter(a => a.triggered).length > 0 ? (
                      <span className="text-red-600 font-medium">
                        {report.drift_alarms.filter(a => a.triggered).length}
                      </span>
                    ) : (
                      <span className="text-green-600">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
