/**
 * ARC Investment Factory - Lane C IC Memo Runner
 * 
 * Pipeline: select_pending_memos → fetch_research_packet → run_supporting_prompts → generate_ic_memo → persist
 * 
 * This runner orchestrates the IC Memo generation process for approved research packets.
 * It executes supporting prompts to enrich the research and generates a comprehensive IC Memo.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  icMemosRepository,
  researchPacketsRepository,
  ideasRepository,
} from '@arc/database';
import { createResilientClient, type LLMClient, type LLMRequest } from '@arc/llm-client';
import { createDataAggregator, type AggregatedCompanyData } from '@arc/retriever';
import { getPromptLibraryLoader, type PromptDefinition } from '../prompts/index.js';

// Supporting prompts to execute for IC Memo enrichment
const SUPPORTING_PROMPTS = [
  'Variant Perception',
  'Bull Bear Analysis',
  'Position Sizing',
  'Pre Mortem Analysis',
  'Exit Strategy',
  'Catalyst Identification',
  'Risk Assessment',
];

export interface LaneCConfig {
  dryRun?: boolean;
  maxMemos?: number;
  memoIds?: string[]; // Specific memos to process
}

export interface LaneCResult {
  success: boolean;
  memosStarted: number;
  memosCompleted: number;
  memosFailed: number;
  errors: string[];
  duration_ms: number;
  memos: Array<{
    memoId: string;
    ticker: string;
    status: 'completed' | 'failed';
    error?: string;
  }>;
}

interface SupportingAnalysis {
  promptName: string;
  result: any;
  success: boolean;
  error?: string;
}

/**
 * IC Memo generation system prompt
 */
const IC_MEMO_SYSTEM_PROMPT = `Atue como um investment professional de nível lendário, com histórico comprovado de decisões de capital de longo prazo em hedge funds globais e private equity de primeira linha. Você pensa como um fiduciário de capital escasso. Seu padrão intelectual é rigor extremo, clareza decisória e disciplina analítica. Você não escreve para impressionar, escreve para decidir.

Sua tarefa é produzir um Investment Committee Memo completo, autocontido e decisório, com base nos insumos de pesquisa fornecidos. O memo deve refletir domínio profundo do negócio, do setor, dos riscos e da dinâmica de criação de valor ao longo do tempo.

Princípios obrigatórios:
- Priorize verdade e clareza acima de sofisticação retórica.
- Diferencie fatos, inferências e hipóteses de forma explícita.
- Seja intelectualmente honesto sobre incertezas e pontos cegos.
- Evite narrativas vagas ou generalistas.
- Trate capital como um recurso escasso e reversível.
- Toda recomendação deve estar ancorada em evidência e lógica causal.

Tom e estilo:
- Profissional, direto, objetivo e decisório.
- Linguagem clara, sem jargões desnecessários.
- Frases precisas, com encadeamento lógico.
- Sem floreios, metáforas ou storytelling vazio.
- Escrita no padrão de um IC de elite, não de sell side.`;

/**
 * Select pending IC Memos for generation
 */
async function selectPendingMemos(
  maxMemos: number,
  specificIds?: string[]
): Promise<Array<{ memoId: string; packetId: string; ticker: string }>> {
  if (specificIds && specificIds.length > 0) {
    const memos = await Promise.all(
      specificIds.map(id => icMemosRepository.getById(id))
    );
    return memos
      .filter(Boolean)
      .map(memo => ({
        memoId: memo!.memoId,
        packetId: memo!.packetId,
        ticker: memo!.ticker,
      }));
  }

  // Get pending memos
  const pendingMemos = await icMemosRepository.getPending(maxMemos);
  return pendingMemos.map(memo => ({
    memoId: memo.memoId,
    packetId: memo.packetId,
    ticker: memo.ticker,
  }));
}

/**
 * Execute a supporting prompt
 */
async function executeSupportingPrompt(
  promptName: string,
  prompts: Map<string, PromptDefinition>,
  companyData: AggregatedCompanyData,
  researchPacket: any,
  llm: LLMClient
): Promise<SupportingAnalysis> {
  try {
    const promptDef = prompts.get(promptName);
    if (!promptDef) {
      return {
        promptName,
        result: null,
        success: false,
        error: `Prompt "${promptName}" not found in library`,
      };
    }

    // Build context for the prompt
    const context = {
      ticker: companyData.ticker,
      company_name: companyData.profile?.companyName || companyData.ticker,
      sector: companyData.profile?.sector || 'Unknown',
      industry: companyData.profile?.industry || 'Unknown',
      market_cap: companyData.metrics?.marketCapUsd || 0,
      current_price: companyData.latestPrice?.close || 0,
      
      // Research packet data
      thesis: researchPacket.decisionBrief?.thesis || '',
      recommendation: researchPacket.decisionBrief?.recommendation || '',
      conviction: researchPacket.decisionBrief?.conviction || 0,
      bull_case: researchPacket.decisionBrief?.bull_case || '',
      bear_case: researchPacket.decisionBrief?.bear_case || '',
      key_risks: researchPacket.decisionBrief?.key_risks || [],
      
      // Financial data
      financials: JSON.stringify(companyData.metrics || {}, null, 2),
      
      // Full research packet for context
      research_summary: JSON.stringify({
        modules: Object.keys(researchPacket.packet || {}),
        gateResults: researchPacket.packet?.gateResults || {},
        hypothesis: researchPacket.packet?.oneSentenceHypothesis || '',
      }, null, 2),
    };

    // Replace template variables
    let prompt = promptDef.template;
    for (const [key, value] of Object.entries(context)) {
      const placeholder = `{{${key}}}`;
      prompt = prompt.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Execute LLM call using the complete method
    const request: LLMRequest = {
      messages: [
        { role: 'system', content: promptDef.llm_config?.temperature ? 'You are a professional investment analyst.' : 'You are a professional investment analyst.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 4000,
    };
    const response = await llm.complete(request);

    // Try to parse as JSON if the prompt expects structured output
    let result = response.content;
    if (promptDef.output_schema) {
      try {
        result = JSON.parse(response.content);
      } catch {
        // Keep as string if not valid JSON
      }
    }

    return {
      promptName,
      result,
      success: true,
    };
  } catch (error) {
    return {
      promptName,
      result: null,
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Generate the IC Memo content
 */
async function generateICMemo(
  companyData: AggregatedCompanyData,
  researchPacket: any,
  supportingAnalyses: SupportingAnalysis[],
  llm: LLMClient
): Promise<any> {
  // Build comprehensive context for IC Memo generation
  const researchContext = {
    company: {
      ticker: companyData.ticker,
      name: companyData.profile?.companyName || companyData.ticker,
      sector: companyData.profile?.sector,
      industry: companyData.profile?.industry,
      description: companyData.profile?.description,
      market_cap: companyData.metrics?.marketCapUsd,
      employees: companyData.profile?.employees,
    },
    
    financials: {
      current_price: companyData.latestPrice?.close,
      pe_ratio: companyData.metrics?.pe,
      ev_ebitda: companyData.metrics?.evToEbitda,
      gross_margin: companyData.metrics?.grossMargin,
      ebit_margin: companyData.metrics?.ebitMargin,
      roe: companyData.metrics?.roe,
      roic: companyData.metrics?.roic,
      current_ratio: companyData.metrics?.currentRatio,
      fcf_yield: companyData.metrics?.fcfYield,
      net_debt_to_ebitda: companyData.metrics?.netDebtToEbitda,
    },
    
    research_synthesis: {
      thesis: researchPacket.decisionBrief?.thesis,
      recommendation: researchPacket.decisionBrief?.recommendation,
      conviction: researchPacket.decisionBrief?.conviction,
      bull_case: researchPacket.decisionBrief?.bull_case,
      base_case: researchPacket.decisionBrief?.base_case,
      bear_case: researchPacket.decisionBrief?.bear_case,
      key_risks: researchPacket.decisionBrief?.key_risks,
      position_guidance: researchPacket.decisionBrief?.position_guidance,
    },
    
    research_modules: {
      business_model: researchPacket.packet?.businessModel,
      industry_moat: researchPacket.packet?.industryMoat,
      valuation: researchPacket.packet?.valuation,
      financial_forensics: researchPacket.packet?.financialForensics,
      capital_allocation: researchPacket.packet?.capitalAllocation,
      management_quality: researchPacket.packet?.managementQuality,
      risk_stress: researchPacket.packet?.riskStress,
    },
    
    gate_results: researchPacket.packet?.gateResults,
    
    monitoring_plan: researchPacket.monitoringPlan,
    
    supporting_analyses: supportingAnalyses
      .filter(a => a.success)
      .reduce((acc, a) => {
        acc[a.promptName.toLowerCase().replace(/ /g, '_')] = a.result;
        return acc;
      }, {} as Record<string, any>),
  };

  const userPrompt = `Com base nos seguintes insumos de pesquisa, produza um Investment Committee Memo completo seguindo rigorosamente a estrutura especificada.

## DADOS DA EMPRESA
${JSON.stringify(researchContext.company, null, 2)}

## DADOS FINANCEIROS
${JSON.stringify(researchContext.financials, null, 2)}

## SÍNTESE DA PESQUISA (LANE B)
${JSON.stringify(researchContext.research_synthesis, null, 2)}

## MÓDULOS DE PESQUISA DETALHADOS
${JSON.stringify(researchContext.research_modules, null, 2)}

## RESULTADOS DOS GATES
${JSON.stringify(researchContext.gate_results, null, 2)}

## PLANO DE MONITORAMENTO
${JSON.stringify(researchContext.monitoring_plan, null, 2)}

## ANÁLISES SUPPORTING
${JSON.stringify(researchContext.supporting_analyses, null, 2)}

---

Produza o IC Memo completo em formato JSON estruturado com as seguintes seções:

{
  "executive_summary": {
    "opportunity": "string - O que é a oportunidade",
    "why_now": "string - Por que ela existe agora",
    "risk_reward_asymmetry": "string - Qual é a assimetria entre risco e retorno",
    "decision_required": "string - Qual decisão o IC precisa tomar"
  },
  "investment_thesis": {
    "central_thesis": "string - Tese central de criação de valor",
    "value_creation_mechanism": "string - Mecanismo econômico que gera retorno",
    "sustainability": "string - Por que esse mecanismo é sustentável",
    "structural_vs_cyclical": "string - Diferenciação entre drivers estruturais e cíclicos"
  },
  "business_analysis": {
    "how_company_makes_money": "string - Como a empresa realmente ganha dinheiro",
    "competitive_advantages": ["array de vantagens competitivas"],
    "competitive_weaknesses": ["array de fragilidades"],
    "industry_structure": "string - Estrutura da indústria",
    "competitive_dynamics": "string - Dinâmica competitiva",
    "barriers_to_entry": "string - Barreiras de entrada",
    "pricing_power": "string - Poder de precificação",
    "disruption_risks": "string - Riscos de disrupção"
  },
  "financial_quality": {
    "revenue_quality": "string - Qualidade de receitas",
    "margin_analysis": "string - Análise de margens",
    "capital_intensity": "string - Capital intensity",
    "return_on_capital": "string - Retorno sobre capital",
    "accounting_distortions": ["array de distorções contábeis"],
    "earnings_quality_risks": ["array de riscos de earnings quality"],
    "growth_capital_dynamics": "string - Como o crescimento consome ou libera capital"
  },
  "valuation": {
    "methodology": "string - Metodologia de valuation",
    "key_assumptions": ["array de premissas-chave"],
    "sensitivities": ["array de sensitividades"],
    "value_range": {
      "bear": "number - valor no cenário bear",
      "base": "number - valor no cenário base",
      "bull": "number - valor no cenário bull"
    },
    "expected_return": "string - Retorno esperado",
    "opportunity_cost": "string - Custo de oportunidade do capital"
  },
  "risks": {
    "material_risks": [
      {
        "risk": "string - descrição do risco",
        "manifestation": "string - como se manifesta",
        "impact": "string - impacto potencial",
        "early_signals": ["array de sinais precoces"]
      }
    ],
    "thesis_error_risks": ["array de riscos de erro de tese"],
    "asymmetric_risks": ["array de riscos assimétricos"]
  },
  "variant_perception": {
    "consensus_view": "string - Visão do consenso",
    "our_view": "string - Nossa visão",
    "why_market_wrong": "string - Por que o mercado pode estar errado",
    "confirming_facts": ["array de fatos que confirmam"],
    "invalidating_facts": ["array de fatos que invalidam"]
  },
  "catalysts": {
    "value_unlocking_events": [
      {
        "event": "string - evento",
        "timeline": "string - horizonte temporal",
        "controllable": "boolean - se é controlável"
      }
    ],
    "expected_horizon": "string - horizonte temporal esperado"
  },
  "portfolio_fit": {
    "portfolio_role": "string - papel no portfólio",
    "correlation": "string - correlação com outros ativos",
    "concentration_impact": "string - impacto em concentração",
    "liquidity": "string - liquidez",
    "drawdown_impact": "string - impacto em drawdowns",
    "sizing_rationale": "string - racional de sizing",
    "suggested_position_size": "string - tamanho sugerido da posição"
  },
  "decision": {
    "recommendation": "string - buy|invest|increase|hold|reduce|wait|reject",
    "revisit_conditions": ["array de condições para revisitar"],
    "change_of_mind_triggers": ["array de gatilhos para mudar de opinião"]
  }
}

Responda APENAS com o JSON estruturado, sem texto adicional.`;

  const request: LLMRequest = {
    messages: [
      { role: 'system', content: IC_MEMO_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    maxTokens: 8000,
  };
  const response = await llm.complete(request);

  // Parse the JSON response
  let memoContent;
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      memoContent = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (error) {
    console.error('Failed to parse IC Memo JSON:', error);
    // Return a structured error response
    memoContent = {
      executive_summary: {
        opportunity: 'Failed to generate - see raw content',
        why_now: '',
        risk_reward_asymmetry: '',
        decision_required: 'Manual review required',
      },
      _raw_content: response.content,
      _parse_error: (error as Error).message,
    };
  }

  return memoContent;
}

/**
 * Process a single IC Memo
 */
async function processICMemo(
  memoId: string,
  packetId: string,
  ticker: string,
  llm: LLMClient,
  prompts: Map<string, PromptDefinition>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Update status to generating
    await icMemosRepository.updateStatus(memoId, 'generating');
    await icMemosRepository.updateProgress(memoId, 5);

    // Get the research packet
    const packet = await researchPacketsRepository.getById(packetId);
    if (!packet) {
      throw new Error(`Research packet ${packetId} not found`);
    }

    await icMemosRepository.updateProgress(memoId, 10);

    // Fetch fresh company data
    const dataAggregator = createDataAggregator();
    const companyData = await dataAggregator.getCompanyData(ticker);

    await icMemosRepository.updateProgress(memoId, 20);

    // Execute supporting prompts
    const supportingAnalyses: SupportingAnalysis[] = [];
    const progressPerPrompt = 50 / SUPPORTING_PROMPTS.length;
    let currentProgress = 20;

    for (const promptName of SUPPORTING_PROMPTS) {
      console.log(`[Lane C] Executing supporting prompt: ${promptName} for ${ticker}`);
      const analysis = await executeSupportingPrompt(
        promptName,
        prompts,
        companyData,
        packet,
        llm
      );
      supportingAnalyses.push(analysis);
      currentProgress += progressPerPrompt;
      await icMemosRepository.updateProgress(memoId, Math.round(currentProgress));
    }

    await icMemosRepository.updateProgress(memoId, 70);

    // Generate IC Memo
    console.log(`[Lane C] Generating IC Memo for ${ticker}`);
    const memoContent = await generateICMemo(
      companyData,
      packet,
      supportingAnalyses,
      llm
    );

    await icMemosRepository.updateProgress(memoId, 90);

    // Extract recommendation and conviction from memo
    const recommendation = memoContent.decision?.recommendation || 'hold';
    const convictionMap: Record<string, number> = {
      'buy': 80,
      'invest': 75,
      'increase': 70,
      'hold': 50,
      'reduce': 30,
      'wait': 40,
      'reject': 20,
    };
    const conviction = convictionMap[recommendation] || 50;

    // Save the completed memo
    const supportingAnalysesObj = supportingAnalyses.reduce((acc, a) => {
      const key = a.promptName.toLowerCase().replace(/ /g, '_');
      acc[key] = {
        result: a.result,
        success: a.success,
        error: a.error,
      };
      return acc;
    }, {} as Record<string, any>);

    await icMemosRepository.complete(
      memoId,
      memoContent,
      supportingAnalysesObj,
      recommendation as any,
      conviction
    );

    console.log(`[Lane C] IC Memo completed for ${ticker}`);
    return { success: true };
  } catch (error) {
    console.error(`[Lane C] Error processing IC Memo for ${ticker}:`, error);
    await icMemosRepository.markFailed(memoId, (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Run Lane C IC Memo generation
 */
export async function runLaneC(config: LaneCConfig = {}): Promise<LaneCResult> {
  const startTime = Date.now();
  const { dryRun = false, maxMemos = 5, memoIds } = config;

  console.log(`[Lane C] Starting IC Memo generation run`);
  console.log(`[Lane C] Config: dryRun=${dryRun}, maxMemos=${maxMemos}`);

  const result: LaneCResult = {
    success: true,
    memosStarted: 0,
    memosCompleted: 0,
    memosFailed: 0,
    errors: [],
    duration_ms: 0,
    memos: [],
  };

  try {
    // Load prompt library
    const loader = getPromptLibraryLoader();
    const loadResult = loader.load();
    if (!loadResult.success || !loadResult.library) {
      throw new Error(`Failed to load prompt library: ${loadResult.errors?.join(', ')}`);
    }
    const prompts = new Map<string, PromptDefinition>();
    for (const prompt of loadResult.library.prompts) {
      prompts.set(prompt.title, prompt);
    }

    // Select pending memos
    const pendingMemos = await selectPendingMemos(maxMemos, memoIds);
    console.log(`[Lane C] Found ${pendingMemos.length} pending IC Memos`);

    if (pendingMemos.length === 0) {
      console.log('[Lane C] No pending IC Memos to process');
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    if (dryRun) {
      console.log('[Lane C] Dry run - would process:', pendingMemos.map(m => m.ticker));
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    // Create LLM client
    const llm = createResilientClient();

    // Process each memo
    for (const memo of pendingMemos) {
      result.memosStarted++;
      console.log(`[Lane C] Processing IC Memo for ${memo.ticker}`);

      const processResult = await processICMemo(
        memo.memoId,
        memo.packetId,
        memo.ticker,
        llm,
        prompts
      );

      if (processResult.success) {
        result.memosCompleted++;
        result.memos.push({
          memoId: memo.memoId,
          ticker: memo.ticker,
          status: 'completed',
        });
      } else {
        result.memosFailed++;
        result.errors.push(`${memo.ticker}: ${processResult.error}`);
        result.memos.push({
          memoId: memo.memoId,
          ticker: memo.ticker,
          status: 'failed',
          error: processResult.error,
        });
      }
    }

    result.success = result.memosFailed === 0;
  } catch (error) {
    console.error('[Lane C] Fatal error:', error);
    result.success = false;
    result.errors.push((error as Error).message);
  }

  result.duration_ms = Date.now() - startTime;
  console.log(`[Lane C] Run completed in ${result.duration_ms}ms`);
  console.log(`[Lane C] Results: ${result.memosCompleted} completed, ${result.memosFailed} failed`);

  return result;
}

export default runLaneC;
