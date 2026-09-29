"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";

function CallbackInner() {
  const params = useSearchParams();
  const { setToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const token = params.get("token");
    if (token) {
      setToken(token);
      router.replace("/dashboard");
    } else {
      router.replace("/login?error=1");
    }
  }, [params, setToken, router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-600">
      Completing sign in…
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackInner />
    </Suspense>
  );
}
