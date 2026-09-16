import { supabase } from "@/integrations/supabase/client";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  dob: string | null;
  avatar_url: string | null;
  bio: string | null;
  require_request: boolean;
  last_seen_at: string;
};

export type Attachment = {
  id: string;
  message_id: string;
  url: string;
  path: string | null;
  name: string;
  mime: string | null;
  size: number | null;
  kind: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  reply_to: string | null;
  edited_at: string | null;
  deleted_for_all: boolean;
  created_at: string;
};

export type Conversation = {
  id: string;
  is_group: boolean;
  name: string | null;
  photo_url: string | null;
  created_by: string;
  created_at: string;
  last_message_at: string;
};

export function displayName(p?: Partial<Profile> | null): string {
  if (!p) return "Unknown";
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return full || p.username || p.email || p.phone || "Unknown";
}

export function initials(p?: Partial<Profile> | null): string {
  const n = displayName(p);
  const parts = n.split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatListTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return formatTime(iso);
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function isRecentlyOnline(lastSeen?: string | null): boolean {
  return Boolean(lastSeen && Date.now() - new Date(lastSeen).getTime() < 70_000);
}

export function presenceLabel(lastSeen?: string | null): string {
  if (!lastSeen) return "";
  if (isRecentlyOnline(lastSeen)) return "online";
  const value = new Date(lastSeen);
  const today = value.toDateString() === new Date().toDateString();
  return `last seen ${today ? "today at " + formatTime(lastSeen) : formatListTime(lastSeen)}`;
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes && bytes !== 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function kindOf(
  mime: string | null | undefined,
  name: string,
): "image" | "video" | "audio" | "file" {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "heic"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) return "video";
  if (["mp3", "wav", "m4a", "ogg"].includes(ext)) return "audio";
  return "file";
}

const urlCache = new Map<string, { url: string; expires: number }>();

export async function signedUrl(bucket: string, path?: string | null): Promise<string | null> {
  if (!path) return null;
  const key = `${bucket}/${path}`;
  const cached = urlCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  urlCache.set(key, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export function normalisePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

/** Login/signup identifier -> the email address used with the auth system. */
export function identifierToEmail(identifier: string): { email: string; phone: string | null } {
  const value = identifier.trim();
  if (value.includes("@")) return { email: value.toLowerCase(), phone: null };
  const phone = normalisePhone(value);
  const digits = phone.replace(/\D/g, "");
  return { email: `p${digits}@phone.chatebola.app`, phone };
}

export async function uploadPublicImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}
