import { useEffect, useRef, useState } from "react";
import { Camera, LogOut, Search, Shield, ShieldOff, UserMinus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { displayName, initials, uploadPublicImage, type Conversation, type Profile } from "@/lib/chat";

type Member = { conversation_id: string; user_id: string; role: string };

export function GroupPanel({
  conversation,
  members,
  profiles,
  myRole,
  userId,
  onClose,
  onChanged,
  onLeft,
}: {
  conversation: Conversation;
  members: Member[];
  profiles: Map<string, Profile>;
  myRole: string;
  userId: string;
  onClose: () => void;
  onChanged: () => void;
  onLeft: () => void;
}) {
  const isAdmin = myRole === "admin";
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(conversation.name ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);

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
        .or(`username.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
        .limit(15);
      setResults(((data ?? []) as Profile[]).filter((p) => !members.some((m) => m.user_id === p.id)));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, members]);

  async function rename() {
    const { error } = await supabase.from("conversations").update({ name: name.trim() }).eq("id", conversation.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Group renamed");
      onChanged();
    }
  }

  async function changePhoto(file: File) {
    try {
      const path = await uploadPublicImage(userId, file);
      const { error } = await supabase.from("conversations").update({ photo_url: path }).eq("id", conversation.id);
      if (error) throw error;
      toast.success("Group photo updated");
      onChanged();
    } catch {
      toast.error("Couldn't update the photo.");
    }
  }

  async function addMember(p: Profile) {
    const { error } = await supabase
      .from("conversation_members")
      .insert({ conversation_id: conversation.id, user_id: p.id, role: "member" });
    if (error) toast.error(error.message);
    else {
      setQuery("");
      onChanged();
    }
  }

  async function removeMember(uid: string) {
    const { error } = await supabase
      .from("conversation_members")
      .delete()
      .eq("conversation_id", conversation.id)
      .eq("user_id", uid);
    if (error) toast.error(error.message);
    else onChanged();
  }

  async function setRole(uid: string, role: "admin" | "member") {
    const { error } = await supabase
      .from("conversation_members")
      .update({ role })
      .eq("conversation_id", conversation.id)
      .eq("user_id", uid);
    if (error) toast.error(error.message);
    else onChanged();
  }

  async function leave() {
    const { error } = await supabase
      .from("conversation_members")
      .delete()
      .eq("conversation_id", conversation.id)
      .eq("user_id", userId);
    if (error) toast.error(error.message);
    else onLeft();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="h-full w-full max-w-md overflow-y-auto bg-background p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Group info</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <button onClick={() => isAdmin && fileRef.current?.click()} className="relative" aria-label="Group photo">
            <Avatar path={conversation.photo_url} fallback={(conversation.name ?? "G").slice(0, 2).toUpperCase()} size={64} square />
            {isAdmin && (
              <span className="absolute -right-1 -bottom-1 rounded-full bg-primary p-1.5 text-primary-foreground">
                <Camera className="h-3.5 w-3.5" />
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
              if (f) void changePhoto(f);
            }}
          />
          <div className="flex-1">
            {isAdmin ? (
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <button onClick={() => void rename()} className="rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground">
                  Save
                </button>
              </div>
            ) : (
              <p className="text-lg font-semibold">{conversation.name}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{members.length} members</p>
          </div>
        </div>

        {isAdmin && (
          <div className="mt-6">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <UserPlus className="h-3.5 w-3.5" /> Add members
            </h3>
            <label className="flex items-center gap-2 rounded-full bg-muted px-4 py-2.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
            <ul className="mt-2 space-y-1">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => void addMember(p)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted"
                  >
                    <Avatar path={p.avatar_url} fallback={initials(p)} size={36} />
                    <span className="min-w-0 flex-1 truncate text-sm">{displayName(p)}</span>
                    <UserPlus className="h-4 w-4 opacity-70" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <h3 className="mt-6 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Members</h3>
        <ul className="space-y-1">
          {members.map((m) => {
            const p = profiles.get(m.user_id);
            return (
              <li key={m.user_id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <Avatar path={p?.avatar_url} fallback={initials(p)} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {displayName(p)} {m.user_id === userId && <span className="text-muted-foreground">(you)</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground capitalize">{m.role}</span>
                </span>
                {isAdmin && m.user_id !== userId && (
                  <>
                    <button
                      onClick={() => void setRole(m.user_id, m.role === "admin" ? "member" : "admin")}
                      aria-label={m.role === "admin" ? "Demote" : "Promote"}
                      className="rounded-full p-2 hover:bg-muted"
                    >
                      {m.role === "admin" ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => void removeMember(m.user_id)}
                      aria-label="Remove member"
                      className="rounded-full p-2 hover:bg-muted"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        <button
          onClick={() => void leave()}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-5 py-3 text-sm font-semibold"
        >
          <LogOut className="h-4 w-4" /> Leave group
        </button>
      </div>
    </div>
  );
}
