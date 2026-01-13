/**
 * ARC Investment Factory - Prompts API
 * Endpoints for managing and viewing the prompt catalog
 */

import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export const promptsRouter: Router = Router();

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to prompts library
const PROMPTS_FILE = path.join(__dirname, '../../../../packages/worker/src/prompts/library/prompts_full.json');

interface PromptDefinition {
  id: string;
  name: string;
  description: string;
  lane: string;
  stage: string;
  category: string;
  provider: string;
  model: string;
  system_prompt: string;
  user_prompt_template: string;
  output_schema: Record<string, unknown>;
  expected_value_score: number;
  expected_cost_score: number;
  value_cost_ratio: number;
  min_signal_dependency: number;
  dependency_type: string;
  status_institucional: string;
  template_version: string;
  variables: string[];
}

// GET /api/prompts - List all prompts with filtering
promptsRouter.get('/', async (req, res) => {
  try {
    const { lane, stage, category, status, provider, search } = req.query;
    
    let prompts: PromptDefinition[] = [];
    
    if (fs.existsSync(PROMPTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf-8'));
      prompts = data.prompts || [];
    }
    
    // Apply filters
    let filtered = prompts;
    
    if (lane && lane !== 'all') {
      filtered = filtered.filter(p => p.lane === lane);
    }
    
    if (stage && stage !== 'all') {
      filtered = filtered.filter(p => p.stage === stage);
    }
    
    if (category && category !== 'all') {
      filtered = filtered.filter(p => p.category === category);
    }
    
    if (status && status !== 'all') {
      filtered = filtered.filter(p => p.status_institucional === status);
    }
    
    if (provider && provider !== 'all') {
      filtered = filtered.filter(p => p.provider === provider);
    }
    
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = filtered.filter(p => 
        p.id.toLowerCase().includes(searchLower) ||
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      );
    }
    
    // Calculate summary stats
    const stats = {
      total: prompts.length,
      filtered: filtered.length,
      by_lane: {} as Record<string, number>,
      by_status: {} as Record<string, number>,
      by_provider: {} as Record<string, number>,
      avg_value_score: 0,
      avg_cost_score: 0,
    };
    
    prompts.forEach(p => {
      stats.by_lane[p.lane] = (stats.by_lane[p.lane] || 0) + 1;
      stats.by_status[p.status_institucional] = (stats.by_status[p.status_institucional] || 0) + 1;
      stats.by_provider[p.provider] = (stats.by_provider[p.provider] || 0) + 1;
    });
    
    if (filtered.length > 0) {
      stats.avg_value_score = filtered.reduce((sum, p) => sum + (p.expected_value_score || 0), 0) / filtered.length;
      stats.avg_cost_score = filtered.reduce((sum, p) => sum + (p.expected_cost_score || 0), 0) / filtered.length;
    }
    
    res.json({
      prompts: filtered.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        lane: p.lane,
        stage: p.stage,
        category: p.category,
        provider: p.provider,
        model: p.model,
        expected_value_score: p.expected_value_score,
        expected_cost_score: p.expected_cost_score,
        value_cost_ratio: p.value_cost_ratio,
        status_institucional: p.status_institucional,
        dependency_type: p.dependency_type,
        template_version: p.template_version,
        variables: p.variables || [],
      })),
      stats,
    });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// GET /api/prompts/:id - Get single prompt details
promptsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!fs.existsSync(PROMPTS_FILE)) {
      return res.status(404).json({ error: 'Prompts file not found' });
    }
    
    const data = JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf-8'));
    const prompts: PromptDefinition[] = data.prompts || [];
    
    const prompt = prompts.find(p => p.id === id);
    
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    res.json({ prompt });
  } catch (error) {
    console.error('Error fetching prompt:', error);
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
});

// GET /api/prompts/filters/options - Get available filter options
promptsRouter.get('/filters/options', async (req, res) => {
  try {
    let prompts: PromptDefinition[] = [];
    
    if (fs.existsSync(PROMPTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf-8'));
      prompts = data.prompts || [];
    }
    
    const lanes = [...new Set(prompts.map(p => p.lane))].sort();
    const stages = [...new Set(prompts.map(p => p.stage))].sort();
    const categories = [...new Set(prompts.map(p => p.category))].sort();
    const statuses = [...new Set(prompts.map(p => p.status_institucional))].sort();
    const providers = [...new Set(prompts.map(p => p.provider))].sort();
    
    res.json({
      lanes,
      stages,
      categories,
      statuses,
      providers,
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({ error: 'Failed to fetch filter options' });
  }
});
