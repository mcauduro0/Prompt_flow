import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL ?? '';
const sql = postgres(connectionString, { max: 5 });

const Z_CUTOFFS = {
  Q1_Q2: -0.8416,
  Q2_Q3: -0.2533,
  Q3_Q4: 0.2533,
  Q4_Q5: 0.8416,
};

function calculateStats(values: number[]) {
  if (values.length < 10) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const p5 = sorted[Math.floor(n * 0.05)];
  const p95 = sorted[Math.floor(n * 0.95)];
  const winsorized = values.map(v => Math.max(p5, Math.min(p95, v)));
  const mean = winsorized.reduce((a, b) => a + b, 0) / winsorized.length;
  const variance = winsorized.map(v => Math.pow(v - mean, 2)).reduce((a, b) => a + b, 0) / winsorized.length;
  return { mean, std: Math.sqrt(variance) };
}

function assignQuintile(value: number, stats: { mean: number; std: number }) {
  if (stats.std === 0) return 3;
  const z = (value - stats.mean) / stats.std;
  if (z < Z_CUTOFFS.Q1_Q2) return 1;
  if (z < Z_CUTOFFS.Q2_Q3) return 2;
  if (z < Z_CUTOFFS.Q3_Q4) return 3;
  if (z < Z_CUTOFFS.Q4_Q5) return 4;
  return 5;
}

async function main() {
  console.log('='.repeat(70));
  console.log('RECALCULO COMPLETO DE QUINTIS COM Z-SCORE (ALL MEMOS)');
  console.log('='.repeat(70));

  const memos = await sql`SELECT memo_id, quality_score, momentum_score, turnaround_score, piotroski_score, composite_score, score_v4 FROM ic_memos WHERE status = 'complete'`;
  console.log(`Total de IC Memos completos: ${memos.length}`);

  const qualityScores = memos.filter(m => m.quality_score !== null).map(m => Number(m.quality_score));
  const momentumScores = memos.filter(m => m.momentum_score !== null).map(m => Number(m.momentum_score));
  const turnaroundScores = memos.filter(m => m.turnaround_score !== null).map(m => Number(m.turnaround_score));
  const piotroskiScores = memos.filter(m => m.piotroski_score !== null).map(m => Number(m.piotroski_score));
  const compositeScores = memos.filter(m => m.composite_score !== null).map(m => Number(m.composite_score));
  const scoreV4s = memos.filter(m => m.score_v4 !== null).map(m => Number(m.score_v4));

  const qualityStats = calculateStats(qualityScores);
  const momentumStats = calculateStats(momentumScores);
  const turnaroundStats = calculateStats(turnaroundScores);
  const piotroskiStats = calculateStats(piotroskiScores);
  const compositeStats = calculateStats(compositeScores);
  const scoreV4Stats = calculateStats(scoreV4s);

  console.log(`Quality: n=${qualityScores.length}, mean=${qualityStats?.mean.toFixed(2)}, std=${qualityStats?.std.toFixed(2)}`);
  console.log(`Momentum: n=${momentumScores.length}, mean=${momentumStats?.mean.toFixed(2)}, std=${momentumStats?.std.toFixed(2)}`);
  console.log(`Turnaround: n=${turnaroundScores.length}, mean=${turnaroundStats?.mean.toFixed(2)}, std=${turnaroundStats?.std.toFixed(2)}`);
  console.log(`Piotroski: n=${piotroskiScores.length}, mean=${piotroskiStats?.mean.toFixed(2)}, std=${piotroskiStats?.std.toFixed(2)}`);
  console.log(`Composite: n=${compositeScores.length}, mean=${compositeStats?.mean.toFixed(2)}, std=${compositeStats?.std.toFixed(2)}`);
  console.log(`Score V4: n=${scoreV4s.length}, mean=${scoreV4Stats?.mean.toFixed(2)}, std=${scoreV4Stats?.std.toFixed(2)}`);

  let updated = 0;
  for (const memo of memos) {
    const qualityQ = memo.quality_score !== null && qualityStats ? assignQuintile(Number(memo.quality_score), qualityStats) : null;
    const momentumQ = memo.momentum_score !== null && momentumStats ? assignQuintile(Number(memo.momentum_score), momentumStats) : null;
    const turnaroundQ = memo.turnaround_score !== null && turnaroundStats ? assignQuintile(Number(memo.turnaround_score), turnaroundStats) : null;
    const piotroskiQ = memo.piotroski_score !== null && piotroskiStats ? assignQuintile(Number(memo.piotroski_score), piotroskiStats) : null;
    const compositeQ = memo.composite_score !== null && compositeStats ? assignQuintile(Number(memo.composite_score), compositeStats) : null;
    const scoreV4Q = memo.score_v4 !== null && scoreV4Stats ? assignQuintile(Number(memo.score_v4), scoreV4Stats) : null;
    const scoreV4Label = scoreV4Q ? `Q${scoreV4Q}` : null;

    await sql`UPDATE ic_memos SET 
      quality_score_quintile = ${qualityQ},
      momentum_score_quintile = ${momentumQ},
      turnaround_quintile = ${turnaroundQ},
      piotroski_score_quintile = ${piotroskiQ},
      composite_score_quintile = ${compositeQ},
      score_v4_quintile = ${scoreV4Label},
      updated_at = NOW()
    WHERE memo_id = ${memo.memo_id}`;

    updated++;
    if (updated % 100 === 0) console.log(`  Atualizados: ${updated}/${memos.length}`);
  }

  console.log(`\nTotal de memos atualizados: ${updated}`);
  
  const dist = await sql`SELECT composite_score_quintile as q, count(*) as cnt FROM ic_memos WHERE status = 'complete' GROUP BY composite_score_quintile ORDER BY composite_score_quintile`;
  console.log('\nDistribuicao de Quintis (Composite):');
  for (const row of dist) {
    console.log(`  Q${row.q}: ${row.cnt} memos`);
  }

  const distV4 = await sql`SELECT score_v4_quintile as q, count(*) as cnt FROM ic_memos WHERE status = 'complete' GROUP BY score_v4_quintile ORDER BY score_v4_quintile`;
  console.log('\nDistribuicao de Quintis (Score V4):');
  for (const row of distV4) {
    console.log(`  ${row.q}: ${row.cnt} memos`);
  }

  console.log('='.repeat(70));
  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
