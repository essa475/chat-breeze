import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ageFromDob, identifierToEmail, uploadPublicImage } from "@/lib/chat";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Chat Ebola" },
      { name: "description", content: "Sign in to Chat Ebola with your email or phone number, or create a new account in under a minute." },
      { property: "og:title", content: "Sign in — Chat Ebola" },
      { property: "og:description", content: "Sign in with your email or phone number, or create a new account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Step = "credentials" | "identity" | "birthday" | "profile";

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("credentials");
  const [busy, setBusy] = useState(false);
  const [signupMode, setSignupMode] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameState, setUsernameState] = useState<"idle" | "checking" | "free" | "taken" | "invalid">("idle");

  const [dob, setDob] = useState("");
  const [bio, setBio] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Already signed in? go straight to the app (or finish the profile).
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (profile?.username) void navigate({ to: "/app" });
      else {
        setSignupMode(true);
        setStep("identity");
      }
    })();
  }, [navigate]);

  // Live username availability
  useEffect(() => {
    const value = username.trim().toLowerCase();
    if (!value) return setUsernameState("idle");
    if (!/^[a-z0-9_.]{3,24}$/.test(value)) return setUsernameState("invalid");
    setUsernameState("checking");
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id").eq("username", value).maybeSingle();
      const me = (await supabase.auth.getUser()).data.user?.id;
      setUsernameState(!data || data.id === me ? "free" : "taken");
    }, 350);
    return () => clearTimeout(timer);
  }, [username]);

  const age = dob ? ageFromDob(dob) : null;

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || password.length < 6) {
      toast.error("Enter your email or phone and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    const { email, phone } = identifierToEmail(identifier);

    if (!signupMode) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (!error) {
        const { data: u } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", u.user!.id)
          .maybeSingle();
        if (profile?.username) return void navigate({ to: "/app" });
        setSignupMode(true);
        setStep("identity");
        return;
      }
      setNotFound(true);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { phone } },
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setBusy(false);
        toast.error(signInError.message);
        return;
      }
    }
    const user = (await supabase.auth.getUser()).data.user!;
    await supabase.from("profiles").upsert({ id: user.id, email: identifier.includes("@") ? email : null, phone });
    setBusy(false);
    setStep("identity");
  }

  async function handleIdentity(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return toast.error("Add your first and last name.");
    if (usernameState !== "free") return toast.error("Pick an available username.");
    setBusy(true);
    const user = (await supabase.auth.getUser()).data.user!;
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: username.trim().toLowerCase(),
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    setStep("birthday");
  }

  async function handleBirthday(e: React.FormEvent) {
    e.preventDefault();
    if (!dob) return toast.error("Choose your date of birth.");
    if (age === null || age < 13) return toast.error("You must be at least 13 years old.");
    setBusy(true);
    const user = (await supabase.auth.getUser()).data.user!;
    await supabase.from("profiles").update({ dob }).eq("id", user.id);
    setBusy(false);
    setStep("profile");
  }

  async function finishProfile(skip: boolean) {
    setBusy(true);
    const user = (await supabase.auth.getUser()).data.user!;
    if (!skip) {
      const patch: Record<string, string | null> = { bio: bio.trim() || null };
      if (photo) {
        try {
          patch.avatar_url = await uploadPublicImage(user.id, photo);
        } catch {
          toast.error("Couldn't upload that photo — continuing without it.");
        }
      }
      await supabase.from("profiles").update(patch).eq("id", user.id);
    }
    setBusy(false);
    void navigate({ to: "/app" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="flex items-center justify-between px-5 py-4">
        <Link to="/" className="font-display text-lg font-extrabold">
          Chat Ebola
        </Link>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          Back to site
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="animate-pop w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-panel">
          {step === "credentials" && (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div>
                <h1 className="font-display text-2xl font-extrabold">
                  {signupMode ? "Create your account" : "Welcome back"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use your email address or phone number.
                </p>
              </div>
              <Field
                label="Email or phone"
                value={identifier}
                autoComplete="username"
                placeholder="you@example.com or +92 300 1234567"
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setNotFound(false);
                }}
              />
              <Field
                label="Password"
                type="password"
                value={password}
                autoComplete={signupMode ? "new-password" : "current-password"}
                placeholder="At least 6 characters"
                onChange={(e) => {
                  setPassword(e.target.value);
                  setNotFound(false);
                }}
              />
              {notFound && !signupMode && (
                <div className="rounded-xl border border-border bg-muted p-3 text-sm">
                  <p className="font-medium">We couldn't sign you in.</p>
                  <p className="mt-1 text-muted-foreground">
                    Check your password, or continue to create a new account with these details.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSignupMode(true);
                      setNotFound(false);
                    }}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Continue to sign up <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {signupMode ? "Create account" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSignupMode(!signupMode);
                  setNotFound(false);
                }}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                {signupMode ? "I already have an account" : "New here? Create an account"}
              </button>
            </form>
          )}

          {step === "identity" && (
            <form onSubmit={handleIdentity} className="space-y-4">
              <StepHeader n={2} title="Who are you?" sub="This is how people will find you." />
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <Field label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div>
                <Field
                  label="Username"
                  value={username}
                  placeholder="lowercase, 3-24 characters"
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                />
                <p className="mt-1.5 flex items-center gap-1.5 text-xs">
                  {usernameState === "checking" && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Checking…
                    </span>
                  )}
                  {usernameState === "free" && (
                    <span className="flex items-center gap-1 text-foreground">
                      <Check className="h-3 w-3" /> @{username.toLowerCase()} is available
                    </span>
                  )}
                  {usernameState === "taken" && (
                    <span className="flex items-center gap-1 text-destructive">
                      <X className="h-3 w-3" /> Already taken
                    </span>
                  )}
                  {usernameState === "invalid" && (
                    <span className="text-muted-foreground">Use letters, numbers, dots or underscores.</span>
                  )}
                </p>
              </div>
              <SubmitRow busy={busy} label="Continue" />
            </form>
          )}

          {step === "birthday" && (
            <form onSubmit={handleBirthday} className="space-y-4">
              <StepHeader n={3} title="Your birthday" sub="We only show your age, never the date." />
              <Field label="Date of birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              <div className="rounded-xl bg-muted px-4 py-3 text-sm">
                Age: <strong>{age === null ? "—" : age}</strong>
              </div>
              <SubmitRow busy={busy} label="Continue" onBack={() => setStep("identity")} />
            </form>
          )}

          {step === "profile" && (
            <div className="space-y-4">
              <StepHeader n={4} title="Photo and bio" sub="Both optional — you can add them later." />
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="relative h-20 w-20 overflow-hidden rounded-full border border-border bg-muted"
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="mx-auto h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setPhoto(f);
                    setPhotoPreview(URL.createObjectURL(f));
                  }}
                />
                <p className="text-sm text-muted-foreground">Add a profile photo</p>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Bio</span>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  maxLength={200}
                  placeholder="Say something short about yourself"
                  className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => finishProfile(true)}
                  className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold"
                >
                  Skip
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => finishProfile(false)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Finish
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StepHeader({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div>
      <span className="text-xs font-semibold text-muted-foreground">Step {n} of 4</span>
      <h1 className="mt-1 font-display text-2xl font-extrabold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

function SubmitRow({ busy, label, onBack }: { busy: boolean; label: string; onBack?: () => void }) {
  return (
    <div className="flex gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} {label}
      </button>
    </div>
  );
}
