import { handle } from "@/lib/server/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ boardId: string }> };
export async function GET(request: Request, context: Context) {
  return handle(request, (await context.params).boardId);
}
export async function POST(request: Request, context: Context) {
  return handle(request, (await context.params).boardId);
}
