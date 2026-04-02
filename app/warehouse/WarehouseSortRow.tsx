"use client";

import {
  buildWarehouseHref,
  nextSortClick,
  type ClientSortDir,
  type ClientSortKey,
} from "./warehouse-nav-client";

import { useWarehouseNavigate } from "./WarehouseShell";

type Props = {
  sort: ClientSortKey;
  dir: ClientSortDir;
};

function SortableTh({
  column,
  label,
  sort,
  dir,
}: {
  column: ClientSortKey;
  label: string;
  sort: ClientSortKey;
  dir: ClientSortDir;
}) {
  const { navigate, isPending } = useWarehouseNavigate();
  const { sort: nextSort, dir: nextDir } = nextSortClick(column, sort, dir);
  const href = buildWarehouseHref({ page: 1, sort: nextSort, dir: nextDir });
  const active = sort === column;
  const arrow = active ? (dir === "asc" ? " ↑" : " ↓") : "";

  return (
    <th
      scope="col"
      className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600"
    >
      <button
        type="button"
        disabled={isPending}
        onClick={() => navigate(href)}
        className="inline-flex items-center gap-1 rounded-md text-left text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
      >
        {label}
        <span className="font-normal normal-case text-zinc-500" aria-hidden>
          {arrow}
        </span>
        {active ? (
          <span className="sr-only">
            ({dir === "asc" ? "ascending" : "descending"})
          </span>
        ) : null}
      </button>
    </th>
  );
}

export function WarehouseSortRow({ sort, dir }: Props) {
  return (
    <tr>
      <SortableTh column="order_id" label="Order ID" sort={sort} dir={dir} />
      <SortableTh
        column="customer_id"
        label="Customer ID"
        sort={sort}
        dir={dir}
      />
      <SortableTh
        column="late_probability"
        label="Late Probability"
        sort={sort}
        dir={dir}
      />
      <SortableTh column="fraud_risk" label="Fraud risk" sort={sort} dir={dir} />
    </tr>
  );
}
