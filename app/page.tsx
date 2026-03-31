import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto w-full max-w-4xl px-6 py-16">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Shop ML Pipeline Dashboard
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Choose a workspace to continue.
          </p>
        </header>

        <div className="grid gap-6 sm:grid-cols-2">
          <Link
            href="/select-customer"
            className="group rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-lg font-semibold text-zinc-900">Customer Portal</div>
            <div className="mt-2 text-sm text-zinc-600">
              Browse customers and view dashboards.
            </div>
            <div className="mt-6 inline-flex items-center text-sm font-semibold text-zinc-900 group-hover:underline">
              Open
            </div>
          </Link>

          <Link
            href="/warehouse"
            className="group rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-lg font-semibold text-zinc-900">Warehouse Management</div>
            <div className="mt-2 text-sm text-zinc-600">
              Inventory and fulfillment workflows.
            </div>
            <div className="mt-6 inline-flex items-center text-sm font-semibold text-zinc-900 group-hover:underline">
              Open
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
