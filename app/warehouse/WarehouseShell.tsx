"use client";

import {
  createContext,
  useCallback,
  useContext,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type Nav = {
  navigate: (href: string) => void;
  isPending: boolean;
};

const WarehouseNavContext = createContext<Nav | null>(null);

export function WarehouseShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href);
      });
    },
    [router]
  );

  return (
    <WarehouseNavContext.Provider value={{ navigate, isPending }}>
      {isPending ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/20 backdrop-blur-[1px]"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white px-10 py-8 shadow-lg">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900"
              aria-hidden
            />
            <p className="text-sm font-medium text-zinc-900">Loading…</p>
          </div>
        </div>
      ) : null}
      {children}
    </WarehouseNavContext.Provider>
  );
}

export function useWarehouseNavigate(): Nav {
  const ctx = useContext(WarehouseNavContext);
  if (!ctx) {
    throw new Error("useWarehouseNavigate must be used within WarehouseShell");
  }
  return ctx;
}
