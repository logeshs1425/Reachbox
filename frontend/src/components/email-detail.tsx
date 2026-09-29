"use client";

import { format } from "date-fns";
import { EmailJob } from "@/lib/api";

export function EmailDetail({ email }: { email: EmailJob | null }) {
  if (!email) {
    return (
      <div className="hidden lg:flex flex-1 items-center justify-center border-l border-slate-100 bg-slate-50/50 text-sm text-slate-400">
        Select an email to preview
      </div>
    );
  }

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
            {format(new Date(email.scheduledAt), "PPpp")}
          </span>
        </div>
      </div>
      <div
        className="flex-1 overflow-auto px-8 py-6 prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
      />
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
