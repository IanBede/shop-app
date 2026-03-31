import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import prisma from "@/app/lib/prisma";

export const runtime = "nodejs";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(isoLike: string) {
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return isoLike;
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function getOrderStatus(o: { shipments: { shipment_id: number; late_delivery: number } | null; is_fraud: number }) {
  if (o.is_fraud === 1) return "Flagged";
  if (o.shipments) return o.shipments.late_delivery === 1 ? "Delivered (Late)" : "Delivered";
  return "Processing";
}

export default async function CustomerDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const customerId = Number(id);
  const { error } = (await searchParams) ?? {};

  if (!Number.isFinite(customerId)) notFound();

  const customer = await prisma.customers.findUnique({
    where: { customer_id: customerId },
    select: {
      full_name: true,
      email: true,
      loyalty_tier: true,
      customer_segment: true,
      is_active: true,
    },
  });

  if (!customer) notFound();

  const orders = await prisma.orders.findMany({
    where: { customer_id: customerId },
    orderBy: { order_datetime: "desc" },
    select: {
      order_id: true,
      order_datetime: true,
      order_total: true,
      is_fraud: true,
      shipments: { select: { shipment_id: true, late_delivery: true } },
    },
  });

  async function placeNewOrder(formData: FormData) {
    "use server";

    try {
      const orderTotalRaw = formData.get("orderTotal");
      const orderTotal =
        typeof orderTotalRaw === "string" && orderTotalRaw.trim().length > 0
          ? Number(orderTotalRaw)
          : NaN;

      if (!Number.isFinite(orderTotal) || orderTotal < 0) {
        redirect(`/dashboard/${id}?error=${encodeURIComponent("Please enter a valid order total.")}`);
      }

      const nowIso = new Date().toISOString();

      // "Delivered" is derived from whether a shipment exists.
      // Create both the order + a shipment in a single transaction.
      const created = await prisma.$transaction(async (tx) => {
        const order = await tx.orders.create({
          data: {
            customer_id: customerId,
            order_datetime: nowIso,
            payment_method: "card",
            device_type: "web",
            ip_country: "US",
            promo_used: 0,
            promo_code: null,
            order_subtotal: orderTotal,
            shipping_fee: 0,
            tax_amount: 0,
            order_total: orderTotal,
            risk_score: 0,
            is_fraud: 0,
            billing_zip: null,
            shipping_zip: null,
            shipping_state: null,
          },
          select: { order_id: true },
        });

        await tx.shipments.create({
          data: {
            order_id: order.order_id,
            ship_datetime: nowIso,
            carrier: "internal",
            shipping_method: "standard",
            distance_band: "local",
            promised_days: 3,
            actual_days: 3,
            late_delivery: 0,
          },
          select: { shipment_id: true },
        });

        return order;
      });

      void created;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      redirect(
        `/dashboard/${id}?error=${encodeURIComponent(`Failed to create order: ${message}`)}`
      );
    }

    revalidatePath(`/dashboard/${id}`);
    redirect(`/dashboard/${id}`);
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="mb-8">
          <Link
            href="/select-customer"
            className="text-sm font-medium text-zinc-700 hover:text-zinc-900 hover:underline"
          >
            Back to Customer Selection
          </Link>
        </div>

        <header className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Dashboard for Customer ID: {id}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-600">
            <span>
              Customer:{" "}
              <span className="font-medium text-zinc-900">{customer.full_name}</span>
            </span>
            <span className="text-zinc-300">•</span>
            <span className="truncate">{customer.email}</span>
            {customer.customer_segment ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                {customer.customer_segment}
              </span>
            ) : null}
            {customer.loyalty_tier ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                {customer.loyalty_tier}
              </span>
            ) : null}
            <span
              className={[
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                customer.is_active === 1
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-zinc-50 text-zinc-600 ring-zinc-200",
              ].join(" ")}
            >
              {customer.is_active === 1 ? "Active" : "Inactive"}
            </span>
          </div>
        </header>

        {error ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <section className="mt-8 rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Order History</h2>
              <p className="mt-1 text-xs text-zinc-600">
                {orders.length} {orders.length === 1 ? "order" : "orders"} found
              </p>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="px-6 py-8 text-sm text-zinc-600">No orders yet.</div>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {orders.map((o) => {
                const status = getOrderStatus(o);
                return (
                  <li key={o.order_id} className="px-6 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-zinc-900">
                            Order #{o.order_id}
                          </div>
                          <span className="text-zinc-300">•</span>
                          <div className="text-sm text-zinc-600">{formatDate(o.order_datetime)}</div>
                        </div>
                        <div className="mt-1 text-xs text-zinc-600">
                          Total:{" "}
                          <span className="font-medium text-zinc-900">
                            {formatCurrency(o.order_total)}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset",
                            status === "Flagged"
                              ? "bg-rose-50 text-rose-700 ring-rose-200"
                              : status.startsWith("Delivered")
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                : "bg-amber-50 text-amber-700 ring-amber-200",
                          ].join(" ")}
                        >
                          {status}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Place New Order</h2>
          <p className="mt-1 text-sm text-zinc-600">
            This creates a placeholder order for customer #{customerId}.
          </p>

          <form action={placeNewOrder} className="mt-4">
            <div className="flex flex-col gap-2 sm:max-w-xs">
              <label htmlFor="orderTotal" className="text-sm font-medium text-zinc-900">
                Order Total
              </label>
              <input
                id="orderTotal"
                name="orderTotal"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                required
              />
            </div>

            <button
              type="submit"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Create order
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

