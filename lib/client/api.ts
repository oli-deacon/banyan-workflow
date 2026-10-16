import { withWorkflow, type WorkflowCommand } from "../workflow";
import { FIELDS, withCardDefaults, type Card, type Status } from "../board";
import {
  summarizeCard,
  type BoardResponse,
  type CardResponse,
  type EditorCard,
} from "../card-types";

const API = "/api/boards/modernization/cards";

export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(path, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    const data = await response.json();
    if (!response.ok)
      throw new RequestError(
        data.error || "The server could not complete this request.",
        response.status,
        data.code || "REQUEST_FAILED",
      );
    return data as T;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(
      options?.method
        ? "Could not confirm the server response. Keep your draft and refresh the board before retrying; the earlier write may have succeeded."
        : "Could not load the latest data. Please try again when the connection is available.",
      0,
      "RESPONSE_UNCONFIRMED",
    );
  } finally {
    clearTimeout(timer);
  }
}

export const loadBoard = async () => {
  const board = await request<BoardResponse>(API);
  return { ...board, cards: board.cards.map(summarizeCard) };
};
export const loadCard = async (id: string) =>
  withWorkflow(
    withCardDefaults(
      (await request<CardResponse>(`${API}/${encodeURIComponent(id)}`)).card,
    ),
  );

export async function saveCard(card: EditorCard) {
  const existing = card.version !== undefined;
  const payload = Object.fromEntries(
    ["id", "status", "sample", ...FIELDS].map((key) => [
      key,
      card[key as keyof Card],
    ]),
  );
  return (
    await request<CardResponse>(
      existing ? `${API}/${encodeURIComponent(card.id)}` : API,
      {
        method: existing ? "PATCH" : "POST",
        body: JSON.stringify({
          card: payload,
          ...(existing ? { expectedVersion: card.version } : {}),
        }),
      },
    )
  ).card;
}

export async function moveCard(
  id: string,
  status: Status,
  expectedVersion: number,
) {
  return (
    await request<CardResponse>(`${API}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status, expectedVersion, approved: true }),
    })
  ).card;
}

export async function commandCard(
  id: string,
  expectedVersion: number,
  command: WorkflowCommand,
) {
  return (
    await request<CardResponse>(`${API}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ expectedVersion, command }),
    })
  ).card;
}
