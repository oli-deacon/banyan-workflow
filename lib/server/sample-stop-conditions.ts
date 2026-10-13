import type { Collection } from "mongodb";
import { FIELDS, samples, withStopCondition } from "../board";
import { BOARD_ID, revision, type RecordCard } from "./model";

export const SAMPLE_COLLECTIONS = ["cards", "cards_public_demo"] as const;
export type SampleCollection = (typeof SAMPLE_COLLECTIONS)[number];
export function parseBackfillArgs(args: string[]) {
  const apply = args.includes("--apply");
  const target = args
    .find((arg) => arg.startsWith("--collection="))
    ?.split("=")[1];
  if (
    !SAMPLE_COLLECTIONS.includes(target as SampleCollection) ||
    args.length !== (apply ? 2 : 1) ||
    args.some((arg) => arg !== "--apply" && arg !== `--collection=${target}`)
  )
    throw new Error(
      "Use --collection=cards_public_demo or --collection=cards, optionally with --apply.",
    );
  return { apply, collection: target as SampleCollection };
}

// Only these reviewed sample IDs are candidates; never insert or replace cards.
export async function backfillSampleStopConditions(
  collection: Collection<RecordCard>,
  apply = false,
) {
  const results: { id: string; outcome: string }[] = [];
  for (const sample of samples) {
    const current = await collection.findOne({
      boardId: BOARD_ID,
      id: sample.id,
    });
    let outcome: string;
    if (!current) outcome = "missing";
    else if (
      current.stopCondition !== undefined &&
      current.stopCondition !== ""
    )
      outcome = "already-set";
    else if (
      current.sample !== true ||
      !Number.isSafeInteger(current.version) ||
      current.version < 1 ||
      FIELDS.some(
        (field) =>
          field !== "stopCondition" && current[field] !== sample[field],
      )
    )
      outcome = "review-changed-context";
    else if (!apply) outcome = "would-fill";
    else {
      const normalized = withStopCondition(current);
      const next = revision(normalized, {
        ...normalized,
        stopCondition: sample.stopCondition,
      });
      next.activity[next.activity.length - 1].actor = "sample-seed";
      const result = await collection.updateOne(
        {
          boardId: BOARD_ID,
          id: sample.id,
          sample: true,
          version: current.version,
          // Context and missing-field predicates also protect against older writers.
          ...Object.fromEntries(
            FIELDS.filter((field) => field !== "stopCondition").map((field) => [
              field,
              current[field],
            ]),
          ),
          $or: [{ stopCondition: { $exists: false } }, { stopCondition: "" }],
        },
        {
          $set: {
            stopCondition: sample.stopCondition,
            version: next.version,
            updatedAt: next.updatedAt,
            activity: next.activity,
          },
        },
      );
      outcome = result.modifiedCount === 1 ? "filled" : "conflict";
    }
    results.push({ id: sample.id, outcome });
  }
  return results;
}
