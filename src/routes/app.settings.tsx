import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { Avatar } from "@/components/Avatar";
import { useProfile, useSession } from "@/hooks/useSession";
import { ageFromDob, displayName, initials, uploadPublicImage } from "@/lib/chat";

export const Route = createFileRoute("/app/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings — Chat Ebola" },
      { name: "description", content: "Edit your Chat Ebola profile, photo and bio, control who can message you, and sign out." },
      { property: "og:title", content: "Settings — Chat Ebola" },
      { property: "og:description", content: "Edit your profile and control who can message you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AuthGate>
      <SettingsPage />
    </AuthGate>
  ),
});

function SettingsPage() {
  const { user } = useSession();
  const { profile, reload } = useProfile(user?.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [dob, setDob] = useState("");
  const [requireRequest, setRequireRequest] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name ?? "");
    setLastName(profile.last_name ?? "");
    setBio(profile.bio ?? "");
    setDob(profile.dob ?? "");
    setRequireRequest(profile.require_request);
  }, [profile]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        bio: bio.trim() || null,
        dob: dob || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
    await reload();
  }

  async function togglePrivacy(next: boolean) {
    if (!user) return;
    setRequireRequest(next);
    const { error } = await supabase.from("profiles").update({ require_request: next }).eq("id", user.id);
    if (error) {
      toast.error(error.message);
      setRequireRequest(!next);
    }
  }

  async function changePhoto(file: File) {
    if (!user) return;
    try {
      const path = await uploadPublicImage(user.id, file);
      await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      await reload();
      toast.success("Photo updated");
    } catch {
      toast.error("Couldn't upload that photo.");
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  const age = profile?.dob ? ageFromDob(profile.dob) : null;

  return (
    <AppShell title="Settings" tab="settings">
      <div className="space-y-6 px-4 py-4">
        <section className="flex items-center gap-4 rounded-2xl border border-border p-4">
          <button onClick={() => fileRef.current?.click()} className="relative" aria-label="Change photo">
            <Avatar path={profile?.avatar_url} fallback={initials(profile)} size={68} />
            <span className="absolute -right-1 -bottom-1 rounded-full bg-primary p-1.5 text-primary-foreground">
              <Camera className="h-3.5 w-3.5" />
            </span>
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
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{displayName(profile)}</p>
            <p className="truncate text-sm text-muted-foreground">
              @{profile?.username}
              {age !== null && ` · ${age} years old`}
            </p>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-border p-4">
          <h2 className="font-display text-lg font-bold">Privacy</h2>
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-medium">Require a request before messaging</span>
              <span className="block text-xs text-muted-foreground">
                People who don't already chat with you must send a request first.
              </span>
            </span>
            <button
              role="switch"
              aria-checked={requireRequest}
              onClick={() => void togglePrivacy(!requireRequest)}
              className={`mt-1 h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                requireRequest ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-background shadow transition-transform ${
                  requireRequest ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </label>
        </section>

        <section className="space-y-3 rounded-2xl border border-border p-4">
          <h2 className="font-display text-lg font-bold">Edit profile</h2>
          <div className="grid grid-cols-2 gap-3">
            <Input label="First name" value={firstName} onChange={setFirstName} />
            <Input label="Last name" value={lastName} onChange={setLastName} />
          </div>
          <Input label="Date of birth" type="date" value={dob} onChange={setDob} />
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={200}
              className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </button>
        </section>

        <button
          onClick={() => void signOut()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-5 py-3 text-sm font-semibold"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>
    </AppShell>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
