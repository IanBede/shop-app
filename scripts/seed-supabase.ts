/**
 * Copies customers + orders from local shop.db (SQLite) into Supabase (PostgreSQL) via Prisma.
 *
 * Requires: DATABASE_URL (or DIRECT_URL) in .env, and shop.db at project root.
 *
 * Run: npx tsx scripts/seed-supabase.ts
 */
import "dotenv/config";

import Database from "better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import path from "node:path";
import { Pool } from "pg";

import { PrismaClient } from "../app/generated/prisma/client";

const SQLITE_PATH = path.join(process.cwd(), "shop.db");

/** Normalize SQLite datetime text to a real Date, then to ISO string for Postgres / Prisma String fields. */
function toIsoDateTime(raw: string | null | undefined): string {
  if (raw == null || raw === "") {
    return new Date().toISOString();
  }
  let s = String(raw).trim();
  if (!s.includes("T") && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s)) {
    s = s.replace(" ", "T");
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    return String(raw);
  }
  return d.toISOString();
}

function num(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v);
}

function optStr(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

function createPrismaForScript() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Set DIRECT_URL or DATABASE_URL in .env (direct 5432 URL recommended for bulk upserts)."
    );
  }
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

async function main() {
  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  const customerRows = sqlite.prepare("SELECT * FROM customers").all() as Record<string, unknown>[];
  const orderRows = sqlite.prepare("SELECT * FROM orders").all() as Record<string, unknown>[];

  console.log(`SQLite: ${customerRows.length} customers, ${orderRows.length} orders`);

  const { prisma, pool } = createPrismaForScript();

  try {
    for (const row of customerRows) {
      const customer_id = num(row.customer_id);
      await prisma.customers.upsert({
        where: { customer_id },
        create: {
          customer_id,
          full_name: str(row.full_name),
          email: str(row.email),
          gender: str(row.gender),
          birthdate: str(row.birthdate),
          created_at: str(row.created_at),
          city: optStr(row.city),
          state: optStr(row.state),
          zip_code: optStr(row.zip_code),
          customer_segment: optStr(row.customer_segment),
          loyalty_tier: optStr(row.loyalty_tier),
          is_active: num(row.is_active, 1),
        },
        update: {
          full_name: str(row.full_name),
          email: str(row.email),
          gender: str(row.gender),
          birthdate: str(row.birthdate),
          created_at: str(row.created_at),
          city: optStr(row.city),
          state: optStr(row.state),
          zip_code: optStr(row.zip_code),
          customer_segment: optStr(row.customer_segment),
          loyalty_tier: optStr(row.loyalty_tier),
          is_active: num(row.is_active, 1),
        },
      });
    }

    for (const row of orderRows) {
      const order_id = num(row.order_id);
      const parsedOrderDatetime = toIsoDateTime(str(row.order_datetime));
      const lateProbRaw = row.late_probability;
      const late_probability =
        lateProbRaw != null && lateProbRaw !== "" ? num(lateProbRaw as number, NaN) : null;
      const late_probability_final = late_probability != null && !Number.isNaN(late_probability) ? late_probability : null;

      await prisma.orders.upsert({
        where: { order_id },
        create: {
          order_id,
          customer_id: num(row.customer_id),
          order_datetime: parsedOrderDatetime,
          billing_zip: optStr(row.billing_zip),
          shipping_zip: optStr(row.shipping_zip),
          shipping_state: optStr(row.shipping_state),
          payment_method: str(row.payment_method),
          device_type: str(row.device_type),
          ip_country: str(row.ip_country),
          promo_used: num(row.promo_used, 0),
          promo_code: optStr(row.promo_code),
          order_subtotal: num(row.order_subtotal),
          shipping_fee: num(row.shipping_fee),
          tax_amount: num(row.tax_amount),
          order_total: num(row.order_total),
          risk_score: num(row.risk_score),
          is_fraud: num(row.is_fraud, 0),
          late_probability: late_probability_final,
        },
        update: {
          customer_id: num(row.customer_id),
          order_datetime: parsedOrderDatetime,
          billing_zip: optStr(row.billing_zip),
          shipping_zip: optStr(row.shipping_zip),
          shipping_state: optStr(row.shipping_state),
          payment_method: str(row.payment_method),
          device_type: str(row.device_type),
          ip_country: str(row.ip_country),
          promo_used: num(row.promo_used, 0),
          promo_code: optStr(row.promo_code),
          order_subtotal: num(row.order_subtotal),
          shipping_fee: num(row.shipping_fee),
          tax_amount: num(row.tax_amount),
          order_total: num(row.order_total),
          risk_score: num(row.risk_score),
          is_fraud: num(row.is_fraud, 0),
          late_probability: late_probability_final,
        },
      });
    }

    await prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('customers', 'customer_id'),
        COALESCE((SELECT MAX(customer_id) FROM customers), 1)
      );
    `);
    await prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('orders', 'order_id'),
        COALESCE((SELECT MAX(order_id) FROM orders), 1)
      );
    `);

    console.log("Upsert complete. Serial sequences aligned with MAX(ids).");
  } finally {
    await prisma.$disconnect();
    await pool.end();
    sqlite.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
