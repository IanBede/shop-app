export const runtime = "nodejs";

export async function POST() {
  try {
    const { runInMemoryScoring } = await import("@/app/lib/scoringStore");
    const result = await runInMemoryScoring();
    return Response.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

