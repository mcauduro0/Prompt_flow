import 'dotenv/config';
import { recalculateAllQuintiles } from './cli-recalc-all-quintiles.js';

recalculateAllQuintiles()
  .then(() => { console.log('Quintile recalculation complete'); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
