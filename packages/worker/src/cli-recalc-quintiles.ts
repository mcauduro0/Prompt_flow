import { icMemosRepository } from "@arc/database";

function getQuintile(score: number): string {
    const mean = 51.98;
    const stddev = 11.96;
    const z = (score - mean) / stddev;
    if (z < -0.84) return "Q1";
    if (z < -0.25) return "Q2";
    if (z < 0.25) return "Q3";
    if (z < 0.84) return "Q4";
    return "Q5";
}

function getRecommendation(quintile: string): string {
    switch (quintile) {
        case "Q5": return "hold";
        case "Q4": return "strong_buy";
        case "Q3": return "buy";
        case "Q2": return "hold";
        case "Q1": return "avoid";
        default: return "hold";
    }
}

async function main() {
    console.log("Recalculating quintiles based on z-score...");
    console.log("Mean: 51.98, StdDev: 11.96");
    console.log("Q1: z < -0.84 (score < 41.93)");
    console.log("Q2: -0.84 <= z < -0.25 (41.93 - 48.99)");
    console.log("Q3: -0.25 <= z < 0.25 (48.99 - 54.97)");
    console.log("Q4: 0.25 <= z < 0.84 (54.97 - 62.03)");
    console.log("Q5: z >= 0.84 (score >= 62.03)");
    console.log("");

    // Get all IC Memos
    const allMemos = await icMemosRepository.getAll(500);
    const memos = allMemos.filter(m => m.scoreV4 !== null && m.scoreV4 !== undefined);

    console.log(`Found ${memos.length} IC Memos with Score v4.0`);

    const counts: Record<string, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, Q5: 0 };
    let updated = 0;

    for (const memo of memos) {
        const score = Number(memo.scoreV4);
        const newQ = getQuintile(score);
        const newRec = getRecommendation(newQ);
        counts[newQ]++;

        if (memo.scoreV4Quintile !== newQ) {
            await icMemosRepository.updateScoresV4(memo.memoId, {
                scoreV4: memo.scoreV4,
                scoreV4Quintile: newQ,
                scoreV4Recommendation: newRec,
                turnaroundScore: memo.turnaroundScore,
                turnaroundQuintile: memo.turnaroundQuintile,
                turnaroundRecommendation: memo.turnaroundRecommendation,
            });
            updated++;
            console.log(`${memo.ticker}: ${score.toFixed(2)} -> ${newQ} (was ${memo.scoreV4Quintile})`);
        }
    }

    console.log("");
    console.log("=== QUINTILE DISTRIBUTION ===");
    for (const [q, c] of Object.entries(counts)) {
        console.log(`${q}: ${c} (${((c / memos.length) * 100).toFixed(1)}%)`);
    }
    console.log("");
    console.log(`Updated: ${updated} IC Memos`);
    process.exit(0);
}

main().catch(console.error);
