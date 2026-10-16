import { normalizeStatus } from "./workflow";
import type { Card } from "./board";
import type { RecordCard } from "./server/model";
import type { WorkState } from "./workflow";

export type CardSummary = Pick<
  RecordCard,
  | "id"
  | "title"
  | "summary"
  | "owner"
  | "worker"
  | "workerKind"
  | "reviewer"
  | "status"
  | "sample"
  | "version"
> & { workState: WorkState };
export type EditorCard =
  RecordCard | (Card & { version?: never; activity?: never });
export type BoardResponse = {
  cards: CardSummary[];
  mode: "public-demo" | "mock" | "mongodb";
};
export type CardResponse = { card: RecordCard };

export function summarizeCard({
  id,
  title,
  summary,
  owner = "",
  worker = "",
  workerKind = "human",
  reviewer = "",
  status,
  sample,
  version,
  workState,
  workflow,
}: Omit<CardSummary, "workState"> & {
  workState?: WorkState;
  workflow?: { state: WorkState };
}): CardSummary {
  return {
    id,
    title,
    summary,
    owner,
    worker,
    workerKind,
    reviewer,
    status: normalizeStatus(status),
    sample,
    version,
    workState: workState ?? workflow?.state ?? "idle",
  };
}
