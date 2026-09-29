"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // If a chunk failed to load (due to rebuild or dev server restart),
    // automatically reload the window once to fetch the new build assets.
    const isChunkError =
      error?.name === "ChunkLoadError" ||
      error?.message?.includes("Loading chunk") ||
      error?.message?.includes("ChunkLoadError");

    if (isChunkError) {
      const storageKey = "reachinbox_chunk_reload";
      const lastReload = sessionStorage.getItem(storageKey);
      const now = Date.now();
      // Reload at most once per 10 seconds to prevent any infinite reload loop
      if (!lastReload || now - Number(lastReload) > 10000) {
        sessionStorage.setItem(storageKey, String(now));
        window.location.reload();
        return;
      }
    }

    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6f8] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 font-bold text-lg">
          !
        </div>
        <h2 className="text-xl font-semibold text-slate-900">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {error?.message?.includes("Loading chunk")
            ? "New app updates are available. Please reload the page."
            : error?.message || "An unexpected error occurred."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark"
          >
            Reload Page
          </button>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
