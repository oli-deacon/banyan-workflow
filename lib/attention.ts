import type { CardSummary } from "./card-types";
export type Attention = "all" | "input" | "review" | "mine";
export function needsAttention(
  card: CardSummary,
  attention: Attention,
  reviewer: string,
) {
  if (attention === "input") return card.workState === "awaiting_input";
  if (attention === "review") return card.workState === "in_review";
  if (attention === "mine")
    return (
      !!reviewer && card.workState === "in_review" && card.reviewer === reviewer
    );
  return true;
}
