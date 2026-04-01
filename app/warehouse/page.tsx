import Link from "next/link";

import { getScoringStore } from "@/app/lib/scoringStore";

import { RunScoringButton } from "./RunScoringButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WarehousePage() {
  const store = getScoringStore();
  const rows = store.rows.slice(0, 50);

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm font-medium text-zinc-700 hover:text-zinc-900 hover:underline"
          >
            Back to Home
          </Link>
        </div>

        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Late Delivery Priority Queue
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Top 50 orders sorted by late probability (descending).
            </p>
            {store.lastScoredAt ? (
              <p className="mt-1 text-xs text-zinc-500">
                Last scored: {new Date(store.lastScoredAt).toLocaleString()}
              </p>
            ) : null}
          </div>

          <RunScoringButton />
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600"
                  >
                    Order ID
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600"
                  >
                    Customer ID
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600"
                  >
                    Late Probability
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600"
                  >
                    Fraud risk
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white">
                {rows.map((r) => (
                  <tr key={r.order_id} className="hover:bg-zinc-50/70">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-zinc-900">
                      {r.order_id}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-700">
                      {r.customer_id}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-700">
                      {(Math.round(r.late_probability * 1000) / 10).toFixed(1)}%
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-700">
                      <span className={r.is_fraud === 1 ? "font-semibold text-rose-700" : ""}>
                        {(Math.round(r.fraud_probability * 1000) / 10).toFixed(1)}%
                        {r.is_fraud === 1 ? " (flagged)" : ""}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-sm text-zinc-600" colSpan={4}>
                      No orders found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

