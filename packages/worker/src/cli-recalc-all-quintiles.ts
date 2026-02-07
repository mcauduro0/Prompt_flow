/**
 * CLI para recalcular TODOS os quintis de TODOS os IC Memos
 * usando metodologia de Z-SCORE (distribuição normalizada).
 */
import 'dotenv/config';
import { icMemosRepository } from "@arc/database";

const Z_CUTOFFS = {
  Q1_Q2: -0.8416,
  Q2_Q3: -0.2533,
  Q3_Q4: 0.2533,
  Q4_Q5: 0.8416,
};

interface Stats {
  mean: number;
  std: number;
  min: number;
  max: number;
  count: number;
}

function calculateStats(values: (number | null)[]): Stats | null {
  const validValues = values.filter((v): v is number => v !== null && !isNaN(v) && isFinite(v));
  if (validValues.length < 10) return null;
  
  const sorted = [...validValues].sort((a, b) => a - b);
  const n = sorted.length;
  const p5Index = Math.floor(n * 0.05);
  const p95Index = Math.floor(n * 0.95);
  const p5Value = sorted[p5Index];
  const p95Value = sorted[p95Index];
  
  const winsorized = validValues.map(v => {
    if (v < p5Value) return p5Value;
    if (v > p95Value) return p95Value;
    return v;
  });
  
  const mean = winsorized.reduce((a, b) => a + b, 0) / winsorized.length;
  const squaredDiffs = winsorized.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / winsorized.length;
  const std = Math.sqrt(variance);
  
  return { mean, std, min: Math.min(...winsorized), max: Math.max(...winsorized), count: winsorized.length };
}

function calculateZScore(value: number, mean: number, std: number): number {
  if (std === 0) return 0;
  return (value - mean) / std;
}

function assignQuintileFromZScore(zScore: number): number {
  if (zScore < Z_CUTOFFS.Q1_Q2) return 1;
  if (zScore < Z_CUTOFFS.Q2_Q3) return 2;
  if (zScore < Z_CUTOFFS.Q3_Q4) return 3;
  if (zScore < Z_CUTOFFS.Q4_Q5) return 4;
  return 5;
}

function calculateQuintileZScore(value: number | null, stats: Stats | null): number | null {
  if (value === null || isNaN(value) || !isFinite(value)) return null;
  if (!stats || stats.std === 0) return null;
  const zScore = calculateZScore(value, stats.mean, stats.std);
  return assignQuintileFromZScore(zScore);
}

export async function recalculateAllQuintiles(): Promise<void> {
  console.log("=".repeat(70));
  console.log("RECÁLCULO DE QUINTIS COM Z-SCORE");
  console.log("=".repeat(70));
  
  const memos = await icMemosRepository.getAll();
  const completeMemos = memos.filter((m: any) => m.status === 'complete');
  console.log(`\nTotal de IC Memos completos: ${completeMemos.length}`);
  
  const qualityScores = completeMemos.map((m: any) => m.qualityScore !== null ? Number(m.qualityScore) : null);
  const momentumScores = completeMemos.map((m: any) => m.momentumScore !== null ? Number(m.momentumScore) : null);
  const turnaroundScores = completeMemos.map((m: any) => m.turnaroundScore !== null ? Number(m.turnaroundScore) : null);
  const piotroskiScores = completeMemos.map((m: any) => m.piotroskiScore !== null ? Number(m.piotroskiScore) : null);
  const compositeScores = completeMemos.map((m: any) => m.compositeScore !== null ? Number(m.compositeScore) : null);
  
  const qualityStats = calculateStats(qualityScores);
  const momentumStats = calculateStats(momentumScores);
  const turnaroundStats = calculateStats(turnaroundScores);
  const piotroskiStats = calculateStats(piotroskiScores);
  const compositeStats = calculateStats(compositeScores);
  
  let updated = 0;
  for (const memo of completeMemos) {
    const m = memo as any;
    const qualityQ = calculateQuintileZScore(m.qualityScore !== null ? Number(m.qualityScore) : null, qualityStats);
    const momentumQ = calculateQuintileZScore(m.momentumScore !== null ? Number(m.momentumScore) : null, momentumStats);
    const turnaroundQ = calculateQuintileZScore(m.turnaroundScore !== null ? Number(m.turnaroundScore) : null, turnaroundStats);
    const piotroskiQ = calculateQuintileZScore(m.piotroskiScore !== null ? Number(m.piotroskiScore) : null, piotroskiStats);
    const compositeQ = calculateQuintileZScore(m.compositeScore !== null ? Number(m.compositeScore) : null, compositeStats);
    
    await icMemosRepository.updateQuintiles(m.memoId, {
      qualityScoreQuintile: qualityQ,
      momentumScoreQuintile: momentumQ,
      turnaroundScoreQuintile: turnaroundQ,
      piotroskiScoreQuintile: piotroskiQ,
      compositeScoreQuintile: compositeQ,
    });
    
    updated++;
    if (updated % 100 === 0) console.log(`  Atualizados: ${updated}/${completeMemos.length}`);
  }
  
  console.log(`\n✅ Total de memos atualizados: ${updated}`);
  console.log("=".repeat(70));
}

// Run if called directly
const isMainModule = typeof require !== 'undefined' && require.main === module;
if (isMainModule) {
  recalculateAllQuintiles()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}
