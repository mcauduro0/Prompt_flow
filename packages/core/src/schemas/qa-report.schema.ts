/**
 * ARC Investment Factory - QA Report Schema
 * 
 * Governance contract for Weekly QA Report.
 * This schema is LOCKED and defines the exact structure required.
 * 
 * Based on: AUTOMATED FRIDAY QA REPORT SPEC
 */

import { z } from 'zod';

// ============================================================================
// STATUS ENUMS (LOCKED)
// ============================================================================

/**
 * QA Status - pass/warn/fail (NOT healthy/warning/critical)
 */
export const QAStatusSchema = z.enum(['pass', 'warn', 'fail']);
export type QAStatus = z.infer<typeof QAStatusSchema>;

/**
 * Drift Alarm Severity
 */
export const DriftAlarmSeveritySchema = z.enum(['warn', 'fail']);
export type DriftAlarmSeverity = z.infer<typeof DriftAlarmSeveritySchema>;

// ============================================================================
// QA CHECK (LOCKED)
// ============================================================================

/**
 * Individual QA check result
 */
export const QACheckSchema = z.object({
  id: z.string().describe('Check identifier, e.g., A1, B2, C3'),
  description: z.string().describe('Human-readable description of the check'),
  status: QAStatusSchema,
  value: z.union([z.number(), z.string(), z.record(z.unknown())]).describe('Actual measured value'),
  expected: z.string().describe('Expected value or threshold description'),
  evidence: z.object({
    query_ids: z.array(z.string()).optional(),
    counts: z.record(z.number()).optional(),
    sample_ids: z.array(z.string()).optional(),
  }).optional().describe('Supporting evidence for the check'),
});
export type QACheck = z.infer<typeof QACheckSchema>;

// ============================================================================
// QA SECTION (LOCKED)
// ============================================================================

/**
 * QA Section containing multiple checks
 */
export const QASectionSchema = z.object({
  name: z.string().describe('Section name, e.g., "System Health and Cadence"'),
  status: QAStatusSchema,
  score_0_100: z.number().min(0).max(100).describe('Section score: pass=100, warn=70, fail=0'),
  checks: z.array(QACheckSchema),
});
export type QASection = z.infer<typeof QASectionSchema>;

// ============================================================================
// DRIFT ALARM (LOCKED)
// ============================================================================

/**
 * Drift alarm triggered by check failures
 */
export const DriftAlarmSchema = z.object({
  id: z.string().describe('Alarm identifier, e.g., "novelty_collapse"'),
  severity: DriftAlarmSeveritySchema,
  triggered: z.boolean(),
  message: z.string().describe('Human-readable alarm message'),
  remediation: z.string().describe('Suggested remediation action'),
  related_check_ids: z.array(z.string()).describe('IDs of checks that triggered this alarm'),
});
export type DriftAlarm = z.infer<typeof DriftAlarmSchema>;

// ============================================================================
// KEY METRICS (LOCKED)
// ============================================================================

/**
 * Key metrics summary for quick reference
 */
export const KeyMetricsSchema = z.object({
  // Cadence
  discovery_runs: z.number(),
  lane_b_runs: z.number(),
  weekend_runs: z.number(),
  
  // Volume
  ideas_generated: z.number(),
  ideas_promoted: z.number(),
  packets_completed: z.number(),
  
  // Quality
  novelty_rate_top30: z.number().describe('% of top 30 that are new/reappearance'),
  gate_pass_rate: z.number(),
  evidence_grounding_rate: z.number(),
  
  // Coverage
  universe_coverage_rate: z.number(),
  non_us_share: z.number(),
  
  // Errors
  error_rate: z.number(),
});
export type KeyMetrics = z.infer<typeof KeyMetricsSchema>;

// ============================================================================
// LINKS (LOCKED)
// ============================================================================

/**
 * Links to related resources
 */
export const LinksSchema = z.object({
  json_artifact: z.string().url().optional(),
  ui_page: z.string().optional(),
  previous_report: z.string().optional(),
});
export type Links = z.infer<typeof LinksSchema>;

// ============================================================================
// QA REPORT (LOCKED)
// ============================================================================

/**
 * Complete Weekly QA Report
 * 
 * This is the governance contract. All QA reports must validate against this schema.
 */
export const QAReportSchema = z.object({
  // Identification
  report_id: z.string().uuid(),
  as_of: z.string().datetime().describe('Timestamp when report was generated'),
  window_start: z.string().describe('Start of 7-day lookback window (YYYY-MM-DD)'),
  window_end: z.string().describe('End of lookback window (YYYY-MM-DD)'),
  timezone: z.literal('America/Sao_Paulo'),
  
  // Overall status
  overall_status: QAStatusSchema.describe('fail if any fail-severity alarm triggers'),
  overall_score_0_100: z.number().min(0).max(100).describe('Weighted average of section scores'),
  
  // Sections (7 required)
  sections: z.array(QASectionSchema).min(7).max(7).describe('Exactly 7 sections: A-G'),
  
  // Drift alarms (5 defined)
  drift_alarms: z.array(DriftAlarmSchema).describe('All 5 drift alarms with triggered status'),
  
  // Summary metrics
  key_metrics: KeyMetricsSchema,
  
  // Links
  links: LinksSchema,
});
export type QAReport = z.infer<typeof QAReportSchema>;

// ============================================================================
// SECTION WEIGHTS (LOCKED)
// ============================================================================

/**
 * Section weights for overall score calculation
 * Total: 100
 */
export const SECTION_WEIGHTS = {
  A_SYSTEM_HEALTH: 15,
  B_NOVELTY: 20,
  C_GATES: 15,
  D_DEEP_PACKET: 25,
  E_MEMORY: 10,
  F_GLOBAL_COVERAGE: 10,
  G_USABILITY: 5,
} as const;

// ============================================================================
// THRESHOLDS (LOCKED)
// ============================================================================

/**
 * Thresholds for all checks
 * These are governance parameters and should not be changed.
 */
export const QA_THRESHOLDS = {
  // Section A: System Health
  A1_SCHEDULER_CADENCE: {
    discovery_expected: 5,
    lane_b_expected: 5,
    warn_threshold: 4,
    fail_threshold: 0,
  },
  A2_WEEKEND_SUPPRESSION: {
    expected: 0,
  },
  A3_CAPS: {
    lane_a_min: 100,
    lane_a_max: 200,
    lane_a_warn_threshold: 80,
    lane_b_weekly_max: 10,
    lane_b_concurrency_max: 3,
  },
  A4_ERROR_RATE: {
    warn_threshold: 0.05,
    fail_threshold: 0.10,
    consecutive_fail_threshold: 3,
  },
  
  // Section B: Novelty
  B1_TOP30_NOVELTY: {
    expected_min: 12,
    warn_threshold: 8,
    fail_threshold: 8,
  },
  B2_REPETITION_VIOLATIONS: {
    expected: 0,
  },
  B3_REAPPEARANCE_DELTA: {
    pass_threshold: 0.80,
    warn_threshold: 0.60,
  },
  
  // Section C: Gates
  C1_GATE_COMPLETENESS: {
    expected: 1.0,
  },
  C2_PROMOTION_INTEGRITY: {
    expected: 1.0,
  },
  C3_DOWNSIDE_INTEGRITY: {
    expected: 1.0,
  },
  C4_STYLE_FIT_INTEGRITY: {
    expected: 1.0,
  },
  
  // Section D: Deep Packet
  D1_COMPLETED_COUNT: {
    max: 10,
  },
  D2_MANDATORY_FIELDS: {
    expected: 1.0,
    historical_parallels_min: 2,
    pre_mortem_warnings_min: 3,
    monitoring_kpis_min: 5,
    monitoring_triggers_min: 3,
  },
  D3_EVIDENCE_GROUNDING: {
    pass_threshold: 0.90,
    warn_threshold: 0.80,
  },
  D4_OPEN_QUESTIONS: {
    pass_threshold: 0.80,
    warn_threshold: 0.60,
  },
  
  // Section E: Memory
  E1_IMMUTABLE_VERSIONING: {
    expected: 1.0,
  },
  E2_REJECTION_SHADOW: {
    pass_threshold: 0.80,
    warn_threshold: 0.60,
  },
  
  // Section F: Global Coverage
  F1_UNIVERSE_COVERAGE: {
    pass_threshold: 0.90,
    warn_threshold: 0.80,
    fail_threshold: 0.70,
  },
  F2_NON_US_SHARE: {
    pass_threshold: 0.30,
    warn_threshold: 0.20,
  },
  F3_NON_US_RETRIEVAL: {
    pass_threshold: 0.80,
    warn_threshold: 0.60,
  },
  
  // Section G: Usability
  G1_WORKFLOW_INTEGRITY: {
    expected: true,
  },
} as const;

// ============================================================================
// DRIFT ALARM DEFINITIONS (LOCKED)
// ============================================================================

/**
 * Drift alarm definitions
 */
export const DRIFT_ALARM_DEFINITIONS = {
  ALARM_1_NOVELTY_COLLAPSE: {
    id: 'novelty_collapse',
    severity: 'fail' as const,
    trigger_check: 'B1',
    trigger_condition: 'B1 average < 8',
    remediation: 'Review novelty-first shortlist logic and universe expansion',
  },
  ALARM_2_PROMOTION_GATE_BREACH: {
    id: 'promotion_gate_breach',
    severity: 'fail' as const,
    trigger_check: 'C2',
    trigger_condition: 'Any promoted idea has failed gates',
    remediation: 'Review gate enforcement in promotion flow',
  },
  ALARM_3_WEEKLY_PACKET_CAP: {
    id: 'weekly_packet_cap_breach',
    severity: 'fail' as const,
    trigger_check: 'D1',
    trigger_condition: 'Completed packets > 10',
    remediation: 'Review Lane B weekly cap enforcement',
  },
  ALARM_4_EVIDENCE_GROUNDING_COLLAPSE: {
    id: 'evidence_grounding_collapse',
    severity: 'fail' as const,
    trigger_check: 'D3',
    trigger_condition: 'D3 pass rate < 80%',
    remediation: 'Review evidence locator validation and retrieval',
  },
  ALARM_5_GLOBAL_COVERAGE_COLLAPSE: {
    id: 'global_coverage_collapse',
    severity: 'warn' as const, // warn at <80%, fail at <70%
    trigger_check: 'F1',
    trigger_condition: 'F1 coverage_rate < 80%',
    remediation: 'Review security master and universe configuration',
  },
} as const;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate a QA report against the schema
 */
export function validateQAReport(report: unknown): QAReport {
  return QAReportSchema.parse(report);
}

/**
 * Safe validation that returns result or null
 */
export function safeValidateQAReport(report: unknown): QAReport | null {
  const result = QAReportSchema.safeParse(report);
  return result.success ? result.data : null;
}

/**
 * Calculate section score based on status
 */
export function calculateSectionScore(status: QAStatus): number {
  switch (status) {
    case 'pass': return 100;
    case 'warn': return 70;
    case 'fail': return 0;
  }
}

/**
 * Calculate overall score from sections
 */
export function calculateOverallScore(sections: QASection[]): number {
  const weights = [
    SECTION_WEIGHTS.A_SYSTEM_HEALTH,
    SECTION_WEIGHTS.B_NOVELTY,
    SECTION_WEIGHTS.C_GATES,
    SECTION_WEIGHTS.D_DEEP_PACKET,
    SECTION_WEIGHTS.E_MEMORY,
    SECTION_WEIGHTS.F_GLOBAL_COVERAGE,
    SECTION_WEIGHTS.G_USABILITY,
  ];
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  sections.forEach((section, index) => {
    const weight = weights[index] || 0;
    totalWeight += weight;
    weightedSum += section.score_0_100 * weight;
  });
  
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

/**
 * Determine overall status from drift alarms
 */
export function determineOverallStatus(
  sections: QASection[],
  driftAlarms: DriftAlarm[]
): QAStatus {
  // Fail if any fail-severity alarm is triggered
  const hasFailAlarm = driftAlarms.some(
    alarm => alarm.triggered && alarm.severity === 'fail'
  );
  if (hasFailAlarm) return 'fail';
  
  // Warn if any section has warn status or warn alarm triggered
  const hasWarn = sections.some(s => s.status === 'warn') ||
    driftAlarms.some(alarm => alarm.triggered && alarm.severity === 'warn');
  if (hasWarn) return 'warn';
  
  return 'pass';
}

export default QAReportSchema;
