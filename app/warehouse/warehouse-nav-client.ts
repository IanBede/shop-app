/** Pure URL + pagination helpers for client components (no Prisma / scoring imports). */

export type ClientSortKey = "order_id" | "customer_id" | "late_probability" | "fraud_risk";
export type ClientSortDir = "asc" | "desc";

export function buildWarehouseHref(opts: {
  page?: number;
  sort: ClientSortKey;
  dir: ClientSortDir;
}): string {
  const p = new URLSearchParams();
  p.set("sort", opts.sort);
  p.set("dir", opts.dir);
  if (opts.page != null && opts.page > 1) {
    p.set("page", String(opts.page));
  }
  return `/warehouse?${p.toString()}`;
}

export function nextSortClick(
  clicked: ClientSortKey,
  sort: ClientSortKey,
  dir: ClientSortDir
): { sort: ClientSortKey; dir: ClientSortDir } {
  if (sort === clicked) {
    return { sort: clicked, dir: dir === "asc" ? "desc" : "asc" };
  }
  return { sort: clicked, dir: "desc" };
}

/** Compact numbered list: [1] … [48][49][50] … [100] */
export function getPaginationItems(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 0) return [];
  if (total <= 11) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const add = new Set<number>();
  add.add(1);
  add.add(total);
  for (let p = current - 2; p <= current + 2; p++) {
    if (p >= 1 && p <= total) add.add(p);
  }
  const sorted = [...add].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    if (i > 0 && cur - sorted[i - 1]! > 1) out.push("ellipsis");
    out.push(cur);
  }
  return out;
}
