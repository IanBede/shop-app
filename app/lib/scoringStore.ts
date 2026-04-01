export type QueueRow = {
  order_id: number;
  customer_id: number;
  order_datetime: string;
  order_total: number;
  device_type: string;
  ip_country: string;
  shipping_state: string | null;
  /** Inferred from shipping address (see inferShippingCountry). */
  shipping_country: string | null;
  late_probability: number;
  /** Fraud risk 0..1; > 0.8 when notebook rule applies. */
  fraud_probability: number;
  is_fraud: number;
};

type Store = {
  rows: QueueRow[];
  lastScoredAt: string | null;
  hydratedFromDb: boolean;
};

const globalForScoring = globalThis as unknown as { __scoringStore?: Store };

/** Hour 0–23 in UTC from stored order_datetime (ISO / SQLite-style). */
export function orderHourUtc(orderDatetime: string): number {
  const d = new Date(orderDatetime);
  if (!Number.isNaN(d.getTime())) return d.getUTCHours();
  // Fallback: "YYYY-MM-DD HH:MM:SS"
  const m = orderDatetime.match(/(\d{2}):(\d{2}):(\d{2})/);
  if (m) return Number(m[1]) % 24;
  return 12;
}

/**
 * Infer shipping country from DB fields (no shipping_country column on orders).
 * US-heavy dataset: 2-letter shipping_state → US.
 */
export function inferShippingCountry(shipping_state: string | null): string | null {
  if (!shipping_state || !shipping_state.trim()) return null;
  const s = shipping_state.trim();
  if (/^[A-Za-z]{2}$/.test(s)) return "US";
  return s.toUpperCase();
}

/**
 * Late delivery probability from notebook-style rules:
 * - order_total > 500 → higher base late risk
 * - order_hour after 8 PM (20:00–23:59 UTC) → 3× base late risk (capped at 1)
 */
export function computeLateProbability(orderTotal: number, orderHour: number): number {
  const afterEightPm = orderHour >= 20;

  let base =
    0.08 +
    (orderTotal > 500 ? 0.22 : 0) +
    Math.min(0.18, orderTotal / 12_000);

  if (afterEightPm) base = base * 3;

  return Math.min(1, Math.max(0, base));
}

/**
 * Fraud rule from notebook: unknown device + IP country ≠ shipping country → fraud probability > 80%.
 */
export function computeFraudRisk(
  deviceType: string,
  ipCountry: string,
  shippingCountry: string | null
): { fraud_probability: number; is_fraud: number } {
  const unknownDevice = deviceType.toLowerCase() === "unknown";
  const mismatch =
    shippingCountry != null &&
    shippingCountry.length > 0 &&
    ipCountry.toUpperCase() !== shippingCountry.toUpperCase();

  if (unknownDevice && mismatch) {
    return { fraud_probability: 0.87, is_fraud: 1 };
  }
  return { fraud_probability: 0.04, is_fraud: 0 };
}

export function applyScoringRules(row: Omit<QueueRow, "late_probability" | "fraud_probability" | "is_fraud">): QueueRow {
  const hour = orderHourUtc(row.order_datetime);
  const shipping_country = row.shipping_country ?? inferShippingCountry(row.shipping_state);
  const late_probability = computeLateProbability(row.order_total, hour);
  const { fraud_probability, is_fraud } = computeFraudRisk(row.device_type, row.ip_country, shipping_country);

  return {
    ...row,
    shipping_country,
    late_probability,
    fraud_probability,
    is_fraud,
  };
}

function syntheticInitRows(): QueueRow[] {
  const deviceTypes = ["desktop", "mobile", "tablet", "unknown"] as const;
  const ipCountries = ["US", "CA", "NG", "GB", "US"];
  const states: (string | null)[] = ["CA", "NY", "TX", null, "ON"];

  const templates = Array.from({ length: 50 }, (_, i) => {
    const orderId = 1000 + i + 1;
    const customerId = 500 + ((i * 7) % 50) + 1;
    // Mix of daytime vs after 8 PM UTC, low vs high totals
    const hourChoices = [9, 11, 15, 19, 20, 21, 22, 23];
    const h = hourChoices[i % hourChoices.length];
    const day = 10 + (i % 18);
    const order_datetime = `2024-06-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:30:00.000Z`;
    const order_total = i % 5 === 0 ? 620 + i * 3 : 40 + i * 12;
    const device_type = deviceTypes[i % deviceTypes.length];
    const ip_country = ipCountries[i % ipCountries.length];
    const shipping_state = states[i % states.length];

    const base: Omit<QueueRow, "late_probability" | "fraud_probability" | "is_fraud"> = {
      order_id: orderId,
      customer_id: customerId,
      order_datetime,
      order_total,
      device_type,
      ip_country,
      shipping_state,
      shipping_country: null,
    };

    return applyScoringRules(base);
  });

  return templates.sort((a, b) => b.late_probability - a.late_probability);
}

function initStore(): Store {
  return {
    rows: syntheticInitRows(),
    lastScoredAt: null,
    hydratedFromDb: false,
  };
}

export function getScoringStore(): Store {
  if (!globalForScoring.__scoringStore) globalForScoring.__scoringStore = initStore();
  return globalForScoring.__scoringStore;
}

async function tryHydrateFromDatabase(): Promise<void> {
  try {
    const { default: prisma } = await import("@/app/lib/prisma");
    const orders = await prisma.orders.findMany({
      take: 50,
      orderBy: { order_id: "desc" },
      select: {
        order_id: true,
        customer_id: true,
        order_datetime: true,
        order_total: true,
        device_type: true,
        ip_country: true,
        shipping_state: true,
      },
    });
    if (orders.length === 0) return;

    const store = getScoringStore();
    store.rows = orders.map((o) =>
      applyScoringRules({
        order_id: o.order_id,
        customer_id: o.customer_id,
        order_datetime: o.order_datetime,
        order_total: o.order_total,
        device_type: o.device_type,
        ip_country: o.ip_country,
        shipping_state: o.shipping_state,
        shipping_country: null,
      })
    );
    store.hydratedFromDb = true;
  } catch {
    // Vercel / no DB: keep synthetic rows
  }
}

/** Recompute all scores from current row features (deterministic; notebook rules). */
export async function runInMemoryScoring() {
  await tryHydrateFromDatabase();

  const store = getScoringStore();
  store.rows = store.rows.map((r) =>
    applyScoringRules({
      order_id: r.order_id,
      customer_id: r.customer_id,
      order_datetime: r.order_datetime,
      order_total: r.order_total,
      device_type: r.device_type,
      ip_country: r.ip_country,
      shipping_state: r.shipping_state,
      shipping_country: null,
    })
  );
  store.rows.sort((a, b) => b.late_probability - a.late_probability);
  store.lastScoredAt = new Date().toISOString();
  return { count: store.rows.length, lastScoredAt: store.lastScoredAt };
}
