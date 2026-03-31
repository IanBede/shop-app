export type QueueRow = {
  order_id: number;
  customer_id: number;
  late_probability: number;
};

type Store = {
  rows: QueueRow[];
  lastScoredAt: string | null;
};

const globalForScoring = globalThis as unknown as { __scoringStore?: Store };

function initStore(): Store {
  // Deterministic-ish seed so the table is stable before first scoring run.
  const rows: QueueRow[] = Array.from({ length: 50 }, (_, i) => {
    const orderId = 1000 + i + 1;
    const customerId = 500 + ((i * 7) % 50) + 1;
    const base = ((i * 13) % 100) / 100;
    return { order_id: orderId, customer_id: customerId, late_probability: base };
  }).sort((a, b) => b.late_probability - a.late_probability);

  return { rows, lastScoredAt: null };
}

export function getScoringStore(): Store {
  if (!globalForScoring.__scoringStore) globalForScoring.__scoringStore = initStore();
  return globalForScoring.__scoringStore;
}

export function runInMemoryScoring() {
  const store = getScoringStore();
  store.rows = store.rows
    .map((r) => ({ ...r, late_probability: Math.random() }))
    .sort((a, b) => b.late_probability - a.late_probability);
  store.lastScoredAt = new Date().toISOString();
  return { count: store.rows.length, lastScoredAt: store.lastScoredAt };
}

