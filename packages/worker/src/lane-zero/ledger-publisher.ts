/**
 * Lane 0 - Ledger Publisher
 * 
 * Módulo responsável por:
 * 1. Consolidar ideias normalizadas em um ledger diário
 * 2. Persistir o ledger no banco de dados
 * 3. Publicar ideias para o Lane A
 * 4. Gerar relatório de execução
 */

import type { NormalizedIdea } from './idea-normalizer.js';
import { Lane0StateManager } from './state-manager.js';
import * as fs from 'fs/promises';

// Interface para o ledger diário
export interface DailyLedger {
  id: string;
  date: Date;
  ideas: LedgerIdea[];
  stats: LedgerStats;
  createdAt: Date;
  publishedToLaneA: boolean;
  publishedAt?: Date;
}

// Interface para ideia no ledger
export interface LedgerIdea {
  ticker: string;
  companyName: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  consensusDirection: 'LONG' | 'SHORT' | 'MIXED' | 'NEUTRAL';
  thesis: string;
  aggregatedConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  mentionCount: number;
  sourceCount: number;
  sources: Array<{
    type: 'substack' | 'reddit';
    name: string;
    url: string;
    author: string;
  }>;
  firstSeenAt: Date;
  lastSeenAt: Date;
  priority: number;
}

// Interface para estatísticas do ledger
export interface LedgerStats {
  totalIdeasExtracted: number;
  uniqueTickers: number;
  substackIdeas: number;
  redditIdeas: number;
  highConfidenceIdeas: number;
  mediumConfidenceIdeas: number;
  lowConfidenceIdeas: number;
  longIdeas: number;
  shortIdeas: number;
  neutralIdeas: number;
  averageMentionCount: number;
  topSources: Array<{ name: string; count: number }>;
  processingTimeMs: number;
}

// Interface para publicação no Lane A
export interface LaneAInput {
  ticker: string;
  companyName: string;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  thesis: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source: string;
  sourceUrl: string;
  priority: number;
}

export class LedgerPublisher {
  private stateManager: Lane0StateManager;

  constructor(stateManager: Lane0StateManager) {
    this.stateManager = stateManager;
  }

  private generateLedgerId(date: Date): string {
    const dateStr = date.toISOString().split('T')[0];
    return `ledger_${dateStr}_${Date.now()}`;
  }

  private calculatePriority(idea: NormalizedIdea): number {
    let priority = 5;

    if (idea.aggregatedConfidence === 'HIGH') priority += 2;
    else if (idea.aggregatedConfidence === 'MEDIUM') priority += 1;
    else priority -= 1;

    if (idea.mentionCount >= 3) priority += 2;
    else if (idea.mentionCount >= 2) priority += 1;

    if (idea.consensusDirection === 'LONG' || idea.consensusDirection === 'SHORT') {
      priority += 1;
    } else if (idea.consensusDirection === 'MIXED') {
      priority -= 1;
    }

    const substackSources = idea.sources.filter((s: { type: string }) => s.type === 'substack').length;
    if (substackSources >= 1) priority += 1;

    return Math.max(1, Math.min(10, priority));
  }

  private toLedgerIdea(idea: NormalizedIdea): LedgerIdea {
    return {
      ticker: idea.ticker,
      companyName: idea.companyName,
      direction: idea.direction,
      consensusDirection: idea.consensusDirection,
      thesis: idea.thesis,
      aggregatedConfidence: idea.aggregatedConfidence,
      mentionCount: idea.mentionCount,
      sourceCount: idea.sources.length,
      sources: idea.sources.map((s: { type: 'substack' | 'reddit'; name: string; url: string; author: string }) => ({
        type: s.type,
        name: s.name,
        url: s.url,
        author: s.author,
      })),
      firstSeenAt: idea.firstSeenAt,
      lastSeenAt: idea.lastSeenAt,
      priority: this.calculatePriority(idea),
    };
  }

  private calculateStats(ideas: NormalizedIdea[], processingTimeMs: number): LedgerStats {
    const sourceCountMap = new Map<string, number>();
    
    let substackIdeas = 0;
    let redditIdeas = 0;
    let highConf = 0;
    let medConf = 0;
    let lowConf = 0;
    let longIdeas = 0;
    let shortIdeas = 0;
    let neutralIdeas = 0;
    let totalMentions = 0;

    for (const idea of ideas) {
      for (const source of idea.sources) {
        if (source.type === 'substack') substackIdeas++;
        else redditIdeas++;
        
        const count = sourceCountMap.get(source.name) || 0;
        sourceCountMap.set(source.name, count + 1);
      }

      if (idea.aggregatedConfidence === 'HIGH') highConf++;
      else if (idea.aggregatedConfidence === 'MEDIUM') medConf++;
      else lowConf++;

      if (idea.direction === 'LONG') longIdeas++;
      else if (idea.direction === 'SHORT') shortIdeas++;
      else neutralIdeas++;

      totalMentions += idea.mentionCount;
    }

    const topSources = Array.from(sourceCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    return {
      totalIdeasExtracted: ideas.reduce((sum, i) => sum + i.sources.length, 0),
      uniqueTickers: ideas.length,
      substackIdeas,
      redditIdeas,
      highConfidenceIdeas: highConf,
      mediumConfidenceIdeas: medConf,
      lowConfidenceIdeas: lowConf,
      longIdeas,
      shortIdeas,
      neutralIdeas,
      averageMentionCount: ideas.length > 0 ? totalMentions / ideas.length : 0,
      topSources,
      processingTimeMs,
    };
  }

  createLedger(ideas: NormalizedIdea[], processingTimeMs: number): DailyLedger {
    const now = new Date();
    
    const ledgerIdeas = ideas.map(i => this.toLedgerIdea(i));
    ledgerIdeas.sort((a, b) => b.priority - a.priority);

    const ledger: DailyLedger = {
      id: this.generateLedgerId(now),
      date: now,
      ideas: ledgerIdeas,
      stats: this.calculateStats(ideas, processingTimeMs),
      createdAt: now,
      publishedToLaneA: false,
    };

    return ledger;
  }

  async persistLedger(ledger: DailyLedger): Promise<void> {
    console.log(`[LedgerPublisher] Persisting ledger ${ledger.id} with ${ledger.ideas.length} ideas...`);
    
    const ledgerPath = `/tmp/lane0_ledger_${ledger.id}.json`;
    await fs.writeFile(ledgerPath, JSON.stringify(ledger, null, 2));
    
    console.log(`[LedgerPublisher] Ledger saved to ${ledgerPath}`);
  }

  toLaneAInputs(ledger: DailyLedger, maxIdeas: number = 200): LaneAInput[] {
    const inputs: LaneAInput[] = [];
    const topIdeas = ledger.ideas.slice(0, maxIdeas);

    for (const idea of topIdeas) {
      const primarySource = idea.sources[0];
      
      inputs.push({
        ticker: idea.ticker,
        companyName: idea.companyName,
        direction: idea.direction,
        thesis: idea.thesis,
        confidence: idea.aggregatedConfidence,
        source: primarySource.name,
        sourceUrl: primarySource.url,
        priority: idea.priority,
      });
    }

    return inputs;
  }

  async publishToLaneA(ledger: DailyLedger, maxIdeas: number = 200): Promise<LaneAInput[]> {
    console.log(`[LedgerPublisher] Publishing ${Math.min(ledger.ideas.length, maxIdeas)} ideas to Lane A...`);
    
    const inputs = this.toLaneAInputs(ledger, maxIdeas);
    
    ledger.publishedToLaneA = true;
    ledger.publishedAt = new Date();

    await this.stateManager.updateExecutionState({
      lastLedgerId: ledger.id,
      lastPublishedAt: ledger.publishedAt,
      ideasPublished: inputs.length,
    });

    console.log(`[LedgerPublisher] Published ${inputs.length} ideas to Lane A`);
    
    return inputs;
  }

  generateExecutionReport(ledger: DailyLedger): string {
    const stats = ledger.stats;
    
    const report = `
# Lane 0 Execution Report
**Date:** ${ledger.date.toISOString()}
**Ledger ID:** ${ledger.id}

## Summary
- **Total Ideas Extracted:** ${stats.totalIdeasExtracted}
- **Unique Tickers:** ${stats.uniqueTickers}
- **Processing Time:** ${(stats.processingTimeMs / 1000).toFixed(2)}s

## Source Breakdown
- **Substack Ideas:** ${stats.substackIdeas}
- **Reddit Ideas:** ${stats.redditIdeas}

## Confidence Distribution
- **High Confidence:** ${stats.highConfidenceIdeas}
- **Medium Confidence:** ${stats.mediumConfidenceIdeas}
- **Low Confidence:** ${stats.lowConfidenceIdeas}

## Direction Distribution
- **Long:** ${stats.longIdeas}
- **Short:** ${stats.shortIdeas}
- **Neutral:** ${stats.neutralIdeas}

## Top Sources
${stats.topSources.map((s, i) => `${i + 1}. ${s.name}: ${s.count} ideas`).join('\n')}

## Top 10 Ideas by Priority
${ledger.ideas.slice(0, 10).map((idea, i) => 
  `${i + 1}. **${idea.ticker}** (${idea.companyName}) - ${idea.direction} - Priority: ${idea.priority}/10
     Thesis: ${idea.thesis.substring(0, 150)}...
     Sources: ${idea.sources.map(s => s.name).join(', ')}`
).join('\n\n')}

## Lane A Publication
- **Published:** ${ledger.publishedToLaneA ? 'Yes' : 'No'}
${ledger.publishedAt ? `- **Published At:** ${ledger.publishedAt.toISOString()}` : ''}
`;

    return report;
  }
}

export default LedgerPublisher;
