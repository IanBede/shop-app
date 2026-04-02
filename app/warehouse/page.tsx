import Link from "next/link";

import {
  getLastScoredAt,
  loadWarehouseQueue,
  parseWarehouseQuery,
  WAREHOUSE_PAGE_SIZE,
  type WarehouseSortKey,
} from "@/app/lib/scoringStore";

import { RunScoringButton } from "./RunScoringButton";
import { WarehousePaginationBar } from "./WarehousePaginationBar";
import { WarehouseShell } from "./WarehouseShell";
import { WarehouseSortRow } from "./WarehouseSortRow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sortLabel(sort: WarehouseSortKey): string {
  switch (sort) {
    case "order_id":
      return "Order ID";
    case "customer_id":
      return "Customer ID";
    case "late_probability":
      return "late probability";
    case "fraud_risk":
      return "fraud probability";
    default:
      return sort;
  }
}

export default async function WarehousePage({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string | string[];
    sort?: string | string[];
    dir?: string | string[];
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const { page: requestedPage, sort, dir } = parseWarehouseQuery(sp);

  let queue:
    | Awaited<ReturnType<typeof loadWarehouseQueue>>
    | null = null;
  let loadError: string | null = null;

  try {
    queue = await loadWarehouseQueue({ page: requestedPage, sort, dir });
  } catch (err) {
    console.error("[warehouse] loadWarehouseQueue failed:", err);
    loadError =
      err instanceof Error ? err.message : "Could not load warehouse data.";
  }

  const lastScoredAt = getLastScoredAt();

  if (loadError || !queue) {
    return (
      <WarehouseShell>
        <div className="min-h-screen bg-zinc-50">
          <div className="mx-auto w-full max-w-5xl px-6 py-12">
            <Link
              href="/"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              Back to Home
            </Link>
            <div className="mt-10 max-w-lg rounded-xl border border-rose-200 bg-rose-50 px-6 py-8">
              <h1 className="text-lg font-semibold text-rose-900">
                Warehouse queue unavailable
              </h1>
              <p className="mt-2 text-sm text-rose-800">
                We couldn&apos;t load orders from the database. Check your connection string
                and that the schema is deployed (including{" "}
                <code className="rounded bg-rose-100 px-1 py-0.5 text-xs">
                  fraud_probability
                </code>{" "}
                on <code className="rounded bg-rose-100 px-1 py-0.5 text-xs">orders</code>).
                Try again in a moment.
              </p>
              {process.env.NODE_ENV === "development" && loadError ? (
                <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
                  {loadError}
                </pre>
              ) : null}
            </div>
          </div>
        </div>
      </WarehouseShell>
    );
  }

  const {
    rows,
    page: currentPage,
    pageSize,
    totalPages,
    totalCount,
    sort: activeSort,
    dir: activeDir,
  } = queue;

  return (
    <WarehouseShell>
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
                {totalCount} orders — sorted by {sortLabel(activeSort)} ({activeDir}).{" "}
                {WAREHOUSE_PAGE_SIZE} per page.
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-800">
                Page {currentPage} of {totalPages}
              </p>
              {lastScoredAt ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Last scored: {new Date(lastScoredAt).toLocaleString()}
                </p>
              ) : null}
            </div>

            <RunScoringButton />
          </div>

          {totalCount > 0 ? (
            <div className="mb-4">
              <WarehousePaginationBar
                placement="top"
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
                sort={activeSort}
                dir={activeDir}
              />
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50">
                  <WarehouseSortRow sort={activeSort} dir={activeDir} />
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {rows.map((r) => {
                    const isMedium =
                      r.fraud_probability >= 0.11 &&
                      r.fraud_probability <= 0.13 &&
                      r.is_fraud !== 1;
                    return (
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
                          <span
                            className={
                              r.is_fraud === 1
                                ? "font-semibold text-rose-700"
                                : isMedium
                                  ? "font-medium text-amber-800"
                                  : ""
                            }
                          >
                            {(Math.round(r.fraud_probability * 1000) / 10).toFixed(1)}%
                            {r.is_fraud === 1
                              ? " (flagged)"
                              : isMedium
                                ? " (medium)"
                                : ""}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
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

          {totalCount > 0 ? (
            <div className="mt-4">
              <WarehousePaginationBar
                placement="bottom"
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
                sort={activeSort}
                dir={activeDir}
              />
            </div>
          ) : null}
        </div>
      </div>
    </WarehouseShell>
  );
}
