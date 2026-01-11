/**
 * ARC Investment Factory - Research Module Schemas
 * Zod schemas for Lane B research agent outputs
 */

import { z } from 'zod';

/**
 * Business Module Schema
 */
export const BusinessModuleSchema = z.object({
  summary: z.string().min(100).describe('Comprehensive summary of the business model'),
  unit_economics: z.object({
    ltv_cac: z.number().nullable().describe('LTV/CAC ratio'),
    gross_margin: z.number().nullable().describe('Gross margin percentage'),
    contribution_margin: z.number().nullable().describe('Contribution margin percentage'),
    retention: z.number().nullable().describe('Customer retention rate'),
  }).describe('Unit economics metrics'),
  key_questions: z.array(z.string()).describe('Key questions to investigate further'),
  evidence: z.array(z.string()).describe('Evidence IDs supporting the analysis'),
});

export type BusinessModule = z.infer<typeof BusinessModuleSchema>;

/**
 * Industry & Moat Module Schema
 */
export const IndustryMoatModuleSchema = z.object({
  summary: z.string().min(100).describe('Comprehensive summary of competitive position'),
  competitive_position: z.string().describe('Description of market position'),
  moat_claims: z.array(z.object({
    claim: z.string().describe('Moat claim'),
    evidence: z.string().describe('Supporting evidence'),
    durability: z.enum(['high', 'medium', 'low']).describe('Durability assessment'),
  })).describe('Array of moat claims with evidence'),
  peer_set: z.array(z.string()).describe('Array of comparable company tickers'),
  evidence: z.array(z.string()).describe('Evidence IDs supporting the analysis'),
});

export type IndustryMoatModule = z.infer<typeof IndustryMoatModuleSchema>;

/**
 * Financial Forensics Module Schema
 */
export const FinancialForensicsModuleSchema = z.object({
  summary: z.string().min(100).describe('Comprehensive summary of financial quality'),
  earnings_quality_score_1_10: z.number().min(1).max(10).describe('Earnings quality score'),
  cash_conversion_notes: z.string().describe('Analysis of cash conversion'),
  balance_sheet_risks: z.array(z.object({
    risk: z.string().describe('Risk description'),
    severity: z.enum(['high', 'medium', 'low']).describe('Severity level'),
    mitigant: z.string().optional().describe('Potential mitigant'),
  })).describe('Array of identified balance sheet risks'),
  evidence: z.array(z.string()).describe('Evidence IDs supporting the analysis'),
});

export type FinancialForensicsModule = z.infer<typeof FinancialForensicsModuleSchema>;

/**
 * Capital Allocation Module Schema
 */
export const CapitalAllocationModuleSchema = z.object({
  summary: z.string().min(100).describe('Comprehensive summary of capital allocation'),
  track_record: z.string().describe('Description of historical track record'),
  mna_notes: z.string().describe('Notes on M&A activity and success'),
  roic_trend: z.enum(['improving', 'stable', 'declining']).optional().describe('ROIC trend'),
  reinvestment_rate: z.number().nullable().optional().describe('Reinvestment rate'),
  evidence: z.array(z.string()).describe('Evidence IDs supporting the analysis'),
});

export type CapitalAllocationModule = z.infer<typeof CapitalAllocationModuleSchema>;

/**
 * Management Quality Module Schema
 */
export const ManagementQualityModuleSchema = z.object({
  summary: z.string().min(100).describe('Comprehensive summary of management quality'),
  score_1_10: z.number().min(1).max(10).describe('Management quality score'),
  red_flags: z.array(z.string()).describe('Array of any red flags identified'),
  insider_ownership_pct: z.number().nullable().optional().describe('Insider ownership percentage'),
  compensation_alignment: z.enum(['aligned', 'neutral', 'misaligned']).optional().describe('Compensation alignment'),
  evidence: z.array(z.string()).describe('Evidence IDs supporting the analysis'),
});

export type ManagementQualityModule = z.infer<typeof ManagementQualityModuleSchema>;

/**
 * Valuation Module Schema
 */
export const ValuationModuleSchema = z.object({
  summary: z.string().min(100).describe('Comprehensive valuation summary'),
  methods_used: z.array(z.enum(['dcf', 'comps', 'sopt', 'precedent'])).describe('Valuation methods used'),
  fair_value_range: z.object({
    low: z.number().describe('Low end of fair value range'),
    base: z.number().describe('Base case fair value'),
    high: z.number().describe('High end of fair value range'),
  }).describe('Fair value range'),
  key_drivers: z.array(z.string()).describe('Key value drivers'),
  margin_of_safety_notes: z.string().describe('Notes on margin of safety'),
  evidence: z.array(z.string()).describe('Evidence IDs supporting the analysis'),
});

export type ValuationModule = z.infer<typeof ValuationModuleSchema>;

/**
 * Risk & Stress Module Schema
 */
export const RiskStressModuleSchema = z.object({
  summary: z.string().min(100).describe('Comprehensive risk summary'),
  top_risks: z.array(z.object({
    risk: z.string().describe('Risk description'),
    probability: z.enum(['high', 'medium', 'low']).describe('Probability'),
    impact: z.enum(['high', 'medium', 'low']).describe('Impact'),
    mitigants: z.array(z.string()).describe('Potential mitigants'),
    early_indicators: z.array(z.string()).describe('Early warning indicators'),
  })).describe('Array of top risks'),
  stress_test_results: z.string().describe('Description of stress test scenarios and results'),
  evidence: z.array(z.string()).describe('Evidence IDs supporting the analysis'),
});

export type RiskStressModule = z.infer<typeof RiskStressModuleSchema>;

/**
 * Combined Research Modules Schema
 */
export const ResearchModulesSchema = z.object({
  business: BusinessModuleSchema.optional(),
  industry_moat: IndustryMoatModuleSchema.optional(),
  financial_forensics: FinancialForensicsModuleSchema.optional(),
  capital_allocation: CapitalAllocationModuleSchema.optional(),
  management_quality: ManagementQualityModuleSchema.optional(),
  valuation: ValuationModuleSchema.optional(),
  risk_stress: RiskStressModuleSchema.optional(),
});

export type ResearchModules = z.infer<typeof ResearchModulesSchema>;
