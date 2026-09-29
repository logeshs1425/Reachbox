"use client";

import { format } from "date-fns";
import { Paperclip } from "lucide-react";
import { AttachmentMeta, EmailJob } from "@/lib/api";

function formatDateSafe(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : format(d, "PPpp");
  } catch {
    return dateStr;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmailDetail({ email }: { email: EmailJob | null }) {
  if (!email) {
    return (
      <div className="hidden lg:flex flex-1 items-center justify-center border-l border-slate-100 bg-slate-50/50 text-sm text-slate-400">
        Select an email to preview
      </div>
    );
  }

  const attachments: AttachmentMeta[] = Array.isArray(email.attachmentsJson)
    ? email.attachmentsJson
    : [];

  return (
    <div className="hidden lg:flex flex-1 flex-col border-l border-slate-100 bg-white">
      <div className="border-b border-slate-100 px-8 py-6">
        <p className="text-xs uppercase tracking-wide text-slate-400">Subject</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          {email.subject}
        </h2>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
          <span>
            <strong className="text-slate-800">From:</strong> {email.fromEmail}
          </span>
          <span>
            <strong className="text-slate-800">To:</strong> {email.toEmail}
          </span>
          <span>
            <strong className="text-slate-800">When:</strong>{" "}
            {formatDateSafe(email.scheduledAt)}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto whitespace-pre-wrap px-8 py-6 text-sm leading-7 text-slate-700">
        {email.bodyText ?? email.bodyHtml.replace(/<[^>]*>/g, "")}
      </div>

      {/* ── Attachments ── */}
      {attachments.length > 0 && (
        <div className="border-t border-slate-100 px-8 py-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            <Paperclip className="h-3.5 w-3.5" />
            {attachments.length} Attachment{attachments.length > 1 ? "s" : ""}
          </p>
          <ul className="space-y-1">
            {attachments.map((att, idx) => (
              <li
                key={`${att.filename}-${idx}`}
                className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate font-medium text-slate-700">
                  {att.filename}
                </span>
                <span className="ml-auto shrink-0 text-xs text-slate-400">
                  {formatBytes(att.size)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {email.etherealPreview && (
        <div className="border-t border-slate-100 px-8 py-4 text-sm">
          <a
            href={email.etherealPreview}
            target="_blank"
            rel="noreferrer"
            className="text-brand font-medium hover:underline"
          >
            View in Ethereal preview →
          </a>
        </div>
      )}
    </div>
  );
}
