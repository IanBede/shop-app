"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunScoringButton() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          setIsRunning(true);
          const res = await fetch("/api/score", { method: "POST" });
          const data: unknown = await res.json().catch(() => ({}));
          if (!res.ok) {
            const message =
              typeof data === "object" && data && "error" in data ? String((data as any).error) : "";
            alert(message ? `Scoring failed: ${message}` : "Scoring failed.");
            return;
          }

          router.refresh();
        } finally {
          setIsRunning(false);
        }
      }}
      disabled={isRunning}
      className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isRunning ? "Scoring..." : "Run Scoring"}
    </button>
  );
}

