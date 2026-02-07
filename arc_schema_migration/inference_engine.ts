// ============================================================================
// ARC IC MEMO INFERENCE ENGINE
// Infere campos ausentes dos IC Memos existentes usando o conteúdo estruturado
// ============================================================================

import { db } from '@arc/database';
import { icMemos } from '@arc/database/models/schema';
import { eq, isNull, and, sql } from 'drizzle-orm';

// ============================================================================
// TIPOS
// ============================================================================

interface ICMemoContent {
  executive_summary: {
    opportunity: string;
    why_now: string;
    risk_reward_asymmetry: string;
    decision_required: string;
  };
  investment_thesis: {
    central_thesis: string;
    value_creation_mechanism: string;
    sustainability: string;
    structural_vs_cyclical: string;
  };
  business_analysis: {
    how_company_makes_money: string;
    competitive_advantages: string[];
    competitive_weaknesses: string[];
    industry_structure: string;
    competitive_dynamics: string;
    barriers_to_entry: string;
    pricing_power: string;
    disruption_risks: string;
  };
  financial_quality: {
    revenue_quality: string;
    margin_analysis: string;
    capital_intensity: string;
    return_on_capital: string;
    accounting_distortions: string[];
    earnings_quality_risks: string[];
    growth_capital_dynamics: string;
  };
  valuation: {
    methodology: string;
    key_assumptions: string[];
    sensitivities: string[];
    value_range: {
      bear: number;
      base: number;
      bull: number;
    };
    expected_return: string;
    opportunity_cost: string;
  };
  risks: {
    material_risks: Array<{
      risk: string;
      manifestation: string;
      impact: string;
      early_signals: string[];
    }>;
    thesis_error_risks: string[];
    asymmetric_risks: string[];
  };
  variant_perception: {
    consensus_view: string;
    our_view: string;
    why_market_wrong: string;
    confirming_facts: string[];
    invalidating_facts: string[];
  };
  catalysts: {
    value_unlocking_events: Array<{
      event: string;
      timeline: string;
      controllable: boolean;
    }>;
    expected_horizon: string;
  };
  portfolio_fit: {
    portfolio_role: string;
    correlation: string;
    concentration_impact: string;
    liquidity: string;
    drawdown_impact: string;
    sizing_rationale: string;
    suggested_position_size: string;
  };
  decision: {
    recommendation: string;
    revisit_conditions: string[];
    change_of_mind_triggers: string[];
  };
}

type ThesisPrimaryType = 'quality_compounder' | 'value' | 'turnaround' | 'contrarian' | 'special_situation' | 'macro_proxy';
type RiskPrimaryCategory = 'structural' | 'cyclical' | 'regulatory' | 'financial' | 'execution' | 'macro';
type IndustryStructure = 'fragmented' | 'oligopoly' | 'monopoly' | 'disrupted';
type CatalystType = 'earnings' | 'regulatory' | 'strategic' | 'macro' | 'technical';
type CatalystStrength = 'weak' | 'medium' | 'strong';
type PortfolioRole = 'core' | 'opportunistic' | 'tactical' | 'monitor_only';

// ============================================================================
// FUNÇÕES DE INFERÊNCIA
// ============================================================================

/**
 * Infere o tipo primário da tese baseado no styleTag e conteúdo do memo
 */
function inferThesisPrimaryType(styleTag: string, content: ICMemoContent): { value: ThesisPrimaryType; confidence: number } {
  const thesis = content.investment_thesis?.central_thesis?.toLowerCase() || '';
  const structural = content.investment_thesis?.structural_vs_cyclical?.toLowerCase() || '';
  
  // Mapeamento direto do styleTag
  const styleMapping: Record<string, ThesisPrimaryType> = {
    'quality_compounder': 'quality_compounder',
    'deep_value': 'value',
    'turnaround': 'turnaround',
    'contrarian': 'contrarian',
    'special_situation': 'special_situation',
    'growth_at_reasonable_price': 'quality_compounder',
    'dividend_growth': 'quality_compounder',
    'cyclical_value': 'value',
    'event_driven': 'special_situation',
  };
  
  if (styleMapping[styleTag]) {
    return { value: styleMapping[styleTag], confidence: 0.9 };
  }
  
  // Inferência por palavras-chave
  if (thesis.includes('compounder') || thesis.includes('compound') || thesis.includes('reinvest')) {
    return { value: 'quality_compounder', confidence: 0.7 };
  }
  if (thesis.includes('turnaround') || thesis.includes('recovery') || thesis.includes('restructur')) {
    return { value: 'turnaround', confidence: 0.7 };
  }
  if (thesis.includes('undervalued') || thesis.includes('discount') || thesis.includes('cheap')) {
    return { value: 'value', confidence: 0.6 };
  }
  if (thesis.includes('contrarian') || thesis.includes('against consensus') || thesis.includes('market wrong')) {
    return { value: 'contrarian', confidence: 0.6 };
  }
  if (thesis.includes('special situation') || thesis.includes('spin-off') || thesis.includes('merger')) {
    return { value: 'special_situation', confidence: 0.7 };
  }
  if (thesis.includes('macro') || thesis.includes('cycle') || thesis.includes('economic')) {
    return { value: 'macro_proxy', confidence: 0.5 };
  }
  
  // Default baseado em qualityScore
  return { value: 'value', confidence: 0.3 };
}

/**
 * Infere o horizonte de tempo da tese em meses
 */
function inferTimeHorizon(content: ICMemoContent): { value: number; confidence: number } {
  const horizon = content.catalysts?.expected_horizon?.toLowerCase() || '';
  const catalysts = content.catalysts?.value_unlocking_events || [];
  
  // Extrair números do texto
  const monthMatch = horizon.match(/(\d+)\s*month/i);
  const yearMatch = horizon.match(/(\d+)\s*year/i);
  const quarterMatch = horizon.match(/(\d+)\s*quarter/i);
  
  if (monthMatch) {
    return { value: parseInt(monthMatch[1]), confidence: 0.9 };
  }
  if (yearMatch) {
    return { value: parseInt(yearMatch[1]) * 12, confidence: 0.9 };
  }
  if (quarterMatch) {
    return { value: parseInt(quarterMatch[1]) * 3, confidence: 0.8 };
  }
  
  // Inferir por palavras-chave
  if (horizon.includes('short') || horizon.includes('near-term')) {
    return { value: 6, confidence: 0.5 };
  }
  if (horizon.includes('medium') || horizon.includes('mid-term')) {
    return { value: 12, confidence: 0.5 };
  }
  if (horizon.includes('long') || horizon.includes('multi-year')) {
    return { value: 36, confidence: 0.5 };
  }
  
  // Inferir pelos catalysts
  if (catalysts.length > 0) {
    const timelines = catalysts.map(c => c.timeline?.toLowerCase() || '');
    if (timelines.some(t => t.includes('q1') || t.includes('q2'))) {
      return { value: 6, confidence: 0.4 };
    }
  }
  
  // Default
  return { value: 18, confidence: 0.2 };
}

/**
 * Calcula o thesis style vector baseado no conteúdo
 */
function inferThesisStyleVector(content: ICMemoContent, qualityScore: number | null): {
  value: {
    quality_exposure: number;
    cyclicality_exposure: number;
    structural_risk_exposure: number;
    macro_dependency: number;
    execution_dependency: number;
  };
  confidence: number;
} {
  const structural = content.investment_thesis?.structural_vs_cyclical?.toLowerCase() || '';
  const risks = content.risks?.material_risks || [];
  const thesis = content.investment_thesis?.central_thesis?.toLowerCase() || '';
  
  // Quality exposure baseado no qualityScore
  const qualityExposure = qualityScore ? Math.min(qualityScore / 100, 1) : 0.5;
  
  // Cyclicality exposure
  let cyclicalityExposure = 0.5;
  if (structural.includes('cyclical') || structural.includes('cycle')) {
    cyclicalityExposure = 0.8;
  } else if (structural.includes('structural') || structural.includes('secular')) {
    cyclicalityExposure = 0.2;
  }
  
  // Structural risk exposure
  const structuralRisks = risks.filter(r => 
    r.risk?.toLowerCase().includes('structural') ||
    r.risk?.toLowerCase().includes('disruption') ||
    r.risk?.toLowerCase().includes('obsolescence')
  );
  const structuralRiskExposure = Math.min(structuralRisks.length * 0.25, 1);
  
  // Macro dependency
  let macroDependency = 0.3;
  if (thesis.includes('macro') || thesis.includes('economic') || thesis.includes('interest rate')) {
    macroDependency = 0.7;
  }
  
  // Execution dependency
  const executionRisks = risks.filter(r =>
    r.risk?.toLowerCase().includes('execution') ||
    r.risk?.toLowerCase().includes('management') ||
    r.risk?.toLowerCase().includes('integration')
  );
  const executionDependency = Math.min(executionRisks.length * 0.3, 1);
  
  return {
    value: {
      quality_exposure: qualityExposure,
      cyclicality_exposure: cyclicalityExposure,
      structural_risk_exposure: structuralRiskExposure,
      macro_dependency: macroDependency,
      execution_dependency: executionDependency,
    },
    confidence: 0.5,
  };
}

/**
 * Calcula o asymmetry score baseado nos price targets
 */
function calculateAsymmetryScore(
  currentPrice: number,
  bearCase: number,
  baseCase: number,
  bullCase: number
): { value: number; confidence: number } {
  if (!currentPrice || !bearCase || !baseCase || !bullCase) {
    return { value: 50, confidence: 0.1 };
  }
  
  const upside = ((baseCase - currentPrice) / currentPrice) * 100;
  const downside = ((currentPrice - bearCase) / currentPrice) * 100;
  const bullUpside = ((bullCase - currentPrice) / currentPrice) * 100;
  
  // Asymmetry = Upside / Downside ratio normalizado para 0-100
  // Score > 50 = favorável (mais upside que downside)
  // Score < 50 = desfavorável
  
  if (downside <= 0) {
    return { value: 100, confidence: 0.8 };
  }
  
  const ratio = upside / downside;
  
  // Normalizar para 0-100 usando função sigmoide
  const asymmetryScore = 100 / (1 + Math.exp(-0.5 * (ratio - 1)));
  
  return {
    value: Math.round(asymmetryScore * 100) / 100,
    confidence: 0.8,
  };
}

/**
 * Calcula o expected return probability weighted
 * Assume probabilidades: Bear 20%, Base 60%, Bull 20%
 */
function calculateExpectedReturnProbabilityWeighted(
  currentPrice: number,
  bearCase: number,
  baseCase: number,
  bullCase: number,
  bearProb: number = 0.2,
  baseProb: number = 0.6,
  bullProb: number = 0.2
): { value: number; confidence: number } {
  if (!currentPrice || !bearCase || !baseCase || !bullCase) {
    return { value: 0, confidence: 0.1 };
  }
  
  const bearReturn = ((bearCase - currentPrice) / currentPrice) * 100;
  const baseReturn = ((baseCase - currentPrice) / currentPrice) * 100;
  const bullReturn = ((bullCase - currentPrice) / currentPrice) * 100;
  
  const expectedReturn = (bearReturn * bearProb) + (baseReturn * baseProb) + (bullReturn * bullProb);
  
  return {
    value: Math.round(expectedReturn * 100) / 100,
    confidence: 0.7,
  };
}

/**
 * Infere a categoria primária de risco
 */
function inferRiskPrimaryCategory(content: ICMemoContent): { value: RiskPrimaryCategory; confidence: number } {
  const risks = content.risks?.material_risks || [];
  
  const riskCounts: Record<RiskPrimaryCategory, number> = {
    structural: 0,
    cyclical: 0,
    regulatory: 0,
    financial: 0,
    execution: 0,
    macro: 0,
  };
  
  for (const risk of risks) {
    const riskText = (risk.risk || '').toLowerCase();
    
    if (riskText.includes('structural') || riskText.includes('disruption') || riskText.includes('technology')) {
      riskCounts.structural++;
    }
    if (riskText.includes('cyclical') || riskText.includes('cycle') || riskText.includes('demand')) {
      riskCounts.cyclical++;
    }
    if (riskText.includes('regulatory') || riskText.includes('regulation') || riskText.includes('legal')) {
      riskCounts.regulatory++;
    }
    if (riskText.includes('financial') || riskText.includes('debt') || riskText.includes('leverage') || riskText.includes('liquidity')) {
      riskCounts.financial++;
    }
    if (riskText.includes('execution') || riskText.includes('management') || riskText.includes('integration')) {
      riskCounts.execution++;
    }
    if (riskText.includes('macro') || riskText.includes('economic') || riskText.includes('interest')) {
      riskCounts.macro++;
    }
  }
  
  const maxCategory = Object.entries(riskCounts).reduce((a, b) => a[1] > b[1] ? a : b);
  
  if (maxCategory[1] === 0) {
    return { value: 'execution', confidence: 0.2 };
  }
  
  return {
    value: maxCategory[0] as RiskPrimaryCategory,
    confidence: Math.min(maxCategory[1] / risks.length, 0.8),
  };
}

/**
 * Infere a estrutura da indústria
 */
function inferIndustryStructure(content: ICMemoContent): { value: IndustryStructure; confidence: number } {
  const structure = content.business_analysis?.industry_structure?.toLowerCase() || '';
  const dynamics = content.business_analysis?.competitive_dynamics?.toLowerCase() || '';
  const barriers = content.business_analysis?.barriers_to_entry?.toLowerCase() || '';
  
  const text = `${structure} ${dynamics} ${barriers}`;
  
  if (text.includes('monopol') || text.includes('dominant') || text.includes('sole provider')) {
    return { value: 'monopoly', confidence: 0.7 };
  }
  if (text.includes('oligopol') || text.includes('few players') || text.includes('concentrated')) {
    return { value: 'oligopoly', confidence: 0.7 };
  }
  if (text.includes('fragment') || text.includes('many competitors') || text.includes('commoditized')) {
    return { value: 'fragmented', confidence: 0.7 };
  }
  if (text.includes('disrupt') || text.includes('transformation') || text.includes('new entrants')) {
    return { value: 'disrupted', confidence: 0.6 };
  }
  
  return { value: 'fragmented', confidence: 0.2 };
}

/**
 * Infere o tipo de catalyst
 */
function inferCatalystType(content: ICMemoContent): { value: CatalystType; confidence: number } {
  const catalysts = content.catalysts?.value_unlocking_events || [];
  
  const typeCounts: Record<CatalystType, number> = {
    earnings: 0,
    regulatory: 0,
    strategic: 0,
    macro: 0,
    technical: 0,
  };
  
  for (const catalyst of catalysts) {
    const text = (catalyst.event || '').toLowerCase();
    
    if (text.includes('earnings') || text.includes('revenue') || text.includes('margin') || text.includes('guidance')) {
      typeCounts.earnings++;
    }
    if (text.includes('regulatory') || text.includes('approval') || text.includes('fda') || text.includes('license')) {
      typeCounts.regulatory++;
    }
    if (text.includes('acquisition') || text.includes('merger') || text.includes('spin') || text.includes('strategic')) {
      typeCounts.strategic++;
    }
    if (text.includes('macro') || text.includes('rate') || text.includes('economic') || text.includes('cycle')) {
      typeCounts.macro++;
    }
    if (text.includes('technical') || text.includes('breakout') || text.includes('momentum')) {
      typeCounts.technical++;
    }
  }
  
  const maxType = Object.entries(typeCounts).reduce((a, b) => a[1] > b[1] ? a : b);
  
  if (maxType[1] === 0) {
    return { value: 'earnings', confidence: 0.2 };
  }
  
  return {
    value: maxType[0] as CatalystType,
    confidence: Math.min(maxType[1] / catalysts.length, 0.8),
  };
}

/**
 * Infere a força do catalyst
 */
function inferCatalystStrength(content: ICMemoContent): { value: CatalystStrength; confidence: number } {
  const catalysts = content.catalysts?.value_unlocking_events || [];
  
  if (catalysts.length === 0) {
    return { value: 'weak', confidence: 0.3 };
  }
  
  // Contar catalysts controláveis vs não controláveis
  const controllable = catalysts.filter(c => c.controllable).length;
  const ratio = controllable / catalysts.length;
  
  // Mais catalysts controláveis = mais forte
  if (ratio > 0.6 && catalysts.length >= 2) {
    return { value: 'strong', confidence: 0.7 };
  }
  if (ratio > 0.3 || catalysts.length >= 3) {
    return { value: 'medium', confidence: 0.6 };
  }
  
  return { value: 'weak', confidence: 0.5 };
}

/**
 * Infere o portfolio role
 */
function inferPortfolioRole(content: ICMemoContent): { value: PortfolioRole; confidence: number } {
  const role = content.portfolio_fit?.portfolio_role?.toLowerCase() || '';
  
  if (role.includes('core') || role.includes('anchor') || role.includes('foundation')) {
    return { value: 'core', confidence: 0.8 };
  }
  if (role.includes('opportunistic') || role.includes('tactical')) {
    return { value: 'opportunistic', confidence: 0.8 };
  }
  if (role.includes('tactical') || role.includes('trade')) {
    return { value: 'tactical', confidence: 0.8 };
  }
  if (role.includes('monitor') || role.includes('watch') || role.includes('wait')) {
    return { value: 'monitor_only', confidence: 0.8 };
  }
  
  // Inferir pelo sizing
  const sizing = content.portfolio_fit?.suggested_position_size?.toLowerCase() || '';
  if (sizing.includes('5%') || sizing.includes('large') || sizing.includes('full')) {
    return { value: 'core', confidence: 0.5 };
  }
  if (sizing.includes('1%') || sizing.includes('2%') || sizing.includes('small')) {
    return { value: 'tactical', confidence: 0.5 };
  }
  
  return { value: 'opportunistic', confidence: 0.3 };
}

/**
 * Calcula o Investability Score Standalone
 * Combina: Quality (30%), Asymmetry (25%), Catalyst Clarity (20%), Conviction (25%)
 */
function calculateInvestabilityScoreStandalone(
  qualityScore: number | null,
  asymmetryScore: number | null,
  catalystClarityScore: number | null,
  conviction: number | null
): { value: number; confidence: number } {
  const weights = {
    quality: 0.30,
    asymmetry: 0.25,
    catalyst: 0.20,
    conviction: 0.25,
  };
  
  let score = 0;
  let totalWeight = 0;
  let confidence = 0;
  
  if (qualityScore !== null) {
    score += qualityScore * weights.quality;
    totalWeight += weights.quality;
    confidence += 0.25;
  }
  
  if (asymmetryScore !== null) {
    score += asymmetryScore * weights.asymmetry;
    totalWeight += weights.asymmetry;
    confidence += 0.25;
  }
  
  if (catalystClarityScore !== null) {
    // Normalizar de 0-10 para 0-100
    score += (catalystClarityScore * 10) * weights.catalyst;
    totalWeight += weights.catalyst;
    confidence += 0.25;
  }
  
  if (conviction !== null) {
    // Normalizar de 1-10 para 0-100
    score += (conviction * 10) * weights.conviction;
    totalWeight += weights.conviction;
    confidence += 0.25;
  }
  
  if (totalWeight === 0) {
    return { value: 50, confidence: 0.1 };
  }
  
  return {
    value: Math.round((score / totalWeight) * 100) / 100,
    confidence,
  };
}

/**
 * Extrai o suggested position size do texto
 */
function extractPositionSize(text: string): { min: number; max: number } | null {
  if (!text) return null;
  
  // Padrões: "2-3%", "2% to 3%", "up to 5%", "3%"
  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*%/i);
  if (rangeMatch) {
    return {
      min: parseFloat(rangeMatch[1]),
      max: parseFloat(rangeMatch[2]),
    };
  }
  
  const singleMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (singleMatch) {
    const value = parseFloat(singleMatch[1]);
    return {
      min: value * 0.5,
      max: value,
    };
  }
  
  return null;
}

// ============================================================================
// FUNÇÃO PRINCIPAL DE INFERÊNCIA
// ============================================================================

export interface InferenceResult {
  thesisPrimaryType: ThesisPrimaryType | null;
  thesisSecondaryType: string | null;
  thesisTimeHorizonMonths: number | null;
  thesisStyleVector: any;
  asymmetryScore: number | null;
  expectedReturnProbabilityWeightedPct: number | null;
  baseCaseUpsidePct: number | null;
  bullCaseUpsidePct: number | null;
  bearCaseDownsidePct: number | null;
  riskPrimaryCategory: RiskPrimaryCategory | null;
  industryStructure: IndustryStructure | null;
  catalystType: CatalystType | null;
  catalystStrength: CatalystStrength | null;
  catalystClarityScore: number | null;
  portfolioRole: PortfolioRole | null;
  suggestedPositionSizeMinPct: number | null;
  suggestedPositionSizeMaxPct: number | null;
  investabilityScoreStandalone: number | null;
  inferredFields: string[];
  inferenceConfidence: Record<string, number>;
}

export async function inferMemoFields(
  memoContent: ICMemoContent,
  styleTag: string,
  qualityScore: number | null,
  conviction: number | null,
  currentPrice?: number
): Promise<InferenceResult> {
  const inferredFields: string[] = [];
  const inferenceConfidence: Record<string, number> = {};
  
  // Thesis Primary Type
  const thesisType = inferThesisPrimaryType(styleTag, memoContent);
  inferredFields.push('thesisPrimaryType');
  inferenceConfidence['thesisPrimaryType'] = thesisType.confidence;
  
  // Time Horizon
  const timeHorizon = inferTimeHorizon(memoContent);
  inferredFields.push('thesisTimeHorizonMonths');
  inferenceConfidence['thesisTimeHorizonMonths'] = timeHorizon.confidence;
  
  // Style Vector
  const styleVector = inferThesisStyleVector(memoContent, qualityScore);
  inferredFields.push('thesisStyleVector');
  inferenceConfidence['thesisStyleVector'] = styleVector.confidence;
  
  // Price targets e asymmetry
  const valueRange = memoContent.valuation?.value_range;
  const price = currentPrice || valueRange?.base; // Use base case as proxy if no current price
  
  let asymmetry = { value: 50, confidence: 0.1 };
  let expectedReturn = { value: 0, confidence: 0.1 };
  let baseCaseUpside = null;
  let bullCaseUpside = null;
  let bearCaseDownside = null;
  
  if (price && valueRange) {
    asymmetry = calculateAsymmetryScore(price, valueRange.bear, valueRange.base, valueRange.bull);
    expectedReturn = calculateExpectedReturnProbabilityWeighted(price, valueRange.bear, valueRange.base, valueRange.bull);
    
    baseCaseUpside = ((valueRange.base - price) / price) * 100;
    bullCaseUpside = ((valueRange.bull - price) / price) * 100;
    bearCaseDownside = ((price - valueRange.bear) / price) * 100;
    
    inferredFields.push('asymmetryScore', 'expectedReturnProbabilityWeightedPct');
    inferenceConfidence['asymmetryScore'] = asymmetry.confidence;
    inferenceConfidence['expectedReturnProbabilityWeightedPct'] = expectedReturn.confidence;
  }
  
  // Risk Category
  const riskCategory = inferRiskPrimaryCategory(memoContent);
  inferredFields.push('riskPrimaryCategory');
  inferenceConfidence['riskPrimaryCategory'] = riskCategory.confidence;
  
  // Industry Structure
  const industry = inferIndustryStructure(memoContent);
  inferredFields.push('industryStructure');
  inferenceConfidence['industryStructure'] = industry.confidence;
  
  // Catalyst
  const catalystType = inferCatalystType(memoContent);
  const catalystStrength = inferCatalystStrength(memoContent);
  inferredFields.push('catalystType', 'catalystStrength');
  inferenceConfidence['catalystType'] = catalystType.confidence;
  inferenceConfidence['catalystStrength'] = catalystStrength.confidence;
  
  // Catalyst Clarity Score (baseado na quantidade e qualidade dos catalysts)
  const catalysts = memoContent.catalysts?.value_unlocking_events || [];
  const catalystClarityScore = Math.min(catalysts.length * 2 + (catalystStrength.value === 'strong' ? 3 : catalystStrength.value === 'medium' ? 2 : 1), 10);
  inferredFields.push('catalystClarityScore');
  inferenceConfidence['catalystClarityScore'] = 0.6;
  
  // Portfolio Role
  const portfolioRole = inferPortfolioRole(memoContent);
  inferredFields.push('portfolioRole');
  inferenceConfidence['portfolioRole'] = portfolioRole.confidence;
  
  // Position Size
  const positionSize = extractPositionSize(memoContent.portfolio_fit?.suggested_position_size || '');
  if (positionSize) {
    inferredFields.push('suggestedPositionSizeMinPct', 'suggestedPositionSizeMaxPct');
    inferenceConfidence['suggestedPositionSizeMinPct'] = 0.8;
    inferenceConfidence['suggestedPositionSizeMaxPct'] = 0.8;
  }
  
  // Investability Score
  const investability = calculateInvestabilityScoreStandalone(
    qualityScore,
    asymmetry.value,
    catalystClarityScore,
    conviction
  );
  inferredFields.push('investabilityScoreStandalone');
  inferenceConfidence['investabilityScoreStandalone'] = investability.confidence;
  
  return {
    thesisPrimaryType: thesisType.value,
    thesisSecondaryType: null, // Requer análise mais profunda
    thesisTimeHorizonMonths: timeHorizon.value,
    thesisStyleVector: styleVector.value,
    asymmetryScore: asymmetry.value,
    expectedReturnProbabilityWeightedPct: expectedReturn.value,
    baseCaseUpsidePct: baseCaseUpside,
    bullCaseUpsidePct: bullCaseUpside,
    bearCaseDownsidePct: bearCaseDownside,
    riskPrimaryCategory: riskCategory.value,
    industryStructure: industry.value,
    catalystType: catalystType.value,
    catalystStrength: catalystStrength.value,
    catalystClarityScore,
    portfolioRole: portfolioRole.value,
    suggestedPositionSizeMinPct: positionSize?.min || null,
    suggestedPositionSizeMaxPct: positionSize?.max || null,
    investabilityScoreStandalone: investability.value,
    inferredFields,
    inferenceConfidence,
  };
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

export async function processAllMemos() {
  console.log('Starting batch inference for all IC Memos...');
  
  // Buscar todos os memos com status 'complete'
  const memos = await db.select().from(icMemos).where(eq(icMemos.status, 'complete'));
  
  console.log(`Found ${memos.length} complete IC Memos to process`);
  
  let processed = 0;
  let errors = 0;
  
  for (const memo of memos) {
    try {
      const content = memo.memoContent as ICMemoContent;
      if (!content) {
        console.log(`Skipping memo ${memo.memoId} - no content`);
        continue;
      }
      
      const inference = await inferMemoFields(
        content,
        memo.styleTag,
        memo.qualityScore ? parseFloat(memo.qualityScore) : null,
        memo.conviction
      );
      
      // Atualizar o memo com os campos inferidos
      await db.update(icMemos)
        .set({
          thesisPrimaryType: inference.thesisPrimaryType,
          thesisTimeHorizonMonths: inference.thesisTimeHorizonMonths,
          thesisStyleVector: inference.thesisStyleVector,
          asymmetryScore: inference.asymmetryScore?.toString(),
          expectedReturnProbabilityWeightedPct: inference.expectedReturnProbabilityWeightedPct?.toString(),
          baseCaseUpsidePct: inference.baseCaseUpsidePct?.toString(),
          bullCaseUpsidePct: inference.bullCaseUpsidePct?.toString(),
          bearCaseDownsidePct: inference.bearCaseDownsidePct?.toString(),
          riskPrimaryCategory: inference.riskPrimaryCategory,
          industryStructure: inference.industryStructure,
          catalystType: inference.catalystType,
          catalystStrength: inference.catalystStrength,
          catalystClarityScore: inference.catalystClarityScore?.toString(),
          portfolioRole: inference.portfolioRole,
          suggestedPositionSizeMinPct: inference.suggestedPositionSizeMinPct?.toString(),
          suggestedPositionSizeMaxPct: inference.suggestedPositionSizeMaxPct?.toString(),
          investabilityScoreStandalone: inference.investabilityScoreStandalone?.toString(),
          inferredFields: inference.inferredFields,
          inferenceConfidence: inference.inferenceConfidence,
          lastInferenceAt: new Date(),
          schemaVersion: 'v2.0',
        })
        .where(eq(icMemos.memoId, memo.memoId));
      
      processed++;
      
      if (processed % 100 === 0) {
        console.log(`Processed ${processed}/${memos.length} memos`);
      }
    } catch (error) {
      console.error(`Error processing memo ${memo.memoId}:`, error);
      errors++;
    }
  }
  
  console.log(`\nInference complete!`);
  console.log(`Processed: ${processed}`);
  console.log(`Errors: ${errors}`);
  
  return { processed, errors };
}
