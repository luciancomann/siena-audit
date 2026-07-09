/**
 * GET /api/cx-audit/report/[slug] — returns a stored AuditReport as JSON.
 */
import * as store from "@/lib/cx-audit/store";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await ctx.params;

  const report = await store.load(slug);
  if (!report) {
    return Response.json(
      { error: "No report with that address. It may have expired — run the audit again." },
      { status: 404 },
    );
  }

  return Response.json(report, {
    headers: { "cache-control": "no-store" },
  });
}
