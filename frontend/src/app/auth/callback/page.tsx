"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { exchangeLoginCode } from "@/lib/api";

function CallbackInner() {
  const params = useSearchParams();
  const { setToken } = useAuth();
  const router = useRouter();
  const exchangedRef = useRef(false);

  useEffect(() => {
    if (exchangedRef.current) return;
    const code = params.get("code");
    if (!code) {
      router.replace("/login?error=1");
      return;
    }
    exchangedRef.current = true;
    exchangeLoginCode(code)
      .then(async (token) => {
        await setToken(token);
        router.replace("/dashboard");
      })
      .catch((err) => {
        console.error("Auth exchange error:", err);
        router.replace("/login?error=1");
      });
  }, [params, setToken, router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-600">
      Completing sign in…
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-600">Loading…</div>}>
      <CallbackInner />
    </Suspense>
  );
}
