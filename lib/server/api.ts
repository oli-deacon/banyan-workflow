import { isStatus } from "../board";
import { ApiError, BOARD_ID, exact, object, parseCard, version } from "./model";
import { getStore, storageMode, type Store } from "./store";
import { publicDemo } from "./access";
export function authorize(request: Request, board: string) {
  const demo = publicDemo();
  if (
    !demo &&
    (process.env.NODE_ENV === "production" ||
      process.env.BANYAN_LOCAL_API !== "1")
  )
    throw new ApiError(
      403,
      "The API is disabled. This version requires explicit local development mode; team authentication is not configured.",
      "ACCESS_DISABLED",
    );
  const url = new URL(request.url);
  const host = request.headers.get("host");
  let expectedOrigin: string;
  if (demo) {
    const configured = process.env.BANYAN_PUBLIC_ORIGIN;
    let allowed: URL;
    try {
      allowed = new URL(configured ?? "");
    } catch {
      throw new ApiError(403, "Public demo access is not configured.", "ACCESS_DISABLED");
    }
    if (
      process.env.BANYAN_STORAGE !== "mongodb" ||
      allowed.protocol !== "https:" ||
      allowed.origin !== configured ||
      url.origin !== allowed.origin ||
      host !== allowed.host
    )
      throw new ApiError(403, "Public demo access is not configured for this address.", "ACCESS_DISABLED");
    expectedOrigin = allowed.origin;
  } else {
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !host ||
      !/^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/.test(host)
    )
      throw new ApiError(403, "Local access only.", "FORBIDDEN");
    // Next dev normalizes request.url to localhost; validate the original Host separately.
    expectedOrigin = `${url.protocol}//${host}`;
  }
  if (
    !demo && (request.headers.has("forwarded") ||
    (request.headers.has("x-forwarded-host") &&
      request.headers.get("x-forwarded-host") !== host))
  )
    throw new ApiError(403, "Unexpected forwarded host.", "FORBIDDEN");
  const origin = request.headers.get("origin");
  if (
    (origin && origin !== expectedOrigin) ||
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (request.method !== "GET" && origin !== expectedOrigin)
  )
    throw new ApiError(403, "Same-origin requests only.", "FORBIDDEN");
  if (board !== BOARD_ID)
    throw new ApiError(404, "Board not found.", "NOT_FOUND");
}
async function body(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError(415, "Use application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Missing request body.");
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 200000) {
      await reader.cancel();
      throw new ApiError(413, "Request is too large.");
    }
    chunks.push(value);
  }
  try {
    return object(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "Invalid JSON.");
  }
}
export async function handle(
  request: Request,
  board: string,
  id?: string,
  provided?: Store,
) {
  try {
    authorize(request, board);
    const store = provided ?? (await getStore());
    if (request.method === "GET")
      return Response.json(
        {
          cards: await store.list(board),
          mode: publicDemo() ? "public-demo" : storageMode() === "mock" ? "mock" : "mongodb",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    const input = await body(request);
    if (publicDemo()) {
      if (!store.checkDemoWrite)
        throw new ApiError(503, "The demo cannot accept changes right now.");
      await store.checkDemoWrite();
    }
    if (request.method === "POST") {
      exact(input, ["card"]);
      const card = parseCard(input.card);
      if (card.sample)
        throw new ApiError(
          400,
          "New cards cannot be marked as seeded samples.",
        );
      return Response.json(
        { card: await store.create(board, card) },
        { status: 201 },
      );
    }
    if (request.method === "PATCH" && id) {
      exact(input, ["card", "status", "expectedVersion"]);
      const expected = version(input.expectedVersion);
      let patch;
      if ("card" in input) {
        if ("status" in input)
          throw new ApiError(400, "Choose one update type.");
        patch = parseCard(input.card);
        if (patch.id !== id) throw new ApiError(400, "Card ID does not match.");
      } else {
        if (!isStatus(input.status))
          throw new ApiError(400, "Choose a valid status.");
        patch = { status: input.status };
      }
      return Response.json({
        card: await store.update(board, id, expected, patch),
      });
    }
    throw new ApiError(405, "Method not allowed.");
  } catch (error) {
    const known = error instanceof ApiError;
    return Response.json(
      {
        error: known
          ? error.message
          : "Database request failed. The outcome may be uncertain; keep your draft and refresh the board before retrying.",
        code: known ? error.code : "DATABASE_UNAVAILABLE",
      },
      { status: known ? error.status : 503 },
    );
  }
}
