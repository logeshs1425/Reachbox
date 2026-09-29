"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { googleLoginUrl } from "@/lib/api";
import Image from "next/image";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#eef1f4] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-card p-10 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-brand text-xl font-bold text-white">
          R
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-500">
          Sign in to manage scheduled outreach
        </p>

        <a
          href={googleLoginUrl()}
          className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          <Image src="/google.svg" alt="" width={20} height={20} />
          Continue with Google
        </a>

        <p className="mt-6 text-xs text-slate-400">
          ReachInbox assignment demo — real Google OAuth
        </p>
      </div>
    </div>
  );
}
