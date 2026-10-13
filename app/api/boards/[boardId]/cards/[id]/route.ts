import { handle } from "@/lib/server/api";
export const runtime = "nodejs";
type Context = { params: Promise<{ boardId: string; id: string }> };
export async function PATCH(request: Request, context: Context) {
  const { boardId, id } = await context.params;
  return handle(request, boardId, id);
}

export async function GET(request: Request, context: Context) {
  const { boardId, id } = await context.params;
  return handle(request, boardId, id);
}
