"use client";

import Image from "next/image";
import { LogOut, Search } from "lucide-react";
import { useAuth } from "@/context/auth-context";

type Props = {
  search: string;
  onSearch: (v: string) => void;
  slackConnected: boolean;
  onSlackConnect: () => void;
  onSlackDisconnect: () => void;
};

export function TopHeader({
  search,
  onSearch,
  slackConnected,
  onSlackConnect,
  onSlackDisconnect,
}: Props) {
  const { user, logout } = useAuth();

  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-6 py-4">
      <div className="relative min-w-[200px] flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search emails (Elasticsearch)…"
          className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-3 text-sm outline-none focus:border-brand"
        />
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {slackConnected ? (
          <button
            type="button"
            onClick={onSlackDisconnect}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Disconnect Slack
          </button>
        ) : (
          <button
            type="button"
            onClick={onSlackConnect}
            className="rounded-lg bg-[#4A154B] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            Connect Slack
          </button>
        )}

        {user && (
          <>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-slate-900">
                {user.name}
              </span>
              <span className="text-xs text-slate-500">{user.email}</span>
            </div>
            {user.avatarUrl && (
              <Image
                src={user.avatarUrl}
                alt=""
                width={36}
                height={36}
                className="rounded-full"
              />
            )}
            <button
              type="button"
              onClick={() => logout().then(() => (window.location.href = "/login"))}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}
