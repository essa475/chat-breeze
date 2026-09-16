import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Eye, ImagePlus, Loader2, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { Avatar } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/useSession";
import { displayName, formatListTime, initials, signedUrl, type Profile } from "@/lib/chat";

export const Route = createFileRoute("/app/updates")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Updates — Chat Ebola" },
      { name: "description", content: "Share photos and thoughts that disappear after 24 hours." },
      { property: "og:title", content: "Updates — Chat Ebola" },
      { property: "og:description", content: "Recent updates from your Chat Ebola contacts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AuthGate>
      <UpdatesPage />
    </AuthGate>
  ),
});

type Status = {
  id: string;
  author_id: string;
  body: string | null;
  media_path: string | null;
  media_type: string | null;
  background: string;
  created_at: string;
  expires_at: string;
};
type ViewRow = { status_id: string; viewer_id: string; viewed_at: string };

const backgrounds: Record<string, string> = {
  ink: "bg-status-ink",
  blue: "bg-status-blue",
  green: "bg-status-green",
  red: "bg-status-red",
  violet: "bg-status-violet",
};

function UpdatesPage() {
  const { user } = useSession();
  const { profile } = useProfile(user?.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [views, setViews] = useState<ViewRow[]>([]);
  const [composer, setComposer] = useState<"text" | "photo" | null>(null);
  const [text, setText] = useState("");
  const [background, setBackground] = useState("ink");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [active, setActive] = useState<Status | null>(null);
  const [activeMedia, setActiveMedia] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: rows }, { data: seen }] = await Promise.all([
      supabase
        .from("statuses")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("created_at"),
      supabase.from("status_views").select("status_id,viewer_id,viewed_at"),
    ]);
    const values = (rows ?? []) as Status[];
    setStatuses(values);
    setViews((seen ?? []) as ViewRow[]);
    const ids = Array.from(new Set(values.map((status) => status.author_id)));
    if (ids.length) {
      const { data } = await supabase.from("profiles").select("*").in("id", ids);
      setProfiles(new Map(((data ?? []) as Profile[]).map((item) => [item.id, item])));
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const channel = supabase
      .channel("updates-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "statuses" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "status_views" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const mine = statuses.filter((status) => status.author_id === user?.id);
  const groups = useMemo(() => {
    const map = new Map<string, Status[]>();
    statuses
      .filter((status) => status.author_id !== user?.id)
      .forEach((status) => {
        map.set(status.author_id, [...(map.get(status.author_id) ?? []), status]);
      });
    return Array.from(map.entries());
  }, [statuses, user?.id]);

  function closeComposer() {
    if (preview) URL.revokeObjectURL(preview);
    setComposer(null);
    setText("");
    setFile(null);
    setPreview(null);
  }

  async function post() {
    if (!user || posting || (!text.trim() && !file)) return;
    setPosting(true);
    let mediaPath: string | null = null;
    if (file) {
      mediaPath = `${user.id}/statuses/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("status-media").upload(mediaPath, file);
      if (error) {
        toast.error(error.message);
        setPosting(false);
        return;
      }
    }
    const { error } = await supabase.from("statuses").insert({
      author_id: user.id,
      body: text.trim() || null,
      media_path: mediaPath,
      media_type: file?.type ?? null,
      background,
    });
    setPosting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    closeComposer();
    void load();
  }

  async function openStatus(status: Status) {
    setActive(status);
    setActiveMedia(null);
    if (status.media_path) setActiveMedia(await signedUrl("status-media", status.media_path));
    if (user && status.author_id !== user.id) {
      await supabase.from("status_views").upsert({ status_id: status.id, viewer_id: user.id });
    }
  }

  return (
    <AppShell title="Updates" tab="updates">
      <section className="px-4 py-5">
        <h2 className="text-sm font-bold">Status</h2>
        <div className="mt-4 flex items-center gap-3">
          <button
            className="relative"
            onClick={() =>
              mine.at(-1) ? void openStatus(mine.at(-1) as Status) : setComposer("text")
            }
          >
            <span
              className={
                mine.length
                  ? "block rounded-full ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "block"
              }
            >
              <Avatar path={profile?.avatar_url} fallback={initials(profile)} size={56} />
            </span>
            <span className="absolute right-0 bottom-0 rounded-full border-2 border-background bg-primary p-1 text-primary-foreground">
              <Plus className="h-3 w-3" />
            </span>
          </button>
          <button
            className="min-w-0 flex-1 text-left"
            onClick={() =>
              mine.at(-1) ? void openStatus(mine.at(-1) as Status) : setComposer("text")
            }
          >
            <span className="block font-semibold">My status</span>
            <span className="block text-xs text-muted-foreground">
              {mine.length
                ? `${mine.length} active update${mine.length === 1 ? "" : "s"}`
                : "Tap to add status update"}
            </span>
          </button>
          <button
            aria-label="Add photo status"
            onClick={() => fileRef.current?.click()}
            className="rounded-full bg-muted p-3"
          >
            <Camera className="h-5 w-5" />
          </button>
          <button
            aria-label="Add text status"
            onClick={() => setComposer("text")}
            className="rounded-full bg-muted p-3"
          >
            <Pencil className="h-5 w-5" />
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="image/*,video/*"
            onChange={(event) => {
              const picked = event.target.files?.[0];
              if (!picked) return;
              const nextPreview = URL.createObjectURL(picked);
              setFile(picked);
              setPreview(nextPreview);
              setComposer("photo");
              event.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="border-t border-border px-4 py-5">
        <h2 className="mb-2 text-sm font-bold text-muted-foreground">Recent updates</h2>
        {groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Updates from your recent chats will appear here.
          </p>
        ) : (
          groups.map(([authorId, items]) => {
            const author = profiles.get(authorId);
            const latest = items.at(-1) as Status;
            const unseen = items.some(
              (item) =>
                !views.some((view) => view.status_id === item.id && view.viewer_id === user?.id),
            );
            return (
              <button
                key={authorId}
                onClick={() => void openStatus(latest)}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <span
                  className={`rounded-full p-0.5 ${unseen ? "ring-2 ring-primary" : "ring-2 ring-border"}`}
                >
                  <Avatar path={author?.avatar_url} fallback={initials(author)} size={52} />
                </span>
                <span>
                  <span className="block font-semibold">{displayName(author)}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatListTime(latest.created_at)}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </section>

      {composer && (
        <div
          className={`fixed inset-0 z-50 flex flex-col text-primary-foreground ${composer === "text" ? backgrounds[background] : "bg-status-ink"}`}
        >
          <div className="flex items-center justify-between p-4">
            <button aria-label="Close" onClick={closeComposer}>
              <X />
            </button>
            <span className="text-sm font-semibold">New status</span>
            <button aria-label="Choose media" onClick={() => fileRef.current?.click()}>
              <ImagePlus />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center p-6">
            {preview && file ? (
              file.type.startsWith("video/") ? (
                <video src={preview} controls className="max-h-[65vh] max-w-full rounded-lg" />
              ) : (
                <img
                  src={preview}
                  alt="Status preview"
                  className="max-h-[65vh] max-w-full rounded-lg object-contain"
                />
              )
            ) : (
              <textarea
                autoFocus
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={700}
                placeholder="Type a status"
                className="w-full max-w-xl resize-none bg-transparent text-center font-display text-3xl font-bold outline-none placeholder:text-primary-foreground/60"
                rows={5}
              />
            )}
          </div>
          {composer === "text" && (
            <div className="flex justify-center gap-3 p-3">
              {Object.keys(backgrounds).map((key) => (
                <button
                  key={key}
                  aria-label={`${key} background`}
                  onClick={() => setBackground(key)}
                  className={`h-7 w-7 rounded-full border-2 border-primary-foreground/70 ${backgrounds[key]}`}
                />
              ))}
            </div>
          )}
          {preview && (
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={700}
              placeholder="Add a caption…"
              className="mx-4 mb-3 rounded-full bg-background/15 px-5 py-3 text-sm outline-none placeholder:text-primary-foreground/70"
            />
          )}
          <div className="flex justify-end p-4">
            <button
              aria-label="Post status"
              disabled={posting || (!text.trim() && !file)}
              onClick={() => void post()}
              className="rounded-full bg-primary-foreground p-4 text-primary shadow-lg disabled:opacity-50"
            >
              {posting ? <Loader2 className="animate-spin" /> : <Send />}
            </button>
          </div>
        </div>
      )}

      {active && (
        <div
          className={`fixed inset-0 z-50 flex flex-col text-primary-foreground ${backgrounds[active.background] ?? backgrounds["ink"]}`}
          onClick={() => setActive(null)}
        >
          <div className="flex items-center gap-3 p-4">
            <Avatar
              path={profiles.get(active.author_id)?.avatar_url ?? profile?.avatar_url}
              fallback={initials(profiles.get(active.author_id) ?? profile)}
              size={38}
            />
            <span className="flex-1">
              <span className="block text-sm font-semibold">
                {active.author_id === user?.id
                  ? "My status"
                  : displayName(profiles.get(active.author_id))}
              </span>
              <span className="text-xs opacity-70">{formatListTime(active.created_at)}</span>
            </span>
            {active.author_id === user?.id && (
              <button
                aria-label="Delete status"
                onClick={async (event) => {
                  event.stopPropagation();
                  await supabase.from("statuses").delete().eq("id", active.id);
                  setActive(null);
                  void load();
                }}
              >
                <Trash2 />
              </button>
            )}
            <button aria-label="Close status" onClick={() => setActive(null)}>
              <X />
            </button>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6">
            {activeMedia &&
              (active.media_type?.startsWith("video/") ? (
                <video
                  src={activeMedia}
                  controls
                  autoPlay
                  className="max-h-[70vh] max-w-full"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <img
                  src={activeMedia}
                  alt="Status"
                  className="max-h-[70vh] max-w-full object-contain"
                />
              ))}
            {active.body && (
              <p className="max-w-2xl whitespace-pre-wrap text-center font-display text-3xl font-bold">
                {active.body}
              </p>
            )}
          </div>
          {active.author_id === user?.id && (
            <div className="flex items-center justify-center gap-2 p-5 text-sm">
              <Eye className="h-4 w-4" />{" "}
              {views.filter((view) => view.status_id === active.id).length} views
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
