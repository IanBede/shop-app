"use client";

import {
  buildWarehouseHref,
  getPaginationItems,
  type ClientSortDir,
  type ClientSortKey,
} from "./warehouse-nav-client";

import { useWarehouseNavigate } from "./WarehouseShell";

type Props = {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  sort: ClientSortKey;
  dir: ClientSortDir;
  /** "top" | "bottom" for aria-label distinction */
  placement: "top" | "bottom";
};

export function WarehousePaginationBar({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  sort,
  dir,
  placement,
}: Props) {
  const { navigate, isPending } = useWarehouseNavigate();
  const items = getPaginationItems(currentPage, totalPages);

  const prevHref = buildWarehouseHref({
    page: currentPage > 1 ? currentPage - 1 : 1,
    sort,
    dir,
  });
  const nextHref = buildWarehouseHref({
    page: currentPage + 1,
    sort,
    dir,
  });

  const label = placement === "top" ? "Top pagination" : "Bottom pagination";

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
      aria-label={label}
    >
      <button
        type="button"
        disabled={currentPage <= 1 || isPending}
        onClick={() => navigate(prevHref)}
        className="inline-flex min-w-[5rem] items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>

      <div className="flex max-w-full flex-wrap items-center justify-center gap-1 sm:gap-1.5">
        {items.map((item, idx) =>
          item === "ellipsis" ? (
            <span
              key={`e-${idx}`}
              className="px-1 text-sm text-zinc-400"
              aria-hidden
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              disabled={isPending}
              onClick={() =>
                navigate(buildWarehouseHref({ page: item, sort, dir }))
              }
              className={[
                "min-w-[2.25rem] rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                item === currentPage
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100",
              ].join(" ")}
              aria-current={item === currentPage ? "page" : undefined}
            >
              {item}
            </button>
          )
        )}
      </div>

      <button
        type="button"
        disabled={currentPage >= totalPages || isPending}
        onClick={() => navigate(nextHref)}
        className="inline-flex min-w-[5rem] items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>

      <span className="w-full text-center text-xs text-zinc-500 sm:ml-2 sm:w-auto">
        {(currentPage - 1) * pageSize + 1}–
        {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
      </span>
    </nav>
  );
}
