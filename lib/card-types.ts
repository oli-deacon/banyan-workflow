import type { Card } from "./board";
import type { RecordCard } from "./server/model";

export type CardSummary = Pick<
  RecordCard,
  "id" | "title" | "summary" | "status" | "sample" | "version"
>;
export type EditorCard =
  | RecordCard
  | (Card & { version?: never; activity?: never });
export type BoardResponse = {
  cards: CardSummary[];
  mode: "public-demo" | "mock" | "mongodb";
};
export type CardResponse = { card: RecordCard };

export function summarizeCard({
  id,
  title,
  summary,
  status,
  sample,
  version,
}: CardSummary): CardSummary {
  return { id, title, summary, status, sample, version };
}
