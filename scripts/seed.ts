import { loadEnvConfig } from "@next/env";
import { getStore, seed } from "../lib/server/store";
import { collectionName } from "../lib/server/access";
loadEnvConfig(process.cwd());
async function main() {
  if (process.env.BANYAN_STORAGE !== "mongodb")
    throw Error("Select mongodb mode explicitly before seeding.");
  await seed(await getStore());
  console.log(
    `Synthetic seed complete: banyan_workflow.${collectionName()} / modernization. Existing records preserved.`,
  );
}
main()
  .then(() => process.exit(0))
  .catch(() => {
    console.error(
      "Seed failed. Check the approved Banyan connection and database permissions. No credentials have been logged. Re-running is safe.",
    );
    process.exit(1);
  });
