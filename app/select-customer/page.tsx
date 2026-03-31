import Link from "next/link";

import prisma from "@/app/lib/prisma";

export const runtime = "nodejs";

export default async function SelectCustomerPage() {
  const customers = await prisma.customers.findMany({
    orderBy: { full_name: "asc" },
    select: {
      customer_id: true,
      full_name: true,
      email: true,
      loyalty_tier: true,
      customer_segment: true,
      is_active: true,
    },
  });

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm font-medium text-zinc-700 hover:text-zinc-900 hover:underline"
          >
            Back to Home
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Select a customer
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Choose a customer to view their dashboard.
          </p>
        </header>

        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-6 py-4">
            <div className="text-sm font-medium text-zinc-900">
              Customers ({customers.length})
            </div>
          </div>

          <ul className="divide-y divide-zinc-200">
            {customers.map((c) => (
              <li key={c.customer_id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/${c.customer_id}`}
                      className="block truncate text-sm font-semibold text-zinc-900 hover:underline"
                    >
                      {c.full_name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
                      <span className="truncate">{c.email}</span>
                      {c.customer_segment ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700">
                          {c.customer_segment}
                        </span>
                      ) : null}
                      {c.loyalty_tier ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700">
                          {c.loyalty_tier}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0">
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset",
                        c.is_active === 1
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-zinc-50 text-zinc-600 ring-zinc-200",
                      ].join(" ")}
                    >
                      {c.is_active === 1 ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

