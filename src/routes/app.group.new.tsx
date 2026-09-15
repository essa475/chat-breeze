import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthGate } from "@/components/AuthGate";
import { Avatar } from "@/components/Avatar";
import { useSession } from "@/hooks/useSession";
import { displayName, initials, uploadPublicImage, type Profile } from "@/lib/chat";

export const Route = createFileRoute("/app/group/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "New group — Chat Ebola" },
      {
        name: "description",
        content:
          "Create a Chat Ebola group, give it a name and photo, and add the people you want in it.",
      },
      { property: "og:title", content: "New group — Chat Ebola" },
      { property: "og:description", content: "Create a group, name it and add members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AuthGate>
      <NewGroupPage />
    </AuthGate>
  ),
});

function NewGroupPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [recent, setRecent] = useState<Profile[]>([]);
  const [picked, setPicked] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: mine } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", user.id);
      const ids = (mine ?? []).map((row) => row.conversation_id);
      if (!ids.length) return;
      const [{ data: conversations }, { data: members }] = await Promise.all([
        supabase
          .from("conversations")
          .select("id,is_group,last_message_at")
          .in("id", ids)
          .eq("is_group", false)
          .order("last_message_at", { ascending: false }),
        supabase
          .from("conversation_members")
          .select("conversation_id,user_id")
          .in("conversation_id", ids),
      ]);
      const orderedPeerIds = (conversations ?? []).flatMap((conversation) => {
        const peer = (members ?? []).find(
          (member) => member.conversation_id === conversation.id && member.user_id !== user.id,
        );
        return peer ? [peer.user_id] : [];
      });
      if (!orderedPeerIds.length) return;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", orderedPeerIds);
      const byId = new Map(((profiles ?? []) as Profile[]).map((profile) => [profile.id, profile]));
      setRecent(orderedPeerIds.flatMap((id) => (byId.get(id) ? [byId.get(id) as Profile] : [])));
    })();
  }, [user]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const like = `%${q}%`;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .or(
          `username.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`,
        )
        .limit(20);
      setResults(((data ?? []) as Profile[]).filter((p) => p.id !== user?.id));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, user]);

  function toggle(p: Profile) {
    setPicked((cur) =>
      cur.some((x) => x.id === p.id) ? cur.filter((x) => x.id !== p.id) : [...cur, p],
    );
  }

  async function create() {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Give the group a name.");
      return;
    }
    if (picked.length === 0) {
      toast.error("Add at least one member.");
      return;
    }
    setBusy(true);
    let photoPath: string | null = null;
    if (photo) {
      try {
        photoPath = await uploadPublicImage(user.id, photo);
      } catch {
        toast.error("Couldn't upload the group photo.");
      }
    }
    const { data: conversationId, error } = await supabase.rpc("create_group", {
      _name: name.trim(),
      _photo_url: photoPath ?? "",
      _member_ids: picked.map((profile) => profile.id),
    });
    if (error || !conversationId) {
      setBusy(false);
      toast.error(error?.message ?? "Couldn't create the group.");
      return;
    }
    setBusy(false);
    void navigate({ to: "/app/chat/$id", params: { id: conversationId } });
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-background pb-28">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <button
          onClick={() => void navigate({ to: "/app" })}
          aria-label="Back"
          className="rounded-full p-2 hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-xl font-bold">New group</h1>
      </header>

      <div className="space-y-5 px-4 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => fileRef.current?.click()}
            className="relative"
            aria-label="Group photo"
          >
            {preview ? (
              <img src={preview} alt="" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Camera className="h-6 w-6" />
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setPhoto(f);
                setPreview(URL.createObjectURL(f));
              }
            }}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            className="flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {picked.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {picked.map((p) => (
              <button
                key={p.id}
                onClick={() => toggle(p)}
                className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium"
              >
                <Avatar path={p.avatar_url} fallback={initials(p)} size={20} />
                {displayName(p)} ✕
              </button>
            ))}
          </div>
        )}

        <label className="flex items-center gap-2 rounded-full bg-muted px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Add people"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>

        {query.trim().length < 2 && recent.length > 0 && (
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Recent chats
          </h2>
        )}
        <ul className="space-y-1">
          {(query.trim().length >= 2 ? results : recent).map((p) => {
            const on = picked.some((x) => x.id === p.id);
            return (
              <li key={p.id}>
                <button
                  onClick={() => toggle(p)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted"
                >
                  <Avatar path={p.avatar_url} fallback={initials(p)} size={42} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{displayName(p)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      @{p.username}
                    </span>
                  </span>
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    }`}
                  >
                    {on && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-3xl border-t border-border bg-background p-4">
        <button
          onClick={() => void create()}
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create group
        </button>
      </div>
    </div>
  );
}
