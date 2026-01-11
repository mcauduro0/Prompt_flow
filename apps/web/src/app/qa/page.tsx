'use client';

import { useState, useEffect } from 'react';

/**
 * QA Report Page
 * 
 * Displays weekly QA reports with all metrics:
 * - Gate pass/fail distribution
 * - Novelty distribution
 * - Style mix vs target
 * - Evidence coverage
 * - Compliance checks
 * - Alerts and recommendations
 */

interface QAReport {
  report_id: string;
  generated_at: string;
  period_start: string;
  period_end: string;
  timezone: string;
  summary: {
    overall_health: 'healthy' | 'warning' | 'critical';
    total_ideas_generated: number;
    total_ideas_promoted: number;
    total_packets_completed: number;
    alerts: string[];
  };
  gate_analysis: {
    total_evaluated: number;
    pass_rate: number;
    by_gate: Record<string, { evaluated: number; passed: number; failed: number; pass_rate: number }>;
    binary_override_count: number;
    binary_override_breakdown: {
      leverage_risk: number;
      liquidity_risk: number;
      regulatory_cliff: number;
    };
  };
  novelty_analysis: {
    total_shortlisted: number;
    new_count: number;
    new_pct: number;
    reappearance_count: number;
    reappearance_pct: number;
    repeat_count: number;
    repeat_pct: number;
    exploration_count: number;
    exploration_pct: number;
  };
  style_mix_analysis: {
    actual: Record<string, number>;
    target: Record<string, number>;
    deviation: Record<string, number>;
    max_deviation: number;
    style_mix_healthy: boolean;
  };
  evidence_analysis: {
    total_evidence_refs: number;
    with_doc_id: number;
    with_chunk_id: number;
    coverage_pct: number;
    avg_evidence_per_idea: number;
  };
  compliance_checks: {
    novelty_first_enforced: boolean;
    gates_enforced: boolean;
    binary_overrides_active: boolean;
    weekly_cap_respected: boolean;
    timezone_correct: boolean;
    all_passed: boolean;
    failures: string[];
  };
  recommendations: string[];
}

// Mock data for demonstration
const mockReport: QAReport = {
  report_id: 'qa-2026-01-10',
  generated_at: '2026-01-10T17:00:00-03:00',
  period_start: '2026-01-03T00:00:00-03:00',
  period_end: '2026-01-10T00:00:00-03:00',
  timezone: 'America/Sao_Paulo',
  summary: {
    overall_health: 'healthy',
    total_ideas_generated: 600,
    total_ideas_promoted: 15,
    total_packets_completed: 10,
    alerts: [],
  },
  gate_analysis: {
    total_evaluated: 600,
    pass_rate: 0.75,
    by_gate: {
      gate_0_data_sufficiency: { evaluated: 600, passed: 570, failed: 30, pass_rate: 0.95 },
      gate_1_coherence: { evaluated: 570, passed: 540, failed: 30, pass_rate: 0.95 },
      gate_2_edge_claim: { evaluated: 540, passed: 500, failed: 40, pass_rate: 0.93 },
      gate_3_downside_sanity: { evaluated: 500, passed: 460, failed: 40, pass_rate: 0.92 },
      gate_4_style_fit: { evaluated: 460, passed: 450, failed: 10, pass_rate: 0.98 },
    },
    binary_override_count: 8,
    binary_override_breakdown: {
      leverage_risk: 4,
      liquidity_risk: 3,
      regulatory_cliff: 1,
    },
  },
  novelty_analysis: {
    total_shortlisted: 1000,
    new_count: 400,
    new_pct: 40,
    reappearance_count: 300,
    reappearance_pct: 30,
    repeat_count: 200,
    repeat_pct: 20,
    exploration_count: 100,
    exploration_pct: 10,
  },
  style_mix_analysis: {
    actual: { quality: 0.28, value: 0.22, growth: 0.25, special_situations: 0.15, turnaround: 0.10 },
    target: { quality: 0.30, value: 0.25, growth: 0.20, special_situations: 0.15, turnaround: 0.10 },
    deviation: { quality: 0.02, value: 0.03, growth: 0.05, special_situations: 0.00, turnaround: 0.00 },
    max_deviation: 0.05,
    style_mix_healthy: true,
  },
  evidence_analysis: {
    total_evidence_refs: 3000,
    with_doc_id: 2850,
    with_chunk_id: 2700,
    coverage_pct: 90,
    avg_evidence_per_idea: 5,
  },
  compliance_checks: {
    novelty_first_enforced: true,
    gates_enforced: true,
    binary_overrides_active: true,
    weekly_cap_respected: true,
    timezone_correct: true,
    all_passed: true,
    failures: [],
  },
  recommendations: [
    'Consider expanding universe coverage in LatAm region',
    'Monitor Gate 3 pass rate - slightly below target',
  ],
};

export default function QAReportPage() {
  const [reports, setReports] = useState<QAReport[]>([mockReport]);
  const [selectedReport, setSelectedReport] = useState<QAReport>(mockReport);
  const [loading, setLoading] = useState(false);

  const healthColors = {
    healthy: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(selectedReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qa_report_${selectedReport.period_end.split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Weekly QA Report</h1>
          <p className="text-gray-600">
            System health and compliance monitoring
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
            {reports.map(report => (
              <option key={report.report_id} value={report.report_id}>
                Week of {formatDate(report.period_end)}
              </option>
            ))}
          </select>
          <button
            onClick={downloadJSON}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Download JSON
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div className={`border rounded-lg p-6 ${healthColors[selectedReport.summary.overall_health]}`}>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold">
              Overall Health: {selectedReport.summary.overall_health.toUpperCase()}
            </h2>
            <p className="text-sm mt-1">
              Period: {formatDate(selectedReport.period_start)} - {formatDate(selectedReport.period_end)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{selectedReport.summary.total_ideas_generated}</div>
            <div className="text-sm">Ideas Generated</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-white/50 rounded-lg p-3">
            <div className="text-xl font-bold">{selectedReport.summary.total_ideas_promoted}</div>
            <div className="text-sm">Promoted</div>
          </div>
          <div className="bg-white/50 rounded-lg p-3">
            <div className="text-xl font-bold">{selectedReport.summary.total_packets_completed}</div>
            <div className="text-sm">Packets</div>
          </div>
          <div className="bg-white/50 rounded-lg p-3">
            <div className="text-xl font-bold">{selectedReport.summary.alerts.length}</div>
            <div className="text-sm">Alerts</div>
          </div>
        </div>
      </div>

      {/* Compliance Checks */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Compliance Checks</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Novelty-First', value: selectedReport.compliance_checks.novelty_first_enforced },
            { label: 'Gates Enforced', value: selectedReport.compliance_checks.gates_enforced },
            { label: 'Binary Overrides', value: selectedReport.compliance_checks.binary_overrides_active },
            { label: 'Weekly Cap', value: selectedReport.compliance_checks.weekly_cap_respected },
            { label: 'Timezone', value: selectedReport.compliance_checks.timezone_correct },
          ].map(check => (
            <div
              key={check.label}
              className={`p-3 rounded-lg text-center ${
                check.value ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}
            >
              <div className={`text-lg ${check.value ? 'text-green-600' : 'text-red-600'}`}>
                {check.value ? '✓' : '✗'}
              </div>
              <div className="text-sm font-medium">{check.label}</div>
            </div>
          ))}
        </div>
        {selectedReport.compliance_checks.failures.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="font-medium text-red-800 mb-2">Failures:</h3>
            <ul className="list-disc list-inside text-sm text-red-700">
              {selectedReport.compliance_checks.failures.map((failure, i) => (
                <li key={i}>{failure}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Gate Analysis */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Gate Analysis</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Gate</th>
                <th className="text-right py-2">Evaluated</th>
                <th className="text-right py-2">Passed</th>
                <th className="text-right py-2">Failed</th>
                <th className="text-right py-2">Pass Rate</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(selectedReport.gate_analysis.by_gate).map(([gate, stats]) => (
                <tr key={gate} className="border-b">
                  <td className="py-2 font-medium">
                    {gate.replace('gate_', 'Gate ').replace(/_/g, ' ')}
                  </td>
                  <td className="text-right">{stats.evaluated}</td>
                  <td className="text-right text-green-600">{stats.passed}</td>
                  <td className="text-right text-red-600">{stats.failed}</td>
                  <td className="text-right">
                    <span className={stats.pass_rate >= 0.9 ? 'text-green-600' : 'text-yellow-600'}>
                      {formatPercent(stats.pass_rate)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Binary Overrides */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">Gate 3 Binary Overrides: {selectedReport.gate_analysis.binary_override_count}</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Leverage Risk:</span>{' '}
              <span className="font-medium">{selectedReport.gate_analysis.binary_override_breakdown.leverage_risk}</span>
            </div>
            <div>
              <span className="text-gray-600">Liquidity Risk:</span>{' '}
              <span className="font-medium">{selectedReport.gate_analysis.binary_override_breakdown.liquidity_risk}</span>
            </div>
            <div>
              <span className="text-gray-600">Regulatory Cliff:</span>{' '}
              <span className="font-medium">{selectedReport.gate_analysis.binary_override_breakdown.regulatory_cliff}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Novelty Analysis */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Novelty Distribution</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-700">{selectedReport.novelty_analysis.new_pct}%</div>
            <div className="text-sm text-green-600">New (90+ days)</div>
            <div className="text-xs text-gray-500">{selectedReport.novelty_analysis.new_count} tickers</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-700">{selectedReport.novelty_analysis.reappearance_pct}%</div>
            <div className="text-sm text-blue-600">Reappearance (30-90d)</div>
            <div className="text-xs text-gray-500">{selectedReport.novelty_analysis.reappearance_count} tickers</div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-yellow-700">{selectedReport.novelty_analysis.repeat_pct}%</div>
            <div className="text-sm text-yellow-600">Repeat (&lt;30 days)</div>
            <div className="text-xs text-gray-500">{selectedReport.novelty_analysis.repeat_count} tickers</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-700">{selectedReport.novelty_analysis.exploration_pct}%</div>
            <div className="text-sm text-purple-600">Exploration</div>
            <div className="text-xs text-gray-500">{selectedReport.novelty_analysis.exploration_count} tickers</div>
          </div>
        </div>
      </div>

      {/* Style Mix Analysis */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Style Mix vs Target</h2>
        <div className="space-y-4">
          {Object.entries(selectedReport.style_mix_analysis.actual).map(([style, actual]) => {
            const target = selectedReport.style_mix_analysis.target[style] || 0;
            const deviation = selectedReport.style_mix_analysis.deviation[style] || 0;
            return (
              <div key={style}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium capitalize">{style.replace(/_/g, ' ')}</span>
                  <span>
                    {formatPercent(actual)} / {formatPercent(target)} target
                    {deviation > 0.05 && (
                      <span className="text-yellow-600 ml-2">({formatPercent(deviation)} deviation)</span>
                    )}
                  </span>
                </div>
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${actual * 100}%` }}
                  />
                  <div
                    className="absolute top-0 h-full w-0.5 bg-gray-800"
                    style={{ left: `${target * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Evidence Analysis */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Evidence Coverage</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{selectedReport.evidence_analysis.total_evidence_refs}</div>
            <div className="text-sm text-gray-600">Total References</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {selectedReport.evidence_analysis.coverage_pct}%
            </div>
            <div className="text-sm text-gray-600">With doc_id + chunk_id</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{selectedReport.evidence_analysis.avg_evidence_per_idea}</div>
            <div className="text-sm text-gray-600">Avg per Idea</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{selectedReport.evidence_analysis.with_chunk_id}</div>
            <div className="text-sm text-gray-600">With Chunk ID</div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {selectedReport.recommendations.length > 0 && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Recommendations</h2>
          <ul className="space-y-2">
            {selectedReport.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Alerts */}
      {selectedReport.summary.alerts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-4">Alerts</h2>
          <ul className="space-y-2">
            {selectedReport.summary.alerts.map((alert, i) => (
              <li key={i} className="flex items-start gap-2 text-yellow-700">
                <span className="mt-1">⚠</span>
                <span>{alert}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
