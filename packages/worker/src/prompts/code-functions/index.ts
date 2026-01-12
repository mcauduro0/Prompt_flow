/**
 * ARC Investment Factory - Code Functions Registry
 * 
 * Registry of deterministic functions that can be called by prompts
 * with executor_type: code or hybrid.
 * 
 * Gates MUST be deterministic and run BEFORE LLM calls.
 */

import { type ExecutionContext } from '../types.js';

// ============================================================================
// FUNCTION TYPE
// ============================================================================

export type CodeFunction = (
  context: ExecutionContext,
  data: Record<string, unknown>
) => Promise<unknown>;

// ============================================================================
// FUNCTION REGISTRY
// ============================================================================

const functionRegistry: Map<string, CodeFunction> = new Map();

/**
 * Register a code function
 */
export function registerCodeFunction(name: string, fn: CodeFunction): void {
  functionRegistry.set(name, fn);
}

/**
 * Get a code function by name
 */
export function getCodeFunction(name: string): CodeFunction | undefined {
  return functionRegistry.get(name);
}

/**
 * List all registered functions
 */
export function listCodeFunctions(): string[] {
  return Array.from(functionRegistry.keys());
}

// ============================================================================
// GATE: DATA SUFFICIENCY
// ============================================================================

registerCodeFunction('gate_data_sufficiency', async (context, data) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metrics: Record<string, unknown> = {};

  // Check profile data
  const profile = data.profile as Record<string, unknown> | undefined;
  if (!profile) {
    errors.push('Missing company profile data');
  } else {
    metrics.has_profile = true;
    if (!profile.sector) warnings.push('Missing sector information');
    if (!profile.industry) warnings.push('Missing industry information');
    if (!profile.marketCap) warnings.push('Missing market cap');
  }

  // Check financial metrics
  const financialMetrics = data.metrics as Record<string, unknown> | undefined;
  if (!financialMetrics) {
    errors.push('Missing financial metrics');
  } else {
    metrics.has_metrics = true;
    const requiredMetrics = ['pe', 'evToEbitda', 'roic', 'grossMargin'];
    const missingMetrics = requiredMetrics.filter(m => financialMetrics[m] === undefined);
    if (missingMetrics.length > 0) {
      warnings.push(`Missing metrics: ${missingMetrics.join(', ')}`);
    }
    metrics.metrics_coverage = (requiredMetrics.length - missingMetrics.length) / requiredMetrics.length;
  }

  // Check price data
  const price = data.price as Record<string, unknown> | undefined;
  if (!price) {
    warnings.push('Missing price data');
  } else {
    metrics.has_price = true;
  }

  // Decision
  const pass = errors.length === 0;
  const score = pass ? (warnings.length === 0 ? 1.0 : 0.7) : 0.0;

  return {
    gate: 'DATA_SUFFICIENCY',
    pass,
    score,
    errors,
    warnings,
    metrics,
    decision_reason: pass
      ? `Data sufficiency check passed with ${warnings.length} warnings`
      : `Data sufficiency check failed: ${errors.join('; ')}`,
  };
});

// ============================================================================
// GATE: COHERENCE
// ============================================================================

registerCodeFunction('gate_coherence', async (context, data) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metrics: Record<string, unknown> = {};

  const thesis = data.thesis as string | undefined;
  const bullCase = data.bull_case as string | undefined;
  const bearCase = data.bear_case as string | undefined;
  const catalysts = data.catalysts as Array<{ name: string; window: string }> | undefined;
  const timeHorizon = data.time_horizon as string | undefined;

  // Check thesis exists
  if (!thesis || thesis.length < 50) {
    errors.push('Thesis is missing or too short (min 50 chars)');
  } else {
    metrics.thesis_length = thesis.length;
  }

  // Check bull/bear cases are distinct
  if (bullCase && bearCase) {
    const similarity = calculateTextSimilarity(bullCase, bearCase);
    metrics.bull_bear_similarity = similarity;
    if (similarity > 0.7) {
      warnings.push('Bull and bear cases are too similar');
    }
  }

  // Check catalysts align with time horizon
  if (catalysts && timeHorizon) {
    const horizonMonths = parseTimeHorizon(timeHorizon);
    const catalystWindows = catalysts.map(c => parseTimeHorizon(c.window));
    const maxCatalystWindow = Math.max(...catalystWindows);
    
    if (maxCatalystWindow > horizonMonths * 1.5) {
      warnings.push('Some catalysts extend beyond investment time horizon');
    }
    metrics.catalyst_alignment = maxCatalystWindow <= horizonMonths;
  }

  const pass = errors.length === 0;
  const score = pass ? (warnings.length === 0 ? 1.0 : 0.8) : 0.0;

  return {
    gate: 'COHERENCE',
    pass,
    score,
    errors,
    warnings,
    metrics,
    decision_reason: pass
      ? `Coherence check passed with ${warnings.length} warnings`
      : `Coherence check failed: ${errors.join('; ')}`,
  };
});

// ============================================================================
// GATE: EDGE CLAIM
// ============================================================================

registerCodeFunction('gate_edge_claim', async (context, data) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metrics: Record<string, unknown> = {};

  const edgeType = data.edge_type as string[] | undefined;
  const edgeExplanation = data.edge_explanation as string | undefined;
  const thesis = data.thesis as string | undefined;

  // Check edge type is specified
  if (!edgeType || edgeType.length === 0) {
    errors.push('No edge type specified');
  } else {
    metrics.edge_types = edgeType;
    metrics.edge_count = edgeType.length;
  }

  // Check edge explanation exists
  if (!edgeExplanation || edgeExplanation.length < 100) {
    errors.push('Edge explanation is missing or too short (min 100 chars)');
  } else {
    metrics.edge_explanation_length = edgeExplanation.length;
    
    // Check for testable/falsifiable language
    const testableKeywords = ['if', 'when', 'will', 'should', 'expect', 'prove', 'disprove'];
    const hasTestableLanguage = testableKeywords.some(kw => 
      edgeExplanation.toLowerCase().includes(kw)
    );
    if (!hasTestableLanguage) {
      warnings.push('Edge claim may not be testable/falsifiable');
    }
    metrics.has_testable_language = hasTestableLanguage;
  }

  // Check edge is not common knowledge
  const commonKnowledgePatterns = [
    'everyone knows',
    'well known',
    'common knowledge',
    'widely understood',
    'consensus view',
  ];
  const isCommonKnowledge = commonKnowledgePatterns.some(pattern =>
    (edgeExplanation || '').toLowerCase().includes(pattern)
  );
  if (isCommonKnowledge) {
    warnings.push('Edge claim appears to be common knowledge');
  }
  metrics.is_common_knowledge = isCommonKnowledge;

  const pass = errors.length === 0;
  const score = pass ? (warnings.length === 0 ? 1.0 : 0.7) : 0.0;

  return {
    gate: 'EDGE_CLAIM',
    pass,
    score,
    errors,
    warnings,
    metrics,
    decision_reason: pass
      ? `Edge claim check passed with ${warnings.length} warnings`
      : `Edge claim check failed: ${errors.join('; ')}`,
  };
});

// ============================================================================
// GATE: DOWNSIDE SANITY
// ============================================================================

registerCodeFunction('gate_downside_sanity', async (context, data) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metrics: Record<string, unknown> = {};
  const binary_overrides: string[] = [];

  const bearCasePrice = data.bear_case_price as number | undefined;
  const currentPrice = data.current_price as number | undefined;
  const stopLoss = data.stop_loss as number | undefined;
  const risks = data.key_risks as string[] | undefined;
  const leverageRisk = data.leverage_risk as string | undefined;
  const liquidityRisk = data.liquidity_risk as string | undefined;
  const regulatoryRisk = data.regulatory_risk as string | undefined;

  // Check bear case price is defined
  if (bearCasePrice === undefined) {
    errors.push('Bear case price target not defined');
  } else if (currentPrice) {
    const downsidePercent = ((currentPrice - bearCasePrice) / currentPrice) * 100;
    metrics.downside_percent = downsidePercent;
    
    if (downsidePercent > 50) {
      errors.push(`Downside is catastrophic (${downsidePercent.toFixed(1)}% loss)`);
    } else if (downsidePercent > 30) {
      warnings.push(`Significant downside risk (${downsidePercent.toFixed(1)}% loss)`);
    }
  }

  // Check stop-loss is defined
  if (stopLoss === undefined) {
    warnings.push('No stop-loss or exit trigger defined');
  } else {
    metrics.stop_loss = stopLoss;
  }

  // Check key risks are identified
  if (!risks || risks.length === 0) {
    errors.push('No key risks identified');
  } else {
    metrics.risk_count = risks.length;
  }

  // BINARY OVERRIDES - These cause immediate failure
  if (leverageRisk === 'dominant') {
    binary_overrides.push('leverage_risk_dominant');
  }
  if (liquidityRisk === 'dominant') {
    binary_overrides.push('liquidity_risk_dominant');
  }
  if (regulatoryRisk === 'dominant') {
    binary_overrides.push('regulatory_cliff_dominant');
  }

  const hasBinaryOverride = binary_overrides.length > 0;
  const pass = errors.length === 0 && !hasBinaryOverride;
  const score = hasBinaryOverride ? 0.0 : (pass ? (warnings.length === 0 ? 1.0 : 0.7) : 0.0);

  return {
    gate: 'DOWNSIDE_SANITY',
    pass,
    score,
    errors,
    warnings,
    metrics,
    binary_overrides,
    decision_reason: hasBinaryOverride
      ? `Binary override triggered: ${binary_overrides.join(', ')}`
      : pass
        ? `Downside sanity check passed with ${warnings.length} warnings`
        : `Downside sanity check failed: ${errors.join('; ')}`,
  };
});

// ============================================================================
// GATE: STYLE FIT
// ============================================================================

registerCodeFunction('gate_style_fit', async (context, data) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metrics: Record<string, unknown> = {};

  const styleTag = data.style_tag as string | undefined;
  const roic = data.roic as number | undefined;
  const pe = data.pe as number | undefined;
  const evToEbitda = data.ev_to_ebitda as number | undefined;
  const fcfYield = data.fcf_yield as number | undefined;
  const revenueGrowth = data.revenue_growth as number | undefined;
  const moatScore = data.moat_score as number | undefined;

  if (!styleTag) {
    errors.push('Style tag not specified');
    return {
      gate: 'STYLE_FIT',
      pass: false,
      score: 0,
      errors,
      warnings,
      metrics,
      decision_reason: 'Style tag not specified',
    };
  }

  metrics.style_tag = styleTag;

  switch (styleTag) {
    case 'quality_compounder':
      // Quality requirements
      if (roic !== undefined && roic < 15) {
        errors.push(`ROIC (${roic}%) below quality threshold (15%)`);
      }
      if (moatScore !== undefined && moatScore < 3) {
        warnings.push(`Moat score (${moatScore}) is weak for quality compounder`);
      }
      metrics.quality_fit = (roic || 0) >= 15 && (moatScore || 0) >= 3;
      break;

    case 'garp':
      // GARP requirements
      if (pe !== undefined && revenueGrowth !== undefined) {
        const peg = pe / revenueGrowth;
        metrics.peg_ratio = peg;
        if (peg > 2) {
          warnings.push(`PEG ratio (${peg.toFixed(2)}) is high for GARP`);
        }
      }
      metrics.garp_fit = true;
      break;

    case 'cigar_butt':
      // Deep value requirements
      if (evToEbitda !== undefined && evToEbitda > 8) {
        warnings.push(`EV/EBITDA (${evToEbitda}) is high for deep value`);
      }
      if (fcfYield !== undefined && fcfYield < 8) {
        warnings.push(`FCF yield (${fcfYield}%) is low for deep value`);
      }
      metrics.value_fit = (evToEbitda || 99) <= 8 || (fcfYield || 0) >= 8;
      break;

    default:
      warnings.push(`Unknown style tag: ${styleTag}`);
  }

  const pass = errors.length === 0;
  const score = pass ? (warnings.length === 0 ? 1.0 : 0.7) : 0.0;

  return {
    gate: 'STYLE_FIT',
    pass,
    score,
    errors,
    warnings,
    metrics,
    decision_reason: pass
      ? `Style fit check passed for ${styleTag} with ${warnings.length} warnings`
      : `Style fit check failed: ${errors.join('; ')}`,
  };
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

function parseTimeHorizon(horizon: string): number {
  const lower = horizon.toLowerCase();
  
  if (lower.includes('month')) {
    const match = lower.match(/(\d+)/);
    return match ? parseInt(match[1]) : 6;
  }
  
  if (lower.includes('year')) {
    const match = lower.match(/(\d+)/);
    return match ? parseInt(match[1]) * 12 : 12;
  }
  
  if (lower.includes('quarter')) {
    const match = lower.match(/(\d+)/);
    return match ? parseInt(match[1]) * 3 : 3;
  }
  
  // Default patterns
  if (lower.includes('1_3_years') || lower.includes('1-3 years')) return 24;
  if (lower.includes('6_12_months') || lower.includes('6-12 months')) return 9;
  if (lower.includes('short')) return 3;
  if (lower.includes('medium')) return 12;
  if (lower.includes('long')) return 36;
  
  return 12; // Default to 1 year
}

// ============================================================================
// PRE/POST PROCESSING FUNCTIONS
// ============================================================================

registerCodeFunction('preprocess_financial_data', async (context, data) => {
  // Normalize and clean financial data before LLM processing
  const metrics = data.metrics as Record<string, unknown> | undefined;
  
  if (!metrics) return data;
  
  const normalized: Record<string, unknown> = { ...data };
  
  // Convert percentages to decimals if needed
  const percentFields = ['roic', 'roe', 'grossMargin', 'ebitMargin', 'fcfYield'];
  for (const field of percentFields) {
    if (metrics[field] !== undefined && typeof metrics[field] === 'number') {
      const value = metrics[field] as number;
      // If value > 1, assume it's already a percentage
      if (value > 1) {
        (normalized.metrics as Record<string, unknown>)[field] = value;
      } else {
        (normalized.metrics as Record<string, unknown>)[field] = value * 100;
      }
    }
  }
  
  return normalized;
});

registerCodeFunction('postprocess_idea_output', async (context, data) => {
  // Validate and enrich LLM output
  const llmOutput = data.llm_output as Record<string, unknown>;
  
  if (!llmOutput) return data;
  
  // Ensure conviction is within bounds
  if (typeof llmOutput.conviction === 'number') {
    llmOutput.conviction = Math.max(1, Math.min(10, llmOutput.conviction));
  }
  
  // Add metadata
  llmOutput.generated_at = new Date().toISOString();
  llmOutput.context_ticker = context.ticker;
  llmOutput.context_date = context.date;
  
  return llmOutput;
});

registerCodeFunction('postprocess_research_module', async (context, data) => {
  // Score and validate research module output
  const llmOutput = data.llm_output as Record<string, unknown>;
  
  if (!llmOutput) return data;
  
  // Calculate confidence based on evidence count
  const evidence = llmOutput.evidence as Array<unknown> | undefined;
  if (evidence) {
    llmOutput.evidence_count = evidence.length;
    llmOutput.confidence_boost = Math.min(0.2, evidence.length * 0.05);
  }
  
  return llmOutput;
});
