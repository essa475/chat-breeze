import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Copy,
  CornerUpLeft,
  Loader2,
  Paperclip,
  Pencil,
  Send,
  Smile,
  Mic,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthGate } from "@/components/AuthGate";
import { Avatar } from "@/components/Avatar";
import { AttachmentView } from "@/components/AttachmentView";
import { AttachmentComposer } from "@/components/AttachmentComposer";
import { GroupPanel } from "@/components/GroupPanel";
import { useSession } from "@/hooks/useSession";
import {
  MAX_FILE_BYTES,
  dayLabel,
  displayName,
  formatBytes,
  formatTime,
  initials,
  kindOf,
  type Attachment,
  type Conversation,
  type Message,
  type Profile,
} from "@/lib/chat";

export const Route = createFileRoute("/app/chat/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Conversation — Chat Ebola" },
      {
        name: "description",
        content:
          "Send messages, photos, videos and files up to 50 MB in your Chat Ebola conversation.",
      },
      { property: "og:title", content: "Conversation — Chat Ebola" },
      { property: "og:description", content: "Messages, photos, videos and files up to 50 MB." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AuthGate>
      <ChatPage />
    </AuthGate>
  ),
});

type Member = { conversation_id: string; user_id: string; role: string };
type Reaction = { message_id: string; user_id: string; emoji: string };
type Receipt = {
  message_id: string;
  user_id: string;
  delivered_at: string;
  read_at: string | null;
};
type MenuState = { message: Message; x: number; y: number } | null;

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const MORE_EMOJIS = [
  "😀",
  "😍",
  "🥰",
  "🤣",
  "😊",
  "👏",
  "🔥",
  "🎉",
  "💯",
  "🤔",
  "👀",
  "💪",
  "✅",
  "💔",
  "😭",
  "😡",
  "🤝",
  "✨",
];

function ChatPage() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [showGroup, setShowGroup] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: conv }, { data: mem }, { data: msgs }, { data: hides }] = await Promise.all([
      supabase.from("conversations").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("conversation_members")
        .select("conversation_id,user_id,role")
        .eq("conversation_id", id),
      supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true }),
      supabase.from("message_hides").select("message_id").eq("user_id", user.id),
    ]);
    setConversation((conv as Conversation | null) ?? null);
    setMembers((mem ?? []) as Member[]);
    setMessages((msgs ?? []) as Message[]);
    setHidden(new Set((hides ?? []).map((h) => h.message_id)));

    const ids = (msgs ?? []).map((m) => m.id);
    if (ids.length) {
      const [{ data: atts }, { data: reacts }, { data: recs }] = await Promise.all([
        supabase.from("attachments").select("*").in("message_id", ids),
        supabase.from("message_reactions").select("message_id,user_id,emoji").in("message_id", ids),
        supabase
          .from("message_receipts")
          .select("message_id,user_id,delivered_at,read_at")
          .in("message_id", ids),
      ]);
      setAttachments((atts ?? []) as Attachment[]);
      setReactions((reacts ?? []) as Reaction[]);
      setReceipts((recs ?? []) as Receipt[]);

      const unread = (msgs ?? []).filter(
        (m) =>
          m.sender_id !== user.id &&
          !(recs ?? []).some((r) => r.message_id === m.id && r.user_id === user.id && r.read_at),
      );
      if (unread.length) {
        const now = new Date().toISOString();
        await supabase.from("message_receipts").upsert(
          unread.map((m) => ({ message_id: m.id, user_id: user.id, read_at: now })),
          {
            onConflict: "message_id,user_id",
          },
        );
      }
    }

    const peerIds = (mem ?? []).map((m) => m.user_id);
    if (peerIds.length) {
      const { data: profs } = await supabase.from("profiles").select("*").in("id", peerIds);
      setProfiles(new Map(((profs ?? []) as Profile[]).map((p) => [p.id, p])));
    }
    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_receipts" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_members",
          filter: `conversation_id=eq.${id}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const visible = useMemo(() => messages.filter((m) => !hidden.has(m.id)), [messages, hidden]);
  const peer = useMemo(() => {
    if (!conversation || conversation.is_group || !user) return null;
    const other = members.find((m) => m.user_id !== user.id);
    return other ? (profiles.get(other.user_id) ?? null) : null;
  }, [conversation, members, profiles, user]);

  const myRole = members.find((m) => m.user_id === user?.id)?.role ?? "member";

  async function send() {
    if (!user || sending) return;
    const body = text.trim();
    if (editing) {
      if (!body) return;
      setSending(true);
      await supabase
        .from("messages")
        .update({ body, edited_at: new Date().toISOString() })
        .eq("id", editing.id);
      setEditing(null);
      setText("");
      setSending(false);
      void load();
      return;
    }
    if (!body) return;
    setSending(true);
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: id, sender_id: user.id, body, reply_to: replyTo?.id ?? null });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    setReplyTo(null);
    void load();
  }

  function chooseFiles(files: FileList) {
    const list = Array.from(files);
    const tooBig = list.find((file) => file.size > MAX_FILE_BYTES);
    if (tooBig) {
      toast.error(`${tooBig.name} is ${formatBytes(tooBig.size)} — the limit is 50 MB.`);
      return;
    }
    setPendingFiles(list);
  }

  async function sendFiles(files: File[], caption: string) {
    if (!user) return;
    setSending(true);
    const { data: msg, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: id,
        sender_id: user.id,
        body: caption || null,
        reply_to: replyTo?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !msg) {
      setSending(false);
      toast.error(error?.message ?? "Couldn't send that.");
      return;
    }
    for (const file of files) {
      const path = `${id}/${msg.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("attachments").upload(path, file);
      if (upErr) {
        toast.error(`${file.name}: ${upErr.message}`);
        continue;
      }
      await supabase.from("attachments").insert({
        message_id: msg.id,
        url: path,
        path,
        name: file.name,
        mime: file.type || null,
        size: file.size,
        kind: kindOf(file.type, file.name),
      });
    }
    setPendingFiles([]);
    setReplyTo(null);
    setSending(false);
    void load();
  }

  async function react(message: Message, emoji: string) {
    if (!user) return;
    const existing = reactions.find((r) => r.message_id === message.id && r.user_id === user.id);
    if (existing && existing.emoji === emoji) {
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", message.id)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("message_reactions")
        .upsert(
          { message_id: message.id, user_id: user.id, emoji },
          { onConflict: "message_id,user_id" },
        );
    }
    setMenu(null);
    void load();
  }

  async function hideForMe(message: Message) {
    if (!user) return;
    await supabase.from("message_hides").insert({ message_id: message.id, user_id: user.id });
    setHidden((s) => new Set(s).add(message.id));
    setMenu(null);
  }

  async function deleteForAll(message: Message) {
    await supabase
      .from("messages")
      .update({ body: null, deleted_for_all: true })
      .eq("id", message.id);
    setMenu(null);
    void load();
  }

  function openMenu(message: Message, x: number, y: number) {
    setMenu({
      message,
      x: Math.min(x, window.innerWidth - 210),
      y: Math.min(y, window.innerHeight - 320),
    });
  }

  const title = conversation?.is_group ? (conversation.name ?? "Group") : displayName(peer);

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-3 py-2.5">
        <button
          onClick={() => void navigate({ to: "/app" })}
          aria-label="Back"
          className="rounded-full p-2 hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => conversation?.is_group && setShowGroup(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Avatar
            path={conversation?.is_group ? conversation.photo_url : peer?.avatar_url}
            fallback={conversation?.is_group ? title.slice(0, 2).toUpperCase() : initials(peer)}
            size={40}
            square={conversation?.is_group ?? false}
          />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {conversation?.is_group
                ? `${members.length} members`
                : peer?.username
                  ? `@${peer.username}`
                  : ""}
            </span>
          </span>
        </button>
        {conversation?.is_group && (
          <button
            onClick={() => setShowGroup(true)}
            aria-label="Group info"
            className="rounded-full p-2 hover:bg-muted"
          >
            <Users className="h-5 w-5" />
          </button>
        )}
      </header>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet. Say hello — messages appear instantly for everyone.
          </p>
        ) : (
          visible.map((m, i) => {
            const mine = m.sender_id === user?.id;
            const prev = visible[i - 1];
            const newDay =
              !prev ||
              new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
            const sender = profiles.get(m.sender_id);
            const msgReactions = reactions.filter((r) => r.message_id === m.id);
            const msgAtts = attachments.filter((a) => a.message_id === m.id);
            const replied = m.reply_to ? messages.find((x) => x.id === m.reply_to) : null;
            const others = receipts.filter((r) => r.message_id === m.id && r.user_id !== user?.id);
            const readByAll = others.length > 0 && others.every((r) => r.read_at);
            const delivered = others.length > 0;

            return (
              <div key={m.id}>
                {newDay && (
                  <p className="my-4 text-center">
                    <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                      {dayLabel(m.created_at)}
                    </span>
                  </p>
                )}
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!m.deleted_for_all) openMenu(m, e.clientX, e.clientY);
                    }}
                    onTouchStart={(e) => {
                      const t = e.touches[0];
                      if (!t || m.deleted_for_all) return;
                      const { clientX, clientY } = t;
                      pressTimer.current = setTimeout(() => openMenu(m, clientX, clientY), 450);
                    }}
                    onTouchEnd={() => pressTimer.current && clearTimeout(pressTimer.current)}
                    onTouchMove={() => pressTimer.current && clearTimeout(pressTimer.current)}
                    className={`animate-rise relative mb-3 max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm select-none ${
                      mine
                        ? "bg-bubble-out text-bubble-out-foreground"
                        : "bg-bubble-in text-foreground"
                    }`}
                  >
                    {conversation?.is_group && !mine && (
                      <p className="mb-0.5 text-xs font-semibold opacity-70">
                        {displayName(sender)}
                      </p>
                    )}
                    {replied && (
                      <p className="mb-1 truncate rounded-lg border-l-2 border-foreground/30 bg-foreground/5 px-2 py-1 text-xs opacity-80">
                        {replied.deleted_for_all
                          ? "Deleted message"
                          : (replied.body ?? "Attachment")}
                      </p>
                    )}
                    {m.deleted_for_all ? (
                      <p className="italic opacity-60">This message was deleted</p>
                    ) : (
                      <>
                        {msgAtts.length > 0 && (
                          <div className="mb-1 space-y-1">
                            {msgAtts.map((a) => (
                              <AttachmentView key={a.id} attachment={a} mine={mine} />
                            ))}
                          </div>
                        )}
                        {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                      </>
                    )}
                    <p className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                      {m.edited_at && <span>edited</span>}
                      <span>{formatTime(m.created_at)}</span>
                      {mine &&
                        (readByAll ? (
                          <CheckCheck className="h-3.5 w-3.5 text-read opacity-100" />
                        ) : delivered ? (
                          <CheckCheck className="h-3.5 w-3.5" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        ))}
                    </p>
                    {msgReactions.length > 0 && (
                      <div
                        className={`absolute -bottom-5 flex gap-0.5 rounded-full border border-border bg-background px-1.5 py-0.5 text-xs shadow ${mine ? "right-2" : "left-2"}`}
                      >
                        {Array.from(new Set(msgReactions.map((r) => r.emoji))).map((e) => (
                          <span key={e}>{e}</span>
                        ))}
                        {msgReactions.length > 1 && (
                          <span className="text-[10px] text-muted-foreground">
                            {msgReactions.length}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {(replyTo || editing) && (
        <div className="flex items-center gap-2 border-t border-border bg-muted px-4 py-2 text-sm">
          <CornerUpLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">
            {editing ? `Editing: ${editing.body ?? ""}` : (replyTo?.body ?? "Attachment")}
          </span>
          <button
            onClick={() => {
              setReplyTo(null);
              setEditing(null);
              setText("");
            }}
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-border px-3 py-2.5">
        <button
          onClick={() => fileRef.current?.click()}
          aria-label="Attach file"
          className="rounded-full p-2.5 hover:bg-muted"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) chooseFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex flex-1 items-end rounded-3xl bg-muted px-4 transition-all duration-300 focus-within:bg-background focus-within:ring-2 focus-within:ring-ring">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Message"
            className="max-h-32 min-h-11 flex-1 resize-none bg-transparent py-3 text-sm outline-none"
          />
        </div>
        <button
          onClick={() => void send()}
          disabled={sending}
          aria-label="Send"
          className="rounded-full bg-primary p-2.5 text-primary-foreground disabled:opacity-60"
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : text.trim() ? (
            <Send className="h-5 w-5 animate-pop" />
          ) : (
            <Mic className="h-5 w-5 animate-pop" />
          )}
        </button>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            className="fixed z-50 w-52 overflow-hidden rounded-2xl border border-border bg-background py-1 shadow-xl"
            style={{ left: menu.x, top: menu.y }}
          >
            <div className="flex items-center justify-between px-3 py-2">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => void react(menu.message, e)} className="text-lg">
                  {e}
                </button>
              ))}
              <button
                onClick={() => setShowEmojiPicker(true)}
                aria-label="More reactions"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-muted"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <MenuItem
              icon={Copy}
              label="Copy"
              onClick={() => {
                void navigator.clipboard.writeText(menu.message.body ?? "");
                toast.success("Copied");
                setMenu(null);
              }}
            />
            <MenuItem
              icon={CornerUpLeft}
              label="Reply"
              onClick={() => {
                setReplyTo(menu.message);
                setMenu(null);
              }}
            />
            <MenuItem icon={Smile} label="React" onClick={() => void react(menu.message, "👍")} />
            {menu.message.sender_id === user?.id && (
              <MenuItem
                icon={Pencil}
                label="Edit"
                onClick={() => {
                  setEditing(menu.message);
                  setText(menu.message.body ?? "");
                  setMenu(null);
                }}
              />
            )}
            <MenuItem
              icon={Trash2}
              label="Delete for me"
              onClick={() => void hideForMe(menu.message)}
            />
            {menu.message.sender_id === user?.id && (
              <MenuItem
                icon={Trash2}
                label="Delete for everyone"
                onClick={() => void deleteForAll(menu.message)}
              />
            )}
          </div>
        </>
      )}

      {showGroup && conversation?.is_group && user && (
        <GroupPanel
          conversation={conversation}
          members={members}
          profiles={profiles}
          myRole={myRole}
          userId={user.id}
          onClose={() => setShowGroup(false)}
          onChanged={() => void load()}
          onLeft={() => void navigate({ to: "/app" })}
        />
      )}
      {showEmojiPicker && menu && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/40 p-4"
          onClick={() => setShowEmojiPicker(false)}
        >
          <div
            className="grid w-full max-w-sm grid-cols-6 gap-2 rounded-2xl bg-background p-4 shadow-xl animate-pop"
            onClick={(event) => event.stopPropagation()}
          >
            {MORE_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  setShowEmojiPicker(false);
                  void react(menu.message, emoji);
                }}
                className="rounded-xl p-2 text-2xl hover:bg-muted"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
      {pendingFiles.length > 0 && (
        <AttachmentComposer
          files={pendingFiles}
          recipient={title}
          sending={sending}
          onCancel={() => setPendingFiles([])}
          onSend={(caption) => void sendFiles(pendingFiles, caption)}
        />
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted"
    >
      <Icon className="h-4 w-4 opacity-70" /> {label}
    </button>
  );
}
