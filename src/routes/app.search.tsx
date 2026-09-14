import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, MessageSquarePlus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { Avatar } from "@/components/Avatar";
import { useSession } from "@/hooks/useSession";
import { ageFromDob, displayName, initials, type Profile } from "@/lib/chat";

export const Route = createFileRoute("/app/search")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Find people — Chat Ebola" },
      { name: "description", content: "Search Chat Ebola by username, email, name or phone number and start a conversation." },
      { property: "og:title", content: "Find people — Chat Ebola" },
      { property: "og:description", content: "Search by username, email, name or phone number." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AuthGate>
      <SearchPage />
    </AuthGate>
  ),
});

function SearchPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentTo, setSentTo] = useState<string[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const like = `%${q}%`;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .or(
          `username.ilike.${like},email.ilike.${like},phone.ilike.${like},first_name.ilike.${like},last_name.ilike.${like}`,
        )
        .limit(25);
      setResults(((data ?? []) as Profile[]).filter((p) => p.id !== user?.id && p.username));
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, user]);

  async function openChat(peer: Profile) {
    const { data, error } = await supabase.rpc("start_direct_chat", { _peer: peer.id });
    if (error) {
      if (error.message.includes("request_required")) {
        toast.error(`${displayName(peer)} accepts messages by request only. Send a request first.`);
      } else {
        toast.error(error.message);
      }
      return;
    }
    void navigate({ to: "/app/chat/$id", params: { id: data as string } });
  }

  async function sendRequest(peer: Profile) {
    const { error } = await supabase
      .from("chat_requests")
      .upsert({ to_user: peer.id, status: "pending" }, { onConflict: "from_user,to_user" });
    if (error) {
      toast.error(error.message);
      return;
    }
    setSentTo((s) => [...s, peer.id]);
    toast.success(`Request sent to ${displayName(peer)}`);
  }

  return (
    <AppShell title="Find people" tab="search">
      <div className="px-4 py-3">
        <label className="flex items-center gap-2 rounded-full bg-muted px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Username, email, name or phone"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      {query.trim().length < 2 ? (
        <EmptyState
          icon={Search}
          title="Search for someone"
          body="Type at least two characters. You can look people up by their username, email address, full name or phone number."
        />
      ) : searching ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Searching…</p>
      ) : results.length === 0 ? (
        <EmptyState icon={Search} title="Nobody found" body="No account matches that search. Try a different spelling." />
      ) : (
        <ul className="space-y-2 px-4">
          {results.map((p) => {
            const age = p.dob ? ageFromDob(p.dob) : null;
            return (
              <li key={p.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start gap-3">
                  <Avatar path={p.avatar_url} fallback={initials(p)} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      {displayName(p)}
                      {p.require_request && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{p.username}
                      {age !== null && ` · ${age}`}
                    </p>
                    {p.bio && <p className="mt-1 text-sm text-muted-foreground">{p.bio}</p>}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => void openChat(p)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    <MessageSquarePlus className="h-4 w-4" /> Message
                  </button>
                  <button
                    onClick={() => void (p.require_request ? sendRequest(p) : openChat(p))}
                    disabled={sentTo.includes(p.id)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  >
                    <UserPlus className="h-4 w-4" />
                    {sentTo.includes(p.id) ? "Request sent" : p.require_request ? "Send request" : "Add to chat"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
