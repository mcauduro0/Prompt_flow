import 'dotenv/config';
import { runLaneC } from './orchestrator/lane-c-runner.js';

async function main() {
  console.log('Running Lane C IC Memo Generation...');
  const result = await runLaneC({ maxMemos: 100, concurrency: 10 });
  console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
