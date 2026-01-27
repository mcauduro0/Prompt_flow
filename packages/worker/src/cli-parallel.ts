import { icMemosRepository } from "@arc/database";
import { processICMemoSingle } from "./orchestrator/lane-c-runner";

const BATCH_SIZE = 5;

async function runParallel() {
    const pendingMemos = await icMemosRepository.getPending(30);
    console.log("Found", pendingMemos.length, "pending memos");

    if (pendingMemos.length === 0) {
        console.log("No pending memos");
        process.exit(0);
    }

    const batches: typeof pendingMemos[] = [];
    for (let i = 0; i < pendingMemos.length; i += BATCH_SIZE) {
        batches.push(pendingMemos.slice(i, i + BATCH_SIZE));
    }
    console.log("Processing in", batches.length, "batches of", BATCH_SIZE);

    let completed = 0;
    let failed = 0;

    for (let b = 0; b < batches.length; b++) {
        const batch = batches[b];
        console.log("=== Batch", b+1, "/", batches.length, "===");
        console.log("Tickers:", batch.map(m => m.ticker).join(", "));
        
        const results = await Promise.all(batch.map(async (memo) => {
            console.log("[START]", memo.ticker);
            try {
                const r = await processICMemoSingle(memo.memoId);
                console.log("[DONE]", memo.ticker, r.success ? "SUCCESS" : "FAILED");
                return r.success;
            } catch (e: any) {
                console.log("[ERROR]", memo.ticker, e.message);
                return false;
            }
        }));
        
        completed += results.filter(r => r).length;
        failed += results.filter(r => r === false).length;
        console.log("Batch done. Total:", completed, "completed,", failed, "failed");
    }

    console.log("=== FINAL ===");
    console.log("Completed:", completed);
    console.log("Failed:", failed);
}

runParallel().catch(console.error);
