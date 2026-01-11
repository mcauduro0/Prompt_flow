/**
 * ARC Investment Factory - Monitoring Planner Step
 * 
 * This is an EXPLICIT step in the Lane B pipeline (not merged into modules).
 * 
 * The Monitoring Planner produces:
 * 1. KPIs (at least 5)
 * 2. Signposts (bullish/bearish signals)
 * 3. Invalidation triggers (at least 3)
 * 4. Review schedule with key questions
 * 
 * This step runs AFTER synthesis is complete.
 */

import { z } from 'zod';
import {
  MonitoringPlanSchema,
  PreMortemSchema,
  HistoricalParallelSchema,
  type MonitoringPlan,
  type PreMortem,
  type HistoricalParallel,
} from '@arc/core/validation/research-packet-completion';

// ============================================================================
// MONITORING PLANNER OUTPUT SCHEMA
// ============================================================================

export const MonitoringPlannerOutputSchema = z.object({
  // Monitoring Plan (MANDATORY)
  monitoring_plan: MonitoringPlanSchema,
  
  // Pre-Mortem (MANDATORY)
  pre_mortem: PreMortemSchema,
  
  // Historical Parallels (MANDATORY: at least 2)
  historical_parallels: z.array(HistoricalParallelSchema).min(2),
  
  // Additional monitoring metadata
  metadata: z.object({
    planned_at: z.string(),
    next_review_date: z.string(),
    alert_channels: z.array(z.enum(['email', 'slack', 'dashboard'])),
    automation_enabled: z.boolean(),
  }),
});

export type MonitoringPlannerOutput = z.infer<typeof MonitoringPlannerOutputSchema>;

// ============================================================================
// MONITORING PLANNER STEP
// ============================================================================

export interface MonitoringPlannerInput {
  ticker: string;
  company_name: string;
  thesis: string;
  bull_case: { target_price: number; key_assumptions: string[] };
  bear_case: { target_price: number; key_assumptions: string[] };
  key_risks: string[];
  catalysts: Array<{ name: string; window: string }>;
  time_horizon: string;
  industry: string;
}

/**
 * Monitoring Planner - produces monitoring plan, pre-mortem, and historical parallels
 */
export class MonitoringPlanner {
  private llmClient: any;

  constructor(llmClient: any) {
    this.llmClient = llmClient;
  }

  /**
   * Generate complete monitoring plan
   */
  async plan(input: MonitoringPlannerInput): Promise<MonitoringPlannerOutput> {
    const prompt = this.buildPlanningPrompt(input);

    const llmResponse = await this.llmClient.complete({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an investment monitoring specialist creating a comprehensive monitoring plan.
Your task is to produce:
1. KPIs (at least 5) - specific, measurable metrics to track
2. Signposts - bullish and bearish signals to watch for
3. Invalidation triggers (at least 3) - conditions that would invalidate the thesis
4. Review schedule with key questions
5. Pre-mortem analysis with early warnings (at least 3)
6. Historical parallels (at least 2) with base rate implications

Be specific and actionable. Include data sources and frequencies.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const rawOutput = JSON.parse(llmResponse.content);

    // Validate output
    const validationResult = MonitoringPlannerOutputSchema.safeParse(rawOutput);
    if (!validationResult.success) {
      throw new Error(`Monitoring planner output validation failed: ${validationResult.error.message}`);
    }

    return validationResult.data;
  }

  /**
   * Build planning prompt
   */
  private buildPlanningPrompt(input: MonitoringPlannerInput): string {
    return `
## Company: ${input.company_name} (${input.ticker})
## Industry: ${input.industry}
## Investment Thesis: ${input.thesis}
## Time Horizon: ${input.time_horizon}

## Bull Case:
- Target Price: $${input.bull_case.target_price}
- Key Assumptions:
${input.bull_case.key_assumptions.map((a) => `  - ${a}`).join('\n')}

## Bear Case:
- Target Price: $${input.bear_case.target_price}
- Key Assumptions:
${input.bear_case.key_assumptions.map((a) => `  - ${a}`).join('\n')}

## Key Risks:
${input.key_risks.map((r) => `- ${r}`).join('\n')}

## Catalysts:
${input.catalysts.map((c) => `- ${c.name} (${c.window})`).join('\n')}

Please create a comprehensive monitoring plan with the following JSON structure:
{
  "monitoring_plan": {
    "kpis": [
      {
        "name": "...",
        "current_value": "...",
        "target_value": "...",
        "frequency": "daily|weekly|monthly|quarterly",
        "source": "...",
        "alert_threshold": "..."
      }
      // AT LEAST 5 KPIs
    ],
    "signposts": [
      {
        "description": "...",
        "bullish_signal": "...",
        "bearish_signal": "..."
      }
      // AT LEAST 2 signposts
    ],
    "invalidation_triggers": [
      {
        "trigger": "...",
        "action": "...",
        "severity": "exit_immediately|reduce_position|review_thesis"
      }
      // AT LEAST 3 invalidation triggers
    ],
    "review_schedule": {
      "frequency": "weekly|bi-weekly|monthly",
      "next_review_date": "${this.getNextReviewDate()}",
      "key_questions": ["...", "...", "..."]
    }
  },
  "pre_mortem": {
    "failure_scenario": "...",
    "root_causes": ["...", "..."],
    "early_warnings": ["...", "...", "..."],  // AT LEAST 3
    "probability_estimate": 0.X,
    "timeline_to_failure": "..."
  },
  "historical_parallels": [
    {
      "company_or_situation": "...",
      "time_period": "...",
      "similarity_description": "...",
      "base_rate_implication": "...",  // MANDATORY
      "key_differences": ["..."],  // MANDATORY
      "outcome": "...",
      "relevance_score": 0.X
    }
    // AT LEAST 2 historical parallels
  ],
  "metadata": {
    "planned_at": "${new Date().toISOString()}",
    "next_review_date": "${this.getNextReviewDate()}",
    "alert_channels": ["email", "dashboard"],
    "automation_enabled": true
  }
}

IMPORTANT:
- KPIs must be specific and measurable with clear data sources
- Invalidation triggers must be actionable with clear actions
- Historical parallels MUST include base_rate_implication and key_differences
- Pre-mortem early_warnings must be observable leading indicators
`;
  }

  /**
   * Get next review date based on frequency
   */
  private getNextReviewDate(frequency: 'weekly' | 'bi-weekly' | 'monthly' = 'weekly'): string {
    const now = new Date();
    let nextDate: Date;

    switch (frequency) {
      case 'weekly':
        nextDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'bi-weekly':
        nextDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        nextDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        break;
    }

    return nextDate.toISOString().split('T')[0];
  }

  /**
   * Generate default KPIs based on industry
   */
  generateDefaultKPIs(industry: string, ticker: string): MonitoringPlan['kpis'] {
    const commonKPIs = [
      {
        name: 'Stock Price',
        current_value: 'Current',
        target_value: 'Target',
        frequency: 'daily' as const,
        source: 'Market Data',
        alert_threshold: '±10%',
      },
      {
        name: 'Trading Volume',
        current_value: 'Current',
        target_value: 'Normal',
        frequency: 'daily' as const,
        source: 'Market Data',
        alert_threshold: '2x average',
      },
      {
        name: 'Short Interest',
        current_value: 'Current',
        target_value: 'Baseline',
        frequency: 'weekly' as const,
        source: 'FINRA',
        alert_threshold: '>20%',
      },
    ];

    const industryKPIs: Record<string, MonitoringPlan['kpis']> = {
      technology: [
        {
          name: 'Monthly Active Users',
          current_value: 'Current',
          target_value: 'Growth target',
          frequency: 'monthly' as const,
          source: 'Company reports',
        },
        {
          name: 'Net Revenue Retention',
          current_value: 'Current',
          target_value: '>100%',
          frequency: 'quarterly' as const,
          source: 'Earnings calls',
        },
      ],
      retail: [
        {
          name: 'Same-Store Sales',
          current_value: 'Current',
          target_value: 'Growth target',
          frequency: 'monthly' as const,
          source: 'Company reports',
        },
        {
          name: 'Inventory Turnover',
          current_value: 'Current',
          target_value: 'Industry avg',
          frequency: 'quarterly' as const,
          source: 'SEC filings',
        },
      ],
      financial: [
        {
          name: 'Net Interest Margin',
          current_value: 'Current',
          target_value: 'Target',
          frequency: 'quarterly' as const,
          source: 'Earnings reports',
        },
        {
          name: 'Non-Performing Loans',
          current_value: 'Current',
          target_value: '<2%',
          frequency: 'quarterly' as const,
          source: 'SEC filings',
        },
      ],
    };

    const industrySpecific = industryKPIs[industry.toLowerCase()] || [];
    return [...commonKPIs, ...industrySpecific];
  }

  /**
   * Generate default invalidation triggers
   */
  generateDefaultInvalidationTriggers(
    bearCase: MonitoringPlannerInput['bear_case']
  ): MonitoringPlan['invalidation_triggers'] {
    return [
      {
        trigger: `Stock price falls below bear case target ($${bearCase.target_price})`,
        action: 'Exit position immediately and reassess thesis',
        severity: 'exit_immediately' as const,
      },
      {
        trigger: 'Key assumption proves false: ' + (bearCase.key_assumptions[0] || 'N/A'),
        action: 'Reduce position by 50% and conduct emergency review',
        severity: 'reduce_position' as const,
      },
      {
        trigger: 'Management credibility event (fraud, resignation, guidance miss >20%)',
        action: 'Exit position immediately',
        severity: 'exit_immediately' as const,
      },
      {
        trigger: 'Competitive moat erosion (market share loss >5% in single quarter)',
        action: 'Review thesis and consider reducing position',
        severity: 'review_thesis' as const,
      },
    ];
  }
}

export default MonitoringPlanner;
