"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  disconnectSlack,
  EmailJob,
  fetchEmail,
  fetchEmails,
  getSlackConnectUrl,
  getSlackStatus,
  searchEmails,
} from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { TopHeader } from "@/components/top-header";
import { EmailList } from "@/components/email-list";
import { EmailDetail } from "@/components/email-detail";
import { ComposeModal } from "@/components/compose-modal";

type Props = {
  variant: "scheduled" | "sent";
};

export function DashboardShell({ variant }: Props) {
  const { token, user, loading } = useAuth();
  const router = useRouter();
  const [emails, setEmails] = useState<EmailJob[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<EmailJob | null>(null);
  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const searchMountedRef = useRef(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const list = await fetchEmails(token, variant);
      setEmails(list);
      setLoadError(null);
      setSelectedId((prev) => {
        if (!list.length) return null;
        if (!prev || !list.some((email) => email.id === prev)) return list[0].id;
        return prev;
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load emails");
    }
  }, [token, variant]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!token || !selectedId) {
      setSelected(null);
      return;
    }
    fetchEmail(token, selectedId).then(setSelected).catch(() => setSelected(null));
  }, [token, selectedId]);

  useEffect(() => {
    if (!token) return;
    getSlackStatus(token).then((s) => setSlackConnected(s.connected)).catch(() => setSlackConnected(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (!searchMountedRef.current) {
      searchMountedRef.current = true;
      return;
    }
    if (!search.trim()) {
      load();
      return;
    }
    const t = setTimeout(() => {
      searchEmails(token, search).then((results) => {
        setEmails(results);
        setSelectedId(results[0]?.id ?? null);
        setLoadError(null);
      }).catch(() => setLoadError("Search is temporarily unavailable"));
    }, 300);
    return () => clearTimeout(t);
  }, [search, token, load]);

  async function onSlackConnect() {
    if (!token) return;
    try {
      const url = await getSlackConnectUrl(token);
      window.location.href = url;
    } catch {
      setLoadError("Slack OAuth is not configured on the server yet");
    }
  }

  async function onSlackDisconnect() {
    if (!token) return;
    try {
      await disconnectSlack(token);
      setSlackConnected(false);
    } catch {
      setLoadError("Could not disconnect Slack. Please try again.");
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-[620px] overflow-hidden bg-[#f4f6f8]">
      <Sidebar onCompose={() => setComposeOpen(true)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader
          search={search}
          onSearch={setSearch}
          slackConnected={slackConnected}
          onSlackConnect={onSlackConnect}
          onSlackDisconnect={onSlackDisconnect}
        />
        <div className="flex flex-1 overflow-hidden">
          <div className="flex w-full max-w-xl flex-col overflow-auto bg-white shadow-card lg:max-w-md">
            <div className="border-b border-slate-100 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-semibold text-slate-900">
                    {variant === "scheduled" ? "Scheduled Emails" : "Sent Emails"}
                  </h1>
                  <p className="mt-1 text-xs text-slate-500">{emails.length} {emails.length === 1 ? "email" : "emails"}</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-400" title="Automatically refreshed" />
              </div>
            </div>
            {loadError && <div role="alert" className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</div>}
            <EmailList
              emails={emails}
              variant={variant}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
          <EmailDetail email={selected} />
        </div>
      </div>
      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onCreated={load}
      />
    </div>
  );
}
