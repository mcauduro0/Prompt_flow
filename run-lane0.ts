import { Lane0Runner } from './packages/worker/dist/lane-zero/lane0-runner.js';
import { createDefaultClient } from './packages/llm-client/dist/client.js';

async function main() {
  console.log('[Manual] Starting Lane 0 execution...');
  
  const llmClient = createDefaultClient();
  
  const lane0 = new Lane0Runner(llmClient, {
    enableSubstack: true,
    enableReddit: true,
    maxIdeasPerSource: 50,
    maxIdeasToLaneA: 200,
    minConfidenceForLaneA: 'MEDIUM',
    parallelIngestion: true,
    dryRun: false,
  });
  
  const result = await lane0.run();
  
  console.log('\n=== Lane 0 Execution Report ===');
  console.log(result.report);
  console.log('\n=== Stats ===');
  console.log(JSON.stringify(result.stats, null, 2));
  
  if (result.laneAInputs.length > 0) {
    console.log('\n=== Ideas Published to Lane A ===');
    result.laneAInputs.forEach((idea, i) => {
      console.log(`${i + 1}. ${idea.ticker} - ${idea.companyName || 'N/A'}`);
      console.log(`   Direction: ${idea.direction}, Confidence: ${idea.confidence}`);
      console.log(`   Source: ${idea.source.name} (${idea.source.type})`);
      console.log(`   Thesis: ${idea.thesis.substring(0, 100)}...`);
      console.log('');
    });
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
