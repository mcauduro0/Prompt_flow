/**
 * QA Framework v2.0 - Telemetry Module
 * Centralized telemetry for all lanes and components
 */

import { db } from '../client.js';
import { sql } from 'drizzle-orm';

// Types
export interface TelemetryEvent {
  eventType: string;
  lane: 'lane0' | 'laneA' | 'laneB' | 'laneC' | 'system';
  component?: string;
  metricName: string;
  metricValue?: number;
  metricText?: string;
  metadata?: Record<string, any>;
}

export interface DataSourceHealthEvent {
  sourceName: string;
  endpoint?: string;
  success: boolean;
  latencyMs?: number;
  errorMessage?: string;
  rateLimited?: boolean;
}

export interface LLMCallEvent {
  provider: string;
  model: string;
  lane?: string;
  component?: string;
  promptType?: string;
  success: boolean;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  errorMessage?: string;
  fallbackUsed?: boolean;
}

export interface GateResultEvent {
  ideaId: string;
  ticker: string;
  gateId: number;
  gateName: string;
  passed: boolean;
  score?: number;
  failureReasons?: Record<string, any>;
  binaryOverride?: string;
}

export interface AgentPerformanceEvent {
  packetId: string;
  ticker: string;
  agentName: string;
  success: boolean;
  latencyMs?: number;
  qualityScore?: number;
  errorMessage?: string;
}

export interface SupportingPromptEvent {
  memoId: string;
  ticker: string;
  promptName: string;
  success: boolean;
  latencyMs?: number;
  confidence?: number;
  errorMessage?: string;
}

// Telemetry class
export class Telemetry {
  private static instance: Telemetry;

  private constructor() {}

  public static getInstance(): Telemetry {
    if (!Telemetry.instance) {
      Telemetry.instance = new Telemetry();
    }
    return Telemetry.instance;
  }

  // Generic telemetry event
  async logEvent(event: TelemetryEvent): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO telemetry (event_type, lane, component, metric_name, metric_value, metric_text, metadata)
        VALUES (${event.eventType}, ${event.lane}, ${event.component || null}, ${event.metricName}, 
                ${event.metricValue || null}, ${event.metricText || null}, ${JSON.stringify(event.metadata || {})}::jsonb)
      `);
    } catch (error) {
      console.error('[Telemetry] Failed to log event:', error);
    }
  }

  // Data source health tracking
  async logDataSourceHealth(event: DataSourceHealthEvent): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO data_source_health (source_name, endpoint, success, latency_ms, error_message, rate_limited)
        VALUES (${event.sourceName}, ${event.endpoint || null}, ${event.success}, 
                ${event.latencyMs || null}, ${event.errorMessage || null}, ${event.rateLimited || false})
      `);
    } catch (error) {
      console.error('[Telemetry] Failed to log data source health:', error);
    }
  }

  // LLM call tracking
  async logLLMCall(event: LLMCallEvent): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO llm_calls (provider, model, lane, component, prompt_type, success, latency_ms, 
                               input_tokens, output_tokens, total_tokens, error_message, fallback_used)
        VALUES (${event.provider}, ${event.model}, ${event.lane || null}, ${event.component || null}, 
                ${event.promptType || null}, ${event.success}, ${event.latencyMs || null},
                ${event.inputTokens || null}, ${event.outputTokens || null}, ${event.totalTokens || null},
                ${event.errorMessage || null}, ${event.fallbackUsed || false})
      `);
    } catch (error) {
      console.error('[Telemetry] Failed to log LLM call:', error);
    }
  }

  // Gate result tracking
  async logGateResult(event: GateResultEvent): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO gate_results (idea_id, ticker, gate_id, gate_name, passed, score, failure_reasons, binary_override)
        VALUES (${event.ideaId}::uuid, ${event.ticker}, ${event.gateId}, ${event.gateName}, ${event.passed},
                ${event.score || null}, ${JSON.stringify(event.failureReasons || {})}::jsonb, ${event.binaryOverride || null})
      `);
    } catch (error) {
      console.error('[Telemetry] Failed to log gate result:', error);
    }
  }

  // Agent performance tracking
  async logAgentPerformance(event: AgentPerformanceEvent): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO agent_performance (packet_id, ticker, agent_name, success, latency_ms, quality_score, error_message)
        VALUES (${event.packetId}::uuid, ${event.ticker}, ${event.agentName}, ${event.success},
                ${event.latencyMs || null}, ${event.qualityScore || null}, ${event.errorMessage || null})
      `);
    } catch (error) {
      console.error('[Telemetry] Failed to log agent performance:', error);
    }
  }

  // Supporting prompt tracking
  async logSupportingPrompt(event: SupportingPromptEvent): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO supporting_prompt_results (memo_id, ticker, prompt_name, success, latency_ms, confidence, error_message)
        VALUES (${event.memoId}::uuid, ${event.ticker}, ${event.promptName}, ${event.success},
                ${event.latencyMs || null}, ${event.confidence || null}, ${event.errorMessage || null})
      `);
    } catch (error) {
      console.error('[Telemetry] Failed to log supporting prompt:', error);
    }
  }

  // Lane 0 specific events
  async logLane0Ingestion(source: string, ideasCount: number, success: boolean, metadata?: Record<string, any>): Promise<void> {
    await this.logEvent({
      eventType: 'ingestion',
      lane: 'lane0',
      component: source,
      metricName: 'ideas_ingested',
      metricValue: ideasCount,
      metadata: { success, ...metadata },
    });
  }

  // Lane A specific events
  async logLaneADiscovery(ideasGenerated: number, ideasPromoted: number, ideasRejected: number): Promise<void> {
    await this.logEvent({
      eventType: 'discovery',
      lane: 'laneA',
      metricName: 'discovery_run',
      metadata: { ideasGenerated, ideasPromoted, ideasRejected },
    });
  }

  // Lane B specific events
  async logLaneBResearch(packetId: string, ticker: string, status: string, duration?: number): Promise<void> {
    await this.logEvent({
      eventType: 'research',
      lane: 'laneB',
      metricName: 'research_packet',
      metricText: status,
      metricValue: duration,
      metadata: { packetId, ticker },
    });
  }

  // Lane C specific events
  async logLaneCMemo(memoId: string, ticker: string, status: string, conviction?: number, recommendation?: string): Promise<void> {
    await this.logEvent({
      eventType: 'ic_memo',
      lane: 'laneC',
      metricName: 'memo_generation',
      metricText: status,
      metricValue: conviction,
      metadata: { memoId, ticker, recommendation },
    });
  }

  // Query methods for QA report
  async getDataSourceHealthStats(days: number = 7): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          source_name,
          COUNT(*) as total_calls,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_calls,
          AVG(latency_ms) as avg_latency,
          SUM(CASE WHEN rate_limited THEN 1 ELSE 0 END) as rate_limit_hits,
          MAX(created_at) as last_call
        FROM data_source_health
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY source_name
      `);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('[Telemetry] Failed to get data source health stats:', error);
      return [];
    }
  }

  async getLLMStats(days: number = 7): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          provider,
          model,
          COUNT(*) as total_calls,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_calls,
          AVG(latency_ms) as avg_latency,
          SUM(input_tokens) as total_input_tokens,
          SUM(output_tokens) as total_output_tokens,
          SUM(CASE WHEN fallback_used THEN 1 ELSE 0 END) as fallbacks
        FROM llm_calls
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY provider, model
      `);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('[Telemetry] Failed to get LLM stats:', error);
      return [];
    }
  }

  async getGateStats(days: number = 7): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          gate_id,
          gate_name,
          COUNT(*) as total,
          SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed,
          SUM(CASE WHEN NOT passed THEN 1 ELSE 0 END) as failed,
          AVG(score) as avg_score
        FROM gate_results
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY gate_id, gate_name
        ORDER BY gate_id
      `);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('[Telemetry] Failed to get gate stats:', error);
      return [];
    }
  }

  async getAgentStats(days: number = 7): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          agent_name,
          COUNT(*) as total_executions,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
          AVG(latency_ms) as avg_latency,
          AVG(quality_score) as avg_quality
        FROM agent_performance
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY agent_name
      `);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('[Telemetry] Failed to get agent stats:', error);
      return [];
    }
  }

  async getSupportingPromptStats(days: number = 7): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          prompt_name,
          COUNT(*) as total_executions,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
          AVG(latency_ms) as avg_latency,
          AVG(confidence) as avg_confidence
        FROM supporting_prompt_results
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY prompt_name
      `);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('[Telemetry] Failed to get supporting prompt stats:', error);
      return [];
    }
  }

  async getLane0Stats(days: number = 7): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          component as source,
          SUM(metric_value) as total_ideas,
          COUNT(*) as ingestion_runs
        FROM telemetry
        WHERE lane = 'lane0' 
          AND event_type = 'ingestion'
          AND created_at > NOW() - INTERVAL '7 days'
        GROUP BY component
      `);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('[Telemetry] Failed to get Lane 0 stats:', error);
      return [];
    }
  }
}

// Export singleton instance
export const telemetry = Telemetry.getInstance();
