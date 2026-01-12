import { PromptLibrary } from '../packages/worker/src/prompts/library-loader';
import { PromptExecutor } from '../packages/worker/src/prompts/executor';
import { TelemetryStore } from '../packages/worker/src/telemetry/store';
import { BudgetController } from '../packages/worker/src/budget/controller';
import { FMP } from '../packages/retriever/src/sources/fmp';
import { Polygon } from '../packages/retriever/src/sources/polygon';
import { SocialTrends } from '../packages/retriever/src/sources/socialtrends';
import { program } from 'commander';
import dotenv from 'dotenv';

dotenv.config();

const library = new PromptLibrary();
const telemetry = new TelemetryStore();
const budget = new BudgetController(telemetry);
const executor = new PromptExecutor(telemetry, budget);

const fmp = new FMP(process.env.FMP_API_KEY || '');
const polygon = new Polygon(process.env.POLYGON_API_KEY || '');
const social = new SocialTrends();

const TEST_TICKERS = ['AAPL', 'MSFT', 'FAST', 'TGT', 'CBRE'];

interface TestResult {
  prompt_id: string;
  status: 'pass' | 'fail' | 'skip';
  execution_time_ms: number;
  tokens_used: number;
  cost_usd: number;
  llm_called: boolean;
  data_source_used: string[];
  output_valid: boolean;
  output_schema_match: boolean;
  output_length: number;
  error?: string;
}

async function runTest(promptId: string): Promise<TestResult> {
  const startTime = Date.now();
  const result: TestResult = {
    prompt_id: promptId,
    status: 'fail',
    execution_time_ms: 0,
    tokens_used: 0,
    cost_usd: 0,
    llm_called: false,
    data_source_used: [],
    output_valid: false,
    output_schema_match: false,
    output_length: 0,
  };

  try {
    const prompt = library.get(promptId);
    if (!prompt) {
      result.status = 'skip';
      result.error = 'Prompt not found in library';
      return result;
    }

    // Prepare inputs
    const inputs: Record<string, any> = {};
    if (prompt.variables.includes('ticker')) {
      inputs.ticker = TEST_TICKERS[0];
    }
    if (prompt.variables.includes('theme')) {
      inputs.theme = 'AI Infrastructure';
    }
    if (prompt.variables.includes('date')) {
      inputs.date = new Date().toISOString().split('T')[0];
    }

    // Execute
    const output = await executor.execute(promptId, inputs);

    // Validate
    result.status = 'pass';
    result.output_valid = !!output;
    result.output_length = JSON.stringify(output).length;

    // Check telemetry
    const runId = executor.getLastRunId();
    if (runId) {
      const run = telemetry.getRun(runId);
      if (run) {
        result.tokens_used = run.tokens_used;
        result.cost_usd = run.cost_usd;
        result.llm_called = run.tokens_used > 0;
      }
    }

  } catch (e: any) {
    result.error = e.message;
  } finally {
    result.execution_time_ms = Date.now() - startTime;
  }

  return result;
}

async function main() {
  program
    .option('--lane <lane>', 'Test a specific lane (lane_a, lane_b, etc.)')
    .option('--prompt <prompt_id>', 'Test a single prompt')
    .option('--mode <mode>', 'Test mode (smoke)')
    .parse(process.argv);

  const options = program.opts();
  let promptsToTest: string[] = [];

  await library.load();

  if (options.prompt) {
    promptsToTest = [options.prompt];
  } else if (options.lane) {
    promptsToTest = library.listAll().filter(p => p.lane === options.lane).map(p => p.prompt_id);
  } else if (options.mode === 'smoke') {
    promptsToTest = [
      'macro_environment_analysis',
      'thematic_idea_generator',
      'business_overview_report',
      'valuation_analysis',
      'portfolio_construction',
      'news_sentiment_monitor',
      'daily_market_briefing',
    ];
  } else {
    console.error('Please specify a lane, prompt, or mode.');
    return;
  }

  console.log(`🚀 Running tests for ${promptsToTest.length} prompts...`);

  const results: TestResult[] = [];
  for (const promptId of promptsToTest) {
    console.log(`  - Testing ${promptId}...`);
    const result = await runTest(promptId);
    results.push(result);
    console.log(`    -> ${result.status.toUpperCase()} in ${result.execution_time_ms}ms`);
  }

  // Generate report
  const summary = {
    total: results.length,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    skipped: results.filter(r => r.status === 'skip').length,
  };

  console.log('\n📊 Test Report');
  console.log('-----------------');
  console.log(`  Total: ${summary.total}`);
  console.log(`  Passed: ${summary.passed}`);
  console.log(`  Failed: ${summary.failed}`);
  console.log(`  Skipped: ${summary.skipped}`);

  const failedTests = results.filter(r => r.status === 'fail');
  if (failedTests.length > 0) {
    console.log('\n🔴 Failed Tests');
    failedTests.forEach(t => {
      console.log(`  - ${t.prompt_id}: ${t.error}`);
    });
  }
}

main();
