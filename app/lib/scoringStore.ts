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

const scoringMeta = {
  lastScoredAt: null as string | null,
};

/** Hour 0–23 in UTC from stored order_datetime (ISO / SQLite-style). */
export function orderHourUtc(orderDatetime: string): number {
  const d = new Date(orderDatetime);
  if (!Number.isNaN(d.getTime())) return d.getUTCHours();
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

const orderSelect = {
  order_id: true,
  customer_id: true,
  order_datetime: true,
  order_total: true,
  device_type: true,
  ip_country: true,
  shipping_state: true,
} as const;

const orderSelectQueue = {
  ...orderSelect,
  late_probability: true,
  is_fraud: true,
} as const;

export const WAREHOUSE_PAGE_SIZE = 50;

export type WarehouseQueueResult = {
  rows: QueueRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

/**
 * One page of the priority queue (late_probability desc, then order_id desc).
 * Uses Prisma skip/take. Rows without a stored score sort last; display still uses computed fallbacks.
 */
export async function loadWarehouseQueue(page: number = 1): Promise<WarehouseQueueResult> {
  const { default: prisma } = await import("@/app/lib/prisma");
  const pageSize = WAREHOUSE_PAGE_SIZE;

  const rawPage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;

  const totalCount = await prisma.orders.count();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = totalCount === 0 ? 1 : Math.min(rawPage, totalPages);

  const orders = await prisma.orders.findMany({
    select: orderSelectQueue,
    orderBy: [
      { late_probability: { sort: "desc", nulls: "last" } },
      { order_id: "desc" },
    ],
    skip: (safePage - 1) * pageSize,
    take: pageSize,
  });

  const rows: QueueRow[] = orders.map((o) => {
    const computed = applyScoringRules({
      order_id: o.order_id,
      customer_id: o.customer_id,
      order_datetime: o.order_datetime,
      order_total: o.order_total,
      device_type: o.device_type,
      ip_country: o.ip_country,
      shipping_state: o.shipping_state,
      shipping_country: null,
    });
    return {
      ...computed,
      late_probability: o.late_probability ?? computed.late_probability,
      is_fraud: o.is_fraud,
      fraud_probability: computed.fraud_probability,
    };
  });

  return {
    rows,
    page: safePage,
    pageSize,
    totalCount,
    totalPages,
  };
}

export function getLastScoredAt(): string | null {
  return scoringMeta.lastScoredAt;
}

/** Load orders, compute scores, persist `late_probability` and `is_fraud` on each row. */
export async function runInMemoryScoring() {
  const { default: prisma } = await import("@/app/lib/prisma");

  const orders = await prisma.orders.findMany({
    select: orderSelect,
  });

  if (orders.length === 0) {
    scoringMeta.lastScoredAt = new Date().toISOString();
    return { count: 0, lastScoredAt: scoringMeta.lastScoredAt };
  }

  for (const o of orders) {
    const row = applyScoringRules({
      order_id: o.order_id,
      customer_id: o.customer_id,
      order_datetime: o.order_datetime,
      order_total: o.order_total,
      device_type: o.device_type,
      ip_country: o.ip_country,
      shipping_state: o.shipping_state,
      shipping_country: null,
    });
    await prisma.orders.update({
      where: { order_id: o.order_id },
      data: {
        late_probability: row.late_probability,
        is_fraud: row.is_fraud,
      },
    });
  }

  scoringMeta.lastScoredAt = new Date().toISOString();
  return { count: orders.length, lastScoredAt: scoringMeta.lastScoredAt };
}
