import prisma from "@/app/lib/prisma";

export const runtime = "nodejs";

export async function POST() {
  try {
    // Add the column once (ignore if it already exists).
    try {
      await prisma.$executeRawUnsafe("ALTER TABLE orders ADD COLUMN late_probability REAL");
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (!message.toLowerCase().includes("duplicate column name")) throw e;
    }

    // SQLite random() returns a signed 64-bit integer.
    // Convert to a 0..1 float.
    const updated = await prisma.$executeRawUnsafe(
      "UPDATE orders SET late_probability = (1.0 * abs(random()) / 9223372036854775807.0)"
    );

    return Response.json({ ok: true, updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

