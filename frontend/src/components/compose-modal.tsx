"use client";

import { useEffect, useRef, useState } from "react";
import { addHours, addDays, setHours, setMinutes } from "date-fns";
import { Paperclip, X, Upload } from "lucide-react";
import { createEmail } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultFrom?: string;
};

// 5 MB per file limit (matches backend multer limit)
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 10;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Lead = { email: string; name?: string };

export function ComposeModal({
  open,
  onClose,
  onCreated,
  defaultFrom,
}: Props) {
  const { token, user } = useAuth();
  
  // Basic Fields
  const [fromEmail, setFromEmail] = useState(defaultFrom ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  
  // Mode: single vs bulk
  const [isBulk, setIsBulk] = useState(false);
  const [toEmail, setToEmail] = useState("");
  const [toName, setToName] = useState("");
  
  // Bulk Fields
  const [leads, setLeads] = useState<Lead[]>([]);
  const [csvName, setCsvName] = useState<string | null>(null);
  
  // Schedule & Campaign Config
  const [scheduledAt, setScheduledAt] = useState("");
  const [delaySeconds, setDelaySeconds] = useState<string>("0");
  const [hourlyLimit, setHourlyLimit] = useState<string>("0");
  
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.email && !fromEmail) setFromEmail(user.email);
  }, [user, fromEmail]);

  if (!open) return null;

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files);
    const oversized = incoming.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length) {
      setError(`Some files exceed the 5 MB limit: ${oversized.map((f) => f.name).join(", ")}`);
      return;
    }
    setAttachments((prev) => {
      const combined = [...prev, ...incoming];
      if (combined.length > MAX_FILES) {
        setError(`You can attach at most ${MAX_FILES} files.`);
        return prev;
      }
      return combined;
    });
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      
      const parsedLeads: Lead[] = [];
      let hasHeader = false;
      
      if (lines.length > 0 && lines[0].toLowerCase().includes("email")) {
        hasHeader = true;
      }
      
      const startIndex = hasHeader ? 1 : 0;
      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(",").map(p => p.trim());
        if (parts.length > 0 && parts[0].includes("@")) {
          parsedLeads.push({ email: parts[0], name: parts[1] || undefined });
        } else if (parts.length > 1 && parts[1].includes("@")) {
          parsedLeads.push({ email: parts[1], name: parts[0] || undefined });
        }
      }
      
      if (parsedLeads.length > 0) {
        setLeads(parsedLeads);
        setError(null);
      } else {
        setError("Could not find valid email addresses in the CSV file.");
      }
    };
    reader.readAsText(file);
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  async function submit(scheduleIso: string) {
    if (!token) return;
    
    if (isBulk && leads.length === 0) {
      setError("Please upload a CSV file with leads first.");
      return;
    }
    if (!isBulk && !toEmail) {
      setError("Please provide a recipient email address.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createEmail(token, {
        fromEmail,
        toEmail: isBulk ? undefined : toEmail,
        toName: isBulk ? undefined : (toName || undefined),
        leads: isBulk ? leads : undefined,
        subject,
        bodyHtml: `<p>${body
          .replace(/[&<>"']/g, (char) =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!
          )
          .replace(/\n/g, "<br/>")}</p>`,
        bodyText: body,
        scheduledAt: scheduleIso,
        delaySeconds: isBulk && delaySeconds ? parseInt(delaySeconds, 10) : undefined,
        hourlyLimit: isBulk && hourlyLimit ? parseInt(hourlyLimit, 10) : undefined,
        attachments,
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
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold">Compose New Email</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Fields ── */}
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

          {/* Mode Switcher */}
          <div className="flex gap-4 border-b border-slate-100 pb-2">
            <button
              type="button"
              onClick={() => setIsBulk(false)}
              className={`text-sm font-medium pb-2 border-b-2 ${!isBulk ? 'border-brand text-brand' : 'border-transparent text-slate-500'}`}
            >
              Single Recipient
            </button>
            <button
              type="button"
              onClick={() => setIsBulk(true)}
              className={`text-sm font-medium pb-2 border-b-2 ${isBulk ? 'border-brand text-brand' : 'border-transparent text-slate-500'}`}
            >
              Bulk Upload (CSV)
            </button>
          </div>

          {!isBulk ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-slate-600">To</span>
                <input
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="recipient@example.com"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Recipient name</span>
                <input
                  value={toName}
                  onChange={(e) => setToName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="Optional"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="block text-sm">
                <span className="text-slate-600">Upload Leads (CSV/Text)</span>
                <div className="mt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => csvInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Upload className="h-4 w-4" />
                    Select CSV File
                  </button>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={handleCsvUpload}
                  />
                  {leads.length > 0 && (
                    <span className="text-brand font-medium">
                      {leads.length} leads detected ({csvName})
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Format: email, name (one per line)
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <label className="block text-sm">
                  <span className="text-slate-600">Delay between emails (seconds)</span>
                  <input
                    type="number"
                    min="0"
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-600">Hourly Limit</span>
                  <input
                    type="number"
                    min="0"
                    value={hourlyLimit}
                    onChange={(e) => setHourlyLimit(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder="0 for unlimited"
                  />
                </label>
              </div>
            </div>
          )}

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

          {/* ── Attachments ── */}
          <div className="block text-sm">
            <span className="text-slate-600">Attachments</span>
            <div className="mt-1">
              <div
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-slate-500 hover:border-brand hover:text-brand transition-colors"
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-brand"); }}
                onDragLeave={(e) => e.currentTarget.classList.remove("border-brand")}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-brand");
                  handleFiles(e.dataTransfer.files);
                }}
              >
                <Paperclip className="h-4 w-4 shrink-0" />
                <span className="text-sm">
                  Click to attach or drag &amp; drop files (max 5 MB each, up to {MAX_FILES} files)
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attachments.map((file, idx) => (
                    <li
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate font-medium text-slate-700">{file.name}</span>
                        <span className="shrink-0 text-xs text-slate-400">{formatBytes(file.size)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="ml-2 shrink-0 text-slate-400 hover:text-rose-500"
                        title="Remove attachment"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <label className="block text-sm">
            <span className="text-slate-600">Start Time (ISO) or use Send Later</span>
            <input
              type="datetime-local"
              value={
                scheduledAt && !isNaN(new Date(scheduledAt).getTime())
                  ? new Date(
                      new Date(scheduledAt).getTime() -
                        new Date().getTimezoneOffset() * 60000
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ""
              }
              onChange={(e) => {
                const val = e.target.value;
                if (!val) { setScheduledAt(""); return; }
                const parsed = new Date(val);
                if (!isNaN(parsed.getTime())) setScheduledAt(parsed.toISOString());
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* ── Footer ── */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            title="Add attachments"
          >
            <Paperclip className="h-4 w-4" />
            {attachments.length > 0 ? `${attachments.length} file${attachments.length > 1 ? "s" : ""}` : "Attach"}
          </button>

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
            {saving ? "Scheduling…" : (isBulk ? `Schedule ${leads.length || ''} emails` : "Schedule send")}
          </button>
        </div>
      </div>
    </div>
  );
}
