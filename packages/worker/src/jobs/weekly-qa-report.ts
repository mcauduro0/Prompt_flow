/**
 * ARC Investment Factory - Weekly QA Report
 * 
 * Schedule: Every Friday 17:00 America/Sao_Paulo (before IC Bundle at 18:00)
 * 
 * Purpose: Automated quality assurance report to detect system drift,
 * bias, and ensure Operating Parameters compliance.
 * 
 * Required Metrics (from Operating Parameters):
 * 1. Gate pass/fail distribution (by gate, by style)
 * 2. Novelty distribution (new vs reappearance vs repeat)
 * 3. Style mix vs target allocation
 * 4. Evidence coverage (% with doc_id + chunk_id)
 * 5. Average signposts per idea
 * 6. Promotion rate by style
 * 7. Rejection reasons distribution
 * 8. Binary override triggers count
 * 9. Universe coverage (regions, sectors)
 * 10. LLM token usage and cost
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  SYSTEM_TIMEZONE,
  LANE_A_DAILY_TARGET,
  LANE_B_WEEKLY_CAP,
  STYLE_MIX_TARGETS,
  NOVELTY_NEW_TICKER_DAYS,
  NOVELTY_PENALTY_WINDOW_DAYS,
} from '@arc/shared';

// ============================================================================
// TYPES
// ============================================================================

export interface WeeklyQAReport {
  report_id: string;
  generated_at: string;
  period_start: string;
  period_end: string;
  timezone: string;
  
  // Summary
  summary: {
    overall_health: 'healthy' | 'warning' | 'critical';
    total_ideas_generated: number;
    total_ideas_promoted: number;
    total_packets_completed: number;
    alerts: string[];
  };
  
  // Gate Analysis
  gate_analysis: {
    total_evaluated: number;
    pass_rate: number;
    by_gate: {
      gate_0_data_sufficiency: GateStats;
      gate_1_coherence: GateStats;
      gate_2_edge_claim: GateStats;
      gate_3_downside_sanity: GateStats;
      gate_4_style_fit: GateStats;
    };
    by_style: Record<string, GateStats>;
    binary_override_count: number;
    binary_override_breakdown: {
      leverage_risk: number;
      liquidity_risk: number;
      regulatory_cliff: number;
    };
  };
  
  // Novelty Analysis
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
    avg_days_since_last_seen: number;
    novelty_score_distribution: {
      min: number;
      max: number;
      avg: number;
      median: number;
      p25: number;
      p75: number;
    };
  };
  
  // Style Mix Analysis
  style_mix_analysis: {
    actual: Record<string, number>;
    target: Record<string, number>;
    deviation: Record<string, number>;
    max_deviation: number;
    style_mix_healthy: boolean;
  };
  
  // Evidence Analysis
  evidence_analysis: {
    total_evidence_refs: number;
    with_doc_id: number;
    with_chunk_id: number;
    coverage_pct: number;
    avg_evidence_per_idea: number;
    source_type_distribution: Record<string, number>;
  };
  
  // Signpost Analysis
  signpost_analysis: {
    total_signposts: number;
    avg_per_idea: number;
    min_per_idea: number;
    max_per_idea: number;
    ideas_below_minimum: number;
    frequency_distribution: Record<string, number>;
  };
  
  // Promotion Analysis
  promotion_analysis: {
    total_promoted: number;
    promotion_rate: number;
    by_style: Record<string, { promoted: number; total: number; rate: number }>;
    avg_days_to_promotion: number;
  };
  
  // Rejection Analysis
  rejection_analysis: {
    total_rejected: number;
    by_gate: Record<string, number>;
    by_reason: Record<string, number>;
    most_common_reason: string;
    rejection_rate: number;
  };
  
  // Universe Coverage
  universe_coverage: {
    total_tickers: number;
    by_region: Record<string, number>;
    by_sector: Record<string, number>;
    coverage_gaps: string[];
  };
  
  // LLM Usage
  llm_usage: {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    estimated_cost_usd: number;
    avg_tokens_per_idea: number;
    by_model: Record<string, { tokens: number; cost: number }>;
  };
  
  // Compliance Checks
  compliance_checks: {
    novelty_first_enforced: boolean;
    gates_enforced: boolean;
    binary_overrides_active: boolean;
    weekly_cap_respected: boolean;
    timezone_correct: boolean;
    all_passed: boolean;
    failures: string[];
  };
  
  // Recommendations
  recommendations: string[];
}

interface GateStats {
  evaluated: number;
  passed: number;
  failed: number;
  pass_rate: number;
}

// ============================================================================
// QA REPORT GENERATOR
// ============================================================================

export class WeeklyQAReportGenerator {
  private reportId: string;
  private periodStart: Date;
  private periodEnd: Date;
  
  constructor() {
    this.reportId = uuidv4();
    this.periodEnd = new Date();
    this.periodStart = new Date(this.periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  
  /**
   * Generate the complete weekly QA report
   */
  async generate(): Promise<WeeklyQAReport> {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`[QA Report] Generating Weekly QA Report`);
    console.log(`[QA Report] Report ID: ${this.reportId}`);
    console.log(`[QA Report] Period: ${this.periodStart.toISOString()} - ${this.periodEnd.toISOString()}`);
    console.log(`${'='.repeat(70)}\n`);
    
    // Fetch data from database (placeholder - would use actual DB queries)
    const ideas = await this.fetchIdeas();
    const promotions = await this.fetchPromotions();
    const packets = await this.fetchPackets();
    const runs = await this.fetchRuns();
    
    // Generate each section
    const gateAnalysis = this.analyzeGates(ideas);
    const noveltyAnalysis = this.analyzeNovelty(ideas);
    const styleMixAnalysis = this.analyzeStyleMix(ideas);
    const evidenceAnalysis = this.analyzeEvidence(ideas);
    const signpostAnalysis = this.analyzeSignposts(ideas);
    const promotionAnalysis = this.analyzePromotions(ideas, promotions);
    const rejectionAnalysis = this.analyzeRejections(ideas);
    const universeCoverage = this.analyzeUniverseCoverage(ideas);
    const llmUsage = this.analyzeLLMUsage(runs);
    const complianceChecks = this.checkCompliance(
      gateAnalysis,
      noveltyAnalysis,
      promotionAnalysis
    );
    
    // Generate alerts and recommendations
    const alerts = this.generateAlerts(
      gateAnalysis,
      noveltyAnalysis,
      styleMixAnalysis,
      evidenceAnalysis,
      complianceChecks
    );
    const recommendations = this.generateRecommendations(
      gateAnalysis,
      noveltyAnalysis,
      styleMixAnalysis,
      evidenceAnalysis,
      complianceChecks
    );
    
    // Determine overall health
    const overallHealth = this.determineOverallHealth(alerts, complianceChecks);
    
    const report: WeeklyQAReport = {
      report_id: this.reportId,
      generated_at: new Date().toISOString(),
      period_start: this.periodStart.toISOString(),
      period_end: this.periodEnd.toISOString(),
      timezone: SYSTEM_TIMEZONE,
      
      summary: {
        overall_health: overallHealth,
        total_ideas_generated: ideas.length,
        total_ideas_promoted: promotions.length,
        total_packets_completed: packets.length,
        alerts,
      },
      
      gate_analysis: gateAnalysis,
      novelty_analysis: noveltyAnalysis,
      style_mix_analysis: styleMixAnalysis,
      evidence_analysis: evidenceAnalysis,
      signpost_analysis: signpostAnalysis,
      promotion_analysis: promotionAnalysis,
      rejection_analysis: rejectionAnalysis,
      universe_coverage: universeCoverage,
      llm_usage: llmUsage,
      compliance_checks: complianceChecks,
      recommendations,
    };
    
    console.log(`[QA Report] Overall Health: ${overallHealth.toUpperCase()}`);
    console.log(`[QA Report] Alerts: ${alerts.length}`);
    console.log(`[QA Report] Compliance: ${complianceChecks.all_passed ? 'PASSED' : 'FAILED'}`);
    
    return report;
  }
  
  /**
   * Save report to JSON file
   */
  async saveToFile(report: WeeklyQAReport, outputDir: string): Promise<string> {
    await fs.mkdir(outputDir, { recursive: true });
    
    const filename = `qa_report_${report.period_end.split('T')[0]}.json`;
    const filepath = path.join(outputDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    console.log(`[QA Report] Saved to: ${filepath}`);
    
    return filepath;
  }
  
  // ============================================================================
  // DATA FETCHERS (Placeholders - would use actual DB queries)
  // ============================================================================
  
  private async fetchIdeas(): Promise<any[]> {
    // Would fetch from database
    return [];
  }
  
  private async fetchPromotions(): Promise<any[]> {
    // Would fetch from database
    return [];
  }
  
  private async fetchPackets(): Promise<any[]> {
    // Would fetch from database
    return [];
  }
  
  private async fetchRuns(): Promise<any[]> {
    // Would fetch from database
    return [];
  }
  
  // ============================================================================
  // ANALYSIS FUNCTIONS
  // ============================================================================
  
  private analyzeGates(ideas: any[]): WeeklyQAReport['gate_analysis'] {
    const gateStats = (evaluated: number, passed: number): GateStats => ({
      evaluated,
      passed,
      failed: evaluated - passed,
      pass_rate: evaluated > 0 ? passed / evaluated : 0,
    });
    
    // Placeholder - would calculate from actual data
    return {
      total_evaluated: ideas.length,
      pass_rate: 0.75,
      by_gate: {
        gate_0_data_sufficiency: gateStats(100, 95),
        gate_1_coherence: gateStats(95, 90),
        gate_2_edge_claim: gateStats(90, 85),
        gate_3_downside_sanity: gateStats(85, 80),
        gate_4_style_fit: gateStats(80, 75),
      },
      by_style: {},
      binary_override_count: 5,
      binary_override_breakdown: {
        leverage_risk: 2,
        liquidity_risk: 2,
        regulatory_cliff: 1,
      },
    };
  }
  
  private analyzeNovelty(ideas: any[]): WeeklyQAReport['novelty_analysis'] {
    // Placeholder - would calculate from actual data
    return {
      total_shortlisted: 200,
      new_count: 80,
      new_pct: 40,
      reappearance_count: 60,
      reappearance_pct: 30,
      repeat_count: 40,
      repeat_pct: 20,
      exploration_count: 20,
      exploration_pct: 10,
      avg_days_since_last_seen: 45,
      novelty_score_distribution: {
        min: 10,
        max: 100,
        avg: 55,
        median: 50,
        p25: 30,
        p75: 75,
      },
    };
  }
  
  private analyzeStyleMix(ideas: any[]): WeeklyQAReport['style_mix_analysis'] {
    const actual: Record<string, number> = {
      quality: 0.30,
      value: 0.25,
      growth: 0.20,
      special_situations: 0.15,
      turnaround: 0.10,
    };
    
    const target = STYLE_MIX_TARGETS;
    const deviation: Record<string, number> = {};
    let maxDeviation = 0;
    
    for (const style of Object.keys(target)) {
      const dev = Math.abs((actual[style] || 0) - target[style as keyof typeof target]);
      deviation[style] = dev;
      maxDeviation = Math.max(maxDeviation, dev);
    }
    
    return {
      actual,
      target,
      deviation,
      max_deviation: maxDeviation,
      style_mix_healthy: maxDeviation <= 0.10, // 10% tolerance
    };
  }
  
  private analyzeEvidence(ideas: any[]): WeeklyQAReport['evidence_analysis'] {
    // Placeholder - would calculate from actual data
    return {
      total_evidence_refs: 500,
      with_doc_id: 480,
      with_chunk_id: 450,
      coverage_pct: 90,
      avg_evidence_per_idea: 5,
      source_type_distribution: {
        '10-K': 150,
        '10-Q': 100,
        earnings_call: 80,
        analyst_report: 70,
        news: 100,
      },
    };
  }
  
  private analyzeSignposts(ideas: any[]): WeeklyQAReport['signpost_analysis'] {
    // Placeholder - would calculate from actual data
    return {
      total_signposts: 400,
      avg_per_idea: 4,
      min_per_idea: 2,
      max_per_idea: 8,
      ideas_below_minimum: 5,
      frequency_distribution: {
        monthly: 150,
        quarterly: 200,
        event_driven: 50,
      },
    };
  }
  
  private analyzePromotions(ideas: any[], promotions: any[]): WeeklyQAReport['promotion_analysis'] {
    // Placeholder - would calculate from actual data
    return {
      total_promoted: promotions.length,
      promotion_rate: 0.15,
      by_style: {
        quality: { promoted: 5, total: 30, rate: 0.17 },
        value: { promoted: 4, total: 25, rate: 0.16 },
        growth: { promoted: 3, total: 20, rate: 0.15 },
        special_situations: { promoted: 2, total: 15, rate: 0.13 },
        turnaround: { promoted: 1, total: 10, rate: 0.10 },
      },
      avg_days_to_promotion: 3.5,
    };
  }
  
  private analyzeRejections(ideas: any[]): WeeklyQAReport['rejection_analysis'] {
    // Placeholder - would calculate from actual data
    return {
      total_rejected: 25,
      by_gate: {
        gate_0: 2,
        gate_1: 3,
        gate_2: 5,
        gate_3: 10,
        gate_4: 5,
      },
      by_reason: {
        'Leverage risk dominant': 5,
        'Insufficient edge clarity': 5,
        'Style mismatch': 5,
        'Missing signposts': 5,
        'Other': 5,
      },
      most_common_reason: 'Leverage risk dominant',
      rejection_rate: 0.25,
    };
  }
  
  private analyzeUniverseCoverage(ideas: any[]): WeeklyQAReport['universe_coverage'] {
    // Placeholder - would calculate from actual data
    return {
      total_tickers: 5000,
      by_region: {
        US: 2500,
        Europe: 1200,
        Asia: 800,
        LatAm: 300,
        Other: 200,
      },
      by_sector: {
        Technology: 800,
        Healthcare: 700,
        Financials: 600,
        Industrials: 500,
        'Consumer Discretionary': 450,
        'Consumer Staples': 400,
        Energy: 350,
        Materials: 300,
        Utilities: 250,
        'Real Estate': 200,
        'Communication Services': 450,
      },
      coverage_gaps: [],
    };
  }
  
  private analyzeLLMUsage(runs: any[]): WeeklyQAReport['llm_usage'] {
    // Placeholder - would calculate from actual data
    return {
      total_tokens: 500000,
      prompt_tokens: 300000,
      completion_tokens: 200000,
      estimated_cost_usd: 15.00,
      avg_tokens_per_idea: 5000,
      by_model: {
        'gpt-4o': { tokens: 400000, cost: 12.00 },
        'claude-3-5-sonnet': { tokens: 100000, cost: 3.00 },
      },
    };
  }
  
  private checkCompliance(
    gateAnalysis: WeeklyQAReport['gate_analysis'],
    noveltyAnalysis: WeeklyQAReport['novelty_analysis'],
    promotionAnalysis: WeeklyQAReport['promotion_analysis']
  ): WeeklyQAReport['compliance_checks'] {
    const failures: string[] = [];
    
    // Check novelty-first is enforced
    const noveltyFirstEnforced = noveltyAnalysis.new_pct >= 30; // At least 30% new
    if (!noveltyFirstEnforced) {
      failures.push(`Novelty-first not enforced: only ${noveltyAnalysis.new_pct}% new (need 30%+)`);
    }
    
    // Check gates are enforced
    const gatesEnforced = gateAnalysis.pass_rate < 1.0; // Some should fail
    if (!gatesEnforced) {
      failures.push('Gates may not be enforced: 100% pass rate is suspicious');
    }
    
    // Check binary overrides are active
    const binaryOverridesActive = gateAnalysis.binary_override_count > 0;
    if (!binaryOverridesActive) {
      failures.push('Binary overrides may not be active: 0 triggers this week');
    }
    
    // Check weekly cap is respected
    const weeklyCapRespected = promotionAnalysis.total_promoted <= LANE_B_WEEKLY_CAP;
    if (!weeklyCapRespected) {
      failures.push(`Weekly cap exceeded: ${promotionAnalysis.total_promoted} > ${LANE_B_WEEKLY_CAP}`);
    }
    
    // Check timezone is correct
    const timezoneCorrect = true; // Would verify from run timestamps
    
    return {
      novelty_first_enforced: noveltyFirstEnforced,
      gates_enforced: gatesEnforced,
      binary_overrides_active: binaryOverridesActive,
      weekly_cap_respected: weeklyCapRespected,
      timezone_correct: timezoneCorrect,
      all_passed: failures.length === 0,
      failures,
    };
  }
  
  private generateAlerts(
    gateAnalysis: WeeklyQAReport['gate_analysis'],
    noveltyAnalysis: WeeklyQAReport['novelty_analysis'],
    styleMixAnalysis: WeeklyQAReport['style_mix_analysis'],
    evidenceAnalysis: WeeklyQAReport['evidence_analysis'],
    complianceChecks: WeeklyQAReport['compliance_checks']
  ): string[] {
    const alerts: string[] = [];
    
    // Gate alerts
    if (gateAnalysis.by_gate.gate_3_downside_sanity.pass_rate < 0.7) {
      alerts.push('Gate 3 pass rate below 70% - review downside analysis quality');
    }
    
    // Novelty alerts
    if (noveltyAnalysis.new_pct < 30) {
      alerts.push(`Low novelty: only ${noveltyAnalysis.new_pct}% new ideas (target 30%+)`);
    }
    if (noveltyAnalysis.repeat_pct > 30) {
      alerts.push(`High repeat rate: ${noveltyAnalysis.repeat_pct}% repeats (target <30%)`);
    }
    
    // Style mix alerts
    if (!styleMixAnalysis.style_mix_healthy) {
      alerts.push(`Style mix deviation: ${(styleMixAnalysis.max_deviation * 100).toFixed(1)}% (max 10%)`);
    }
    
    // Evidence alerts
    if (evidenceAnalysis.coverage_pct < 80) {
      alerts.push(`Low evidence coverage: ${evidenceAnalysis.coverage_pct}% (target 80%+)`);
    }
    
    // Compliance alerts
    alerts.push(...complianceChecks.failures);
    
    return alerts;
  }
  
  private generateRecommendations(
    gateAnalysis: WeeklyQAReport['gate_analysis'],
    noveltyAnalysis: WeeklyQAReport['novelty_analysis'],
    styleMixAnalysis: WeeklyQAReport['style_mix_analysis'],
    evidenceAnalysis: WeeklyQAReport['evidence_analysis'],
    complianceChecks: WeeklyQAReport['compliance_checks']
  ): string[] {
    const recommendations: string[] = [];
    
    // Gate recommendations
    if (gateAnalysis.binary_override_count > 10) {
      recommendations.push('High binary override count - consider reviewing universe quality');
    }
    
    // Novelty recommendations
    if (noveltyAnalysis.new_pct < 30) {
      recommendations.push('Increase novelty by expanding universe or adjusting novelty thresholds');
    }
    
    // Style mix recommendations
    for (const [style, deviation] of Object.entries(styleMixAnalysis.deviation)) {
      if (deviation > 0.10) {
        const actual = styleMixAnalysis.actual[style] || 0;
        const target = styleMixAnalysis.target[style as keyof typeof styleMixAnalysis.target];
        if (actual < target) {
          recommendations.push(`Increase ${style} allocation: ${(actual * 100).toFixed(0)}% vs ${(target * 100).toFixed(0)}% target`);
        } else {
          recommendations.push(`Reduce ${style} allocation: ${(actual * 100).toFixed(0)}% vs ${(target * 100).toFixed(0)}% target`);
        }
      }
    }
    
    // Evidence recommendations
    if (evidenceAnalysis.coverage_pct < 80) {
      recommendations.push('Improve evidence grounding by requiring doc_id + chunk_id for all claims');
    }
    
    return recommendations;
  }
  
  private determineOverallHealth(
    alerts: string[],
    complianceChecks: WeeklyQAReport['compliance_checks']
  ): 'healthy' | 'warning' | 'critical' {
    if (!complianceChecks.all_passed) {
      return 'critical';
    }
    if (alerts.length > 3) {
      return 'warning';
    }
    return 'healthy';
  }
}

// ============================================================================
// SCHEDULED JOB
// ============================================================================

/**
 * Run weekly QA report job
 * Schedule: Friday 17:00 America/Sao_Paulo
 */
export async function runWeeklyQAReport(): Promise<WeeklyQAReport> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[Weekly QA] Starting Weekly QA Report Job`);
  console.log(`[Weekly QA] Timezone: ${SYSTEM_TIMEZONE}`);
  console.log(`${'='.repeat(70)}\n`);
  
  const generator = new WeeklyQAReportGenerator();
  const report = await generator.generate();
  
  // Save to file
  const outputDir = process.env.QA_REPORTS_DIR || './data/qa_reports';
  const filepath = await generator.saveToFile(report, outputDir);
  
  // Log summary
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[Weekly QA] Report Complete`);
  console.log(`[Weekly QA] Health: ${report.summary.overall_health.toUpperCase()}`);
  console.log(`[Weekly QA] Ideas: ${report.summary.total_ideas_generated}`);
  console.log(`[Weekly QA] Promoted: ${report.summary.total_ideas_promoted}`);
  console.log(`[Weekly QA] Packets: ${report.summary.total_packets_completed}`);
  console.log(`[Weekly QA] Alerts: ${report.summary.alerts.length}`);
  console.log(`[Weekly QA] Compliance: ${report.compliance_checks.all_passed ? 'PASSED' : 'FAILED'}`);
  console.log(`[Weekly QA] Saved to: ${filepath}`);
  console.log(`${'='.repeat(70)}\n`);
  
  return report;
}

export default runWeeklyQAReport;
