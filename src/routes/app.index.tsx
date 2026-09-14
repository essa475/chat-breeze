import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCheck, MessageSquareText, Plus, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { Avatar } from "@/components/Avatar";
import { useSession } from "@/hooks/useSession";
import {
  displayName,
  formatListTime,
  initials,
  type Conversation,
  type Message,
  type Profile,
} from "@/lib/chat";

export const Route = createFileRoute("/app/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your chats — Chat Ebola" },
      { name: "description", content: "All your Chat Ebola conversations and groups in one place." },
      { property: "og:title", content: "Your chats — Chat Ebola" },
      { property: "og:description", content: "All your conversations and groups in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AuthGate>
      <ChatsPage />
    </AuthGate>
  ),
});

type Row = {
  conversation: Conversation;
  peer: Profile | null;
  last: Message | null;
  unread: number;
  memberCount: number;
};

function ChatsPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [requestCount, setRequestCount] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: memberships } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);
    const ids = (memberships ?? []).map((m) => m.conversation_id);
    if (ids.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const [{ data: convs }, { data: members }, { data: messages }, { data: receipts }, { data: hides }] =
      await Promise.all([
        supabase.from("conversations").select("*").in("id", ids).order("last_message_at", { ascending: false }),
        supabase.from("conversation_members").select("conversation_id,user_id,role").in("conversation_id", ids),
        supabase
          .from("messages")
          .select("*")
          .in("conversation_id", ids)
          .order("created_at", { ascending: false })
          .limit(600),
        supabase.from("message_receipts").select("message_id,read_at").eq("user_id", user.id),
        supabase.from("message_hides").select("message_id").eq("user_id", user.id),
      ]);

    const peerIds = Array.from(
      new Set((members ?? []).filter((m) => m.user_id !== user.id).map((m) => m.user_id)),
    );
    const { data: profiles } = peerIds.length
      ? await supabase.from("profiles").select("*").in("id", peerIds)
      : { data: [] as Profile[] };
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
    const hidden = new Set((hides ?? []).map((h) => h.message_id));
    const readIds = new Set((receipts ?? []).filter((r) => r.read_at).map((r) => r.message_id));

    // Mark everything delivered so senders see two ticks even before we open the chat.
    const undelivered = (messages ?? []).filter(
      (m) => m.sender_id !== user.id && !(receipts ?? []).some((r) => r.message_id === m.id),
    );
    if (undelivered.length) {
      await supabase
        .from("message_receipts")
        .upsert(undelivered.map((m) => ({ message_id: m.id, user_id: user.id })), {
          onConflict: "message_id,user_id",
        });
    }

    const built: Row[] = (convs ?? []).map((c) => {
      const convMembers = (members ?? []).filter((m) => m.conversation_id === c.id);
      const peerId = convMembers.find((m) => m.user_id !== user.id)?.user_id;
      const convMessages = (messages ?? []).filter((m) => m.conversation_id === c.id && !hidden.has(m.id));
      const unread = convMessages.filter((m) => m.sender_id !== user.id && !readIds.has(m.id)).length;
      return {
        conversation: c as Conversation,
        peer: c.is_group ? null : (peerId ? (profileById.get(peerId) ?? null) : null),
        last: (convMessages[0] as Message | undefined) ?? null,
        unread,
        memberCount: convMembers.length,
      };
    });
    setRows(built);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("chat-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_requests" }, () => void loadRequests())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, load]);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from("chat_requests")
      .select("id", { count: "exact", head: true })
      .eq("to_user", user.id)
      .eq("status", "pending");
    setRequestCount(count ?? 0);
  }, [user]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = r.conversation.is_group ? (r.conversation.name ?? "") : displayName(r.peer);
      return name.toLowerCase().includes(q) || (r.last?.body ?? "").toLowerCase().includes(q);
    });
  }, [rows, query]);

  return (
    <AppShell
      title="Chat Ebola"
      tab="chats"
      requestCount={requestCount}
      actions={
        <>
          <button
            onClick={() => void navigate({ to: "/app/group/new" })}
            aria-label="New group"
            className="rounded-full p-2 transition-colors hover:bg-muted"
          >
            <Users className="h-5 w-5" />
          </button>
          <button
            onClick={() => void navigate({ to: "/app/search" })}
            aria-label="New chat"
            className="rounded-full bg-primary p-2 text-primary-foreground"
          >
            <Plus className="h-5 w-5" />
          </button>
        </>
      }
    >
      <div className="px-4 py-3">
        <label className="flex items-center gap-2 rounded-full bg-muted px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your chats"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      {loading ? (
        <div className="space-y-3 px-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex animate-pulse items-center gap-3">
              <span className="h-12 w-12 rounded-full bg-muted" />
              <span className="h-3 w-1/2 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="No chats yet"
          body="Search for someone by username, email, name or phone number and start your first conversation."
          action={{ label: "Find people", to: "/app/search" }}
        />
      ) : (
        <ul>
          {filtered.map(({ conversation, peer, last, unread, memberCount }) => (
            <li key={conversation.id}>
              <button
                onClick={() => void navigate({ to: "/app/chat/$id", params: { id: conversation.id } })}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
              >
                <Avatar
                  path={conversation.is_group ? conversation.photo_url : peer?.avatar_url}
                  fallback={conversation.is_group ? (conversation.name ?? "G").slice(0, 2).toUpperCase() : initials(peer)}
                  size={50}
                  square={conversation.is_group}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">
                      {conversation.is_group ? (conversation.name ?? "Group") : displayName(peer)}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {last ? formatListTime(last.created_at) : ""}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-muted-foreground">
                      {last
                        ? last.deleted_for_all
                          ? "This message was deleted"
                          : (last.body ?? "Attachment")
                        : conversation.is_group
                          ? `${memberCount} members`
                          : "Say hello"}
                    </span>
                    {unread > 0 && (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                        {unread}
                      </span>
                    )}
                    {unread === 0 && last?.sender_id === user?.id && (
                      <CheckCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
