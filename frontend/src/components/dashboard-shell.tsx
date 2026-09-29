"use client";

import { useCallback, useEffect, useState } from "react";
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

  const load = useCallback(async () => {
    if (!token) return;
    const list = await fetchEmails(token, variant);
    setEmails(list);
    if (list.length && !selectedId) setSelectedId(list[0].id);
  }, [token, variant, selectedId]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    load();
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
    getSlackStatus(token).then((s) => setSlackConnected(s.connected));
  }, [token]);

  useEffect(() => {
    if (!token || !search.trim()) {
      load();
      return;
    }
    const t = setTimeout(() => {
      searchEmails(token, search).then(setEmails);
    }, 300);
    return () => clearTimeout(t);
  }, [search, token, load]);

  async function onSlackConnect() {
    if (!token) return;
    const url = await getSlackConnectUrl(token);
    window.location.href = url;
  }

  async function onSlackDisconnect() {
    if (!token) return;
    await disconnectSlack(token);
    setSlackConnected(false);
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f4f6f8]">
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
            <div className="border-b border-slate-100 px-6 py-3">
              <h1 className="text-lg font-semibold text-slate-900">
                {variant === "scheduled" ? "Scheduled Emails" : "Sent Emails"}
              </h1>
            </div>
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
