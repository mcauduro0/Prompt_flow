/**
 * Script para regenerar IC Memos de ações internacionais com dados de preço faltantes.
 * Processa em batches de 10 em paralelo.
 */
import { icMemosRepository } from "@arc/database";
import { processICMemoSingle } from "./orchestrator/lane-c-runner.js";

const BATCH_SIZE = 10;

// Lista de tickers com current_price null
const TICKERS_TO_REGENERATE = [
    "2425.T", "6409.T", "6532.T", "7974.T", "9992.HK",
    "AAD.DE", "ADMCM.HE", "ADYEN.AS", "ALPH.L", "ALSTI.PA",
    "ARPT.TA", "ASY.L", "BELA.AT", "BESI.AS", "BETCO.ST",
    "BOUV.OL", "BVXP.L", "CBAV.MC", "CBOX.L", "CBRAIN.CO",
    "CDI.PA", "CHEMM.CO", "CLIQ.TO", "CMB.V", "CRDA.L",
    "CSU.TO", "DCC.L", "DGE.L", "DNLM.L", "DOM.L",
    "DPLM.L", "DSV.CO", "DUR.AX", "ELN.ST", "EVD.DE",
    "EXR", "FAAN.L", "FAR.TO", "FIRE.ST", "GAW.L",
    "GOFORE.HE", "GRG.V", "GUI.PA", "HARVIA.HE", "HEM.V",
    "HLAG.DE", "HLMA.L", "HMS.ST", "HTWS.L", "HWDN.L",
    "IFT.NZ", "IFTPF", "IPN.PA", "ITECH.ST", "JDG.L",
    "KAMBI.ST", "KER.PA", "KNEBV.HE", "KPG.NZ", "KPL.WA",
    "LDB.MI", "LEHN.SW", "LISN.SW", "LOTB.BR", "MAB1.L",
    "MBR.WA", "MEKKO.HE", "MELE.BR", "MIPS.ST", "MONC.MI",
    "MUM.DE", "NEDAP.AS", "NESN.SW", "NORBT.OL", "NOVN.SW",
    "NOVO-B.CO", "ORBI.TA", "PHN.WA", "PUUILO.HE", "QTCOM.HE",
    "REG1V.HE", "REL.L", "REY.MI", "RMS.PA", "RMV.L",
    "RSGN.SW", "SDI.V", "SHM.AX", "SKAN.SW", "SOON.SW",
    "SPSY.L", "TAM.L", "TEA.V", "TEQ.ST", "TGYM.MI",
    "TITAN.NS", "TNE.AX", "TOI.V", "TROAX.ST", "VRC.WA",
    "WOSG.L", "YUBICO.ST"
];

async function runRegeneration() {
    console.log("=" .repeat(60));
    console.log("REGENERATING IC MEMOS FOR INTERNATIONAL STOCKS");
    console.log(`Total tickers: ${TICKERS_TO_REGENERATE.length}`);
    console.log(`Batch size: ${BATCH_SIZE}`);
    console.log(`Total batches: ${Math.ceil(TICKERS_TO_REGENERATE.length / BATCH_SIZE)}`);
    console.log("=" .repeat(60));

    let completed = 0;
    let failed = 0;
    const failedTickers: string[] = [];

    // Process in batches
    for (let i = 0; i < TICKERS_TO_REGENERATE.length; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const batch = TICKERS_TO_REGENERATE.slice(i, i + BATCH_SIZE);

        console.log(`\n${"=".repeat(60)}`);
        console.log(`BATCH ${batchNum}: Processing ${batch.length} tickers`);
        console.log(`Tickers: ${batch.join(", ")}`);
        console.log("=".repeat(60));

        // Get memo IDs for all tickers in batch using repository
        const memoPromises = batch.map(async (ticker) => {
            const memos = await icMemosRepository.getByTicker(ticker);
            return { ticker, memoId: memos[0]?.memoId || null };
        });
        const memoInfos = await Promise.all(memoPromises);

        // Process all memos in parallel
        const results = await Promise.all(memoInfos.map(async ({ ticker, memoId }) => {
            if (!memoId) {
                console.log(`  ❌ ${ticker}: No memo found`);
                return { ticker, success: false, error: "No memo found" };
            }

            console.log(`  [START] ${ticker}`);
            try {
                const result = await processICMemoSingle(memoId);
                const status = result.success ? "✅" : "❌";
                console.log(`  ${status} ${ticker}`);
                return { ticker, success: result.success, error: result.error };
            } catch (e: any) {
                console.log(`  ❌ ${ticker}: ${e.message}`);
                return { ticker, success: false, error: e.message };
            }
        }));

        // Count results
        for (const r of results) {
            if (r.success) {
                completed++;
            } else {
                failed++;
                failedTickers.push(r.ticker);
            }
        }

        console.log(`Batch ${batchNum} done. Running total: ${completed} completed, ${failed} failed`);

        // Brief pause between batches
        if (i + BATCH_SIZE < TICKERS_TO_REGENERATE.length) {
            console.log("Waiting 3 seconds before next batch...");
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total processed: ${TICKERS_TO_REGENERATE.length}`);
    console.log(`Successful: ${completed}`);
    console.log(`Failed: ${failed}`);

    if (failedTickers.length > 0) {
        console.log("\nFailed tickers:");
        for (const ticker of failedTickers) {
            console.log(`  - ${ticker}`);
        }
    }

    process.exit(failed > 0 ? 1 : 0);
}

runRegeneration().catch(console.error);
