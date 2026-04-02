import Link from "next/link";

import { getLastScoredAt, loadWarehouseQueue, WAREHOUSE_PAGE_SIZE } from "@/app/lib/scoringStore";

import { RunScoringButton } from "./RunScoringButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WarehousePage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const pageParam = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1;

  const { rows, page: currentPage, totalPages, totalCount } = await loadWarehouseQueue(page);
  const lastScoredAt = getLastScoredAt();

  const prevHref = `/warehouse?page=${currentPage - 1}`;
  const nextHref = `/warehouse?page=${currentPage + 1}`;

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
              {totalCount} orders — sorted by late probability (highest first).{" "}
              {totalPages > 1
                ? `Page ${currentPage} of ${totalPages} (${WAREHOUSE_PAGE_SIZE} per page).`
                : null}
            </p>
            {lastScoredAt ? (
              <p className="mt-1 text-xs text-zinc-500">
                Last scored: {new Date(lastScoredAt).toLocaleString()}
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

        {totalPages > 1 ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-6 py-4 shadow-sm">
            <div className="text-sm text-zinc-600">
              Showing {(currentPage - 1) * WAREHOUSE_PAGE_SIZE + 1}–
              {Math.min(currentPage * WAREHOUSE_PAGE_SIZE, totalCount)} of {totalCount}
            </div>
            <div className="flex items-center gap-2">
              {currentPage <= 1 ? (
                <span className="inline-flex cursor-not-allowed items-center rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-400">
                  Previous
                </span>
              ) : (
                <Link
                  href={prevHref}
                  className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                >
                  Previous
                </Link>
              )}
              {currentPage >= totalPages ? (
                <span className="inline-flex cursor-not-allowed items-center rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-400">
                  Next
                </span>
              ) : (
                <Link
                  href={nextHref}
                  className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

