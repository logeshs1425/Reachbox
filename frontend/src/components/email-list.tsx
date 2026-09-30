"use client";

import { format } from "date-fns";
import clsx from "clsx";
import { Paperclip } from "lucide-react";
import { EmailJob } from "@/lib/api";

function formatDateSafe(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : format(d, "dd MMM · h:mm a");
  } catch {
    return dateStr;
  }
}

type Props = {
  emails: EmailJob[];
  variant: "scheduled" | "sent";
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function EmailList({
  emails,
  variant,
  selectedId,
  onSelect,
}: Props) {
  if (emails.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-sm text-slate-500">
        No emails yet. Compose one to get started.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {emails.map((email) => {
        const active = selectedId === email.id;
        const preview = email.bodyText ?? email.bodyHtml.replace(/<[^>]+>/g, "");
        return (
          <li key={email.id}>
            <button
              type="button"
              onClick={() => onSelect(email.id)}
              className={clsx(
                "flex w-full gap-4 px-6 py-4 text-left transition hover:bg-slate-50",
                active && "bg-brand-light/40"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                {(email.toName ?? email.toEmail).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">
                    {email.toName ?? email.toEmail}
                  </span>
                  <span className="text-xs text-slate-400">
                    {email.toEmail}
                  </span>
                </div>
                <p className="flex items-center gap-1 truncate text-sm font-medium text-slate-800">
                  {email.subject}
                  {Array.isArray(email.attachmentsJson) && email.attachmentsJson.length > 0 && (
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  )}
                </p>
                <p className="truncate text-xs text-slate-500">{preview}</p>
              </div>
              <div className="shrink-0 text-right">
                {email.status === "FAILED" ? (
                  <span className="inline-flex rounded-full bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
                    Failed
                  </span>
                ) : variant === "sent" ? (
                  <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                    Sent
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                    {formatDateSafe(email.scheduledAt)}
                  </span>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
