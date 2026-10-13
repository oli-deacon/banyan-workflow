import { loadEnvConfig } from "@next/env";
import { MongoClient } from "mongodb";
import { DATABASE, type RecordCard } from "../lib/server/model";
import {
  backfillSampleStopConditions,
  parseBackfillArgs,
} from "../lib/server/sample-stop-conditions";

async function main() {
  const { apply, collection } = parseBackfillArgs(process.argv.slice(2));
  loadEnvConfig(process.cwd());
  if (process.env.BANYAN_STORAGE !== "mongodb" || !process.env.MONGODB_URI)
    throw new Error("Approved MongoDB configuration is required.");
  const client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  try {
    await client.connect();
    console.log(
      `${apply ? "Apply" : "Dry run"}: ${DATABASE}.${collection} / modernization`,
    );
    const results = await backfillSampleStopConditions(
      client.db(DATABASE).collection<RecordCard>(collection),
      apply,
    );
    console.table(results);
    if (
      results.some(({ outcome }) =>
        ["conflict", "review-changed-context"].includes(outcome),
      )
    )
      process.exitCode = 2;
  } finally {
    await client.close();
  }
}
main().catch(() => {
  console.error(
    "Backfill failed. Select --collection=cards_public_demo or --collection=cards (optional --apply), and check the approved Banyan MongoDB configuration. No credentials have been logged. Re-running is safe.",
  );
  process.exitCode = 1;
});
