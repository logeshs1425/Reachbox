"use client";

import { useEffect, useState } from "react";
import { addHours, addDays, setHours, setMinutes } from "date-fns";
import { X } from "lucide-react";
import { createEmail } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultFrom?: string;
};

export function ComposeModal({
  open,
  onClose,
  onCreated,
  defaultFrom,
}: Props) {
  const { token, user } = useAuth();
  const [fromEmail, setFromEmail] = useState(defaultFrom ?? "");
  const [toEmail, setToEmail] = useState("");
  const [toName, setToName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email && !fromEmail) setFromEmail(user.email);
  }, [user, fromEmail]);

  if (!open) return null;

  async function submit(scheduleIso: string) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await createEmail(token, {
        fromEmail,
        toEmail,
        toName: toName || undefined,
        subject,
        bodyHtml: `<p>${body.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!).replace(/\n/g, "<br/>")}</p>`,
        bodyText: body,
        scheduledAt: scheduleIso,
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  function pickQuick(option: string) {
    const now = new Date();
    let date = now;
    if (option === "tomorrow") {
      date = addDays(now, 1);
      date.setHours(10, 0, 0, 0);
    } else if (option === "tomorrow-10") {
      date = setMinutes(setHours(addDays(now, 1), 10), 0);
    } else if (option === "tomorrow-14") {
      date = setMinutes(setHours(addDays(now, 1), 14), 0);
    } else if (option === "tomorrow-17") {
      date = setMinutes(setHours(addDays(now, 1), 17), 0);
    } else if (option === "hour") {
      date = addHours(now, 1);
    }
    setScheduledAt(date.toISOString());
    setShowScheduleMenu(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold">Compose New Email</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <label className="block text-sm">
            <span className="text-slate-600">From (sender)</span>
            <input
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="sender@yourdomain.com"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-600">To</span>
              <input
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Recipient name</span>
              <input
                value={toName}
                onChange={(e) => setToName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-slate-600">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Body</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Schedule (ISO) or use Send Later</span>
            <input
              type="datetime-local"
              value={scheduledAt ? new Date(new Date(scheduledAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
              onChange={(e) =>
                setScheduledAt(new Date(e.target.value).toISOString())
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <div className="relative mr-auto">
            <button
              type="button"
              onClick={() => setShowScheduleMenu((s) => !s)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Send Later ▾
            </button>
            {showScheduleMenu && (
              <div className="absolute bottom-full mb-2 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-sm">
                {[
                  ["hour", "In 1 hour"],
                  ["tomorrow-10", "Tomorrow, 10:00 AM"],
                  ["tomorrow-14", "Tomorrow, 2:00 PM"],
                  ["tomorrow-17", "Tomorrow, 5:00 PM"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className="block w-full px-4 py-2 text-left hover:bg-slate-50"
                    onClick={() => pickQuick(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              const when = scheduledAt || new Date(Date.now() + 60_000).toISOString();
              submit(when);
            }}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {saving ? "Scheduling…" : "Schedule send"}
          </button>
        </div>
      </div>
    </div>
  );
}
