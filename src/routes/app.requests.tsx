import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Check, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { Avatar } from "@/components/Avatar";
import { useSession } from "@/hooks/useSession";
import { displayName, initials, type Profile } from "@/lib/chat";

export const Route = createFileRoute("/app/requests")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Message requests — Chat Ebola" },
      { name: "description", content: "Accept or decline the people who asked to message you on Chat Ebola." },
      { property: "og:title", content: "Message requests — Chat Ebola" },
      { property: "og:description", content: "Accept or decline the people who asked to message you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AuthGate>
      <RequestsPage />
    </AuthGate>
  ),
});

type RequestRow = { id: string; from_user: string; to_user: string; status: string; created_at: string };

function RequestsPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState<RequestRow[]>([]);
  const [outgoing, setOutgoing] = useState<RequestRow[]>([]);
  const [people, setPeople] = useState<Map<string, Profile>>(new Map());

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("chat_requests").select("*");
    const rows = (data ?? []) as RequestRow[];
    setIncoming(rows.filter((r) => r.to_user === user.id && r.status === "pending"));
    setOutgoing(rows.filter((r) => r.from_user === user.id));
    const ids = Array.from(new Set(rows.flatMap((r) => [r.from_user, r.to_user]).filter((id) => id !== user.id)));
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
      setPeople(new Map(((profiles ?? []) as Profile[]).map((p) => [p.id, p])));
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_requests" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  async function respond(row: RequestRow, status: "accepted" | "declined") {
    const { error } = await supabase.from("chat_requests").update({ status }).eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
    if (status === "accepted") {
      const { data, error: rpcError } = await supabase.rpc("start_direct_chat", { _peer: row.from_user });
      if (!rpcError && data) void navigate({ to: "/app/chat/$id", params: { id: data as string } });
    }
  }

  return (
    <AppShell title="Requests" tab="requests">
      {incoming.length === 0 && outgoing.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No requests"
          body="When someone with privacy mode on asks to message you, it shows up here."
        />
      ) : (
        <div className="space-y-6 px-4 py-3">
          <section>
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Waiting for you
            </h2>
            {incoming.length === 0 && <p className="text-sm text-muted-foreground">Nothing pending.</p>}
            <ul className="space-y-2">
              {incoming.map((r) => {
                const p = people.get(r.from_user);
                return (
                  <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                    <Avatar path={p?.avatar_url} fallback={initials(p)} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{displayName(p)}</span>
                      <span className="block truncate text-xs text-muted-foreground">@{p?.username}</span>
                    </span>
                    <button
                      onClick={() => void respond(r, "accepted")}
                      aria-label="Accept"
                      className="rounded-full bg-primary p-2 text-primary-foreground"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => void respond(r, "declined")}
                      aria-label="Decline"
                      className="rounded-full border border-border p-2"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Sent by you</h2>
            {outgoing.length === 0 && <p className="text-sm text-muted-foreground">You haven't sent any requests.</p>}
            <ul className="space-y-2">
              {outgoing.map((r) => {
                const p = people.get(r.to_user);
                return (
                  <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                    <Avatar path={p?.avatar_url} fallback={initials(p)} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{displayName(p)}</span>
                      <span className="block text-xs text-muted-foreground capitalize">{r.status}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </AppShell>
  );
}
