"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Mail, Plus, Send } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/context/auth-context";

type Props = {
  onCompose: () => void;
};

export function Sidebar({ onCompose }: Props) {
  const pathname = usePathname();
  const { user } = useAuth();

  const nav = [
    { href: "/dashboard", label: "Scheduled", icon: Clock },
    { href: "/dashboard/sent", label: "Sent", icon: Send },
  ];

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
          R
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">ReachInbox</p>
          <p className="text-xs text-slate-500">Email scheduler</p>
        </div>
      </div>

      {user && (
        <div className="flex items-center gap-3 px-6 py-4">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt=""
              width={40}
              height={40}
              className="rounded-full"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-brand-light" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      )}

      <div className="px-4">
        <button
          type="button"
          onClick={onCompose}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark"
        >
          <Plus className="h-4 w-4" />
          Compose New Email
        </button>
      </div>

      <nav className="mt-6 flex flex-col gap-1 px-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-brand-light text-brand-dark"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-slate-100 p-4 text-xs text-slate-400">
        <Mail className="mb-1 h-4 w-4" />
        BullMQ + Redis scheduling
      </div>
    </aside>
  );
}
