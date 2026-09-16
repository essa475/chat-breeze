import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCheck,
  Files,
  Lock,
  MessageSquareText,
  MousePointerClick,
  Users,
} from "lucide-react";
import { TiltCard } from "@/components/TiltCard";
import { ChatListMock, ConversationMock, GroupMock } from "@/components/PhoneMock";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chat Ebola — Private messaging with files, groups & receipts" },
      {
        name: "description",
        content:
          "Chat Ebola is a fast, private messenger: search people, send files up to 50 MB, react and reply, build groups and see read receipts in real time.",
      },
      { property: "og:title", content: "Chat Ebola — Private messaging, done clean" },
      {
        property: "og:description",
        content:
          "Search people, send files up to 50 MB, react and reply, build groups and see read receipts in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    title: "Every chat in one calm list",
    body: "Search by username, email, name or phone. Unread counts, last message and timing at a glance.",
    icon: MessageSquareText,
    mock: <ChatListMock />,
  },
  {
    title: "Messages that behave",
    body: "Reply, edit, react, copy, delete. Long-press on mobile, right-click on desktop. Read ticks turn blue.",
    icon: CheckCheck,
    mock: <ConversationMock />,
  },
  {
    title: "Groups with real admins",
    body: "Create a group, set a photo, promote admins, remove members or leave — admin tools stay hidden from members.",
    icon: Users,
    mock: <GroupMock />,
  },
];

const steps = [
  {
    n: "01",
    t: "Create your account",
    d: "Sign in with an email or a phone number, then pick a unique username.",
  },
  {
    n: "02",
    t: "Find your people",
    d: "Search anyone by name, username, email or phone and start a chat instantly.",
  },
  {
    n: "03",
    t: "Say anything",
    d: "Text, photos, video, documents, spreadsheets and ZIPs up to 50 MB per file.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <span className="flex items-center gap-2">
            <BrandLogo compact />
            <span className="font-display text-lg font-extrabold">Chat Ebola</span>
          </span>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#privacy" className="transition-colors hover:text-foreground">
              Privacy
            </a>
          </nav>
          <Link
            to="/auth"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
          >
            Get started
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pt-16 pb-10 md:pt-24">
        <div className="animate-rise text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-read" /> Real-time, no refresh needed
          </span>
          <h1 className="sr-only">Chat Ebola</h1>
          <div className="mt-6 flex justify-center">
            <BrandLogo />
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Messaging that spreads fast and stays yours. Files up to 50 MB, groups with real admin
            controls, and read receipts you can trust.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold transition-colors hover:bg-muted"
            >
              Explore
            </a>
          </div>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {features.map((f, i) => (
            <TiltCard key={f.title} className="p-6">
              <div
                className="animate-rise"
                style={{ animationDelay: `${i * 90}ms`, transform: "translateZ(40px)" }}
              >
                <f.icon className="h-5 w-5" />
                <h3 className="mt-4 font-display text-xl font-bold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
              <div className="mt-6" style={{ transform: "translateZ(60px)" }}>
                {f.mock}
              </div>
            </TiltCard>
          ))}
        </div>
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <MousePointerClick className="h-3.5 w-3.5" /> Move your cursor over the cards
        </p>
      </section>

      <section id="features" className="border-t border-border bg-surface py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-3xl font-extrabold sm:text-5xl">
            Everything a conversation needs.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                i: Files,
                t: "Any file, up to 50 MB",
                d: "Images and video preview inline. Documents, Excel and ZIP show name, size and download.",
              },
              {
                i: CheckCheck,
                t: "Sent, delivered, read",
                d: "Three states on every message. Read is the only splash of colour in the app.",
              },
              {
                i: Lock,
                t: "Request before messaging",
                d: "Turn on privacy mode and strangers must be accepted before they can reach you.",
              },
              {
                i: Users,
                t: "Groups that scale",
                d: "Rename, re-photo, add or remove people, promote admins, or quietly leave.",
              },
            ].map((c) => (
              <div
                key={c.t}
                className="rounded-2xl border border-border bg-card p-5 transition-transform duration-200 hover:-translate-y-1"
              >
                <c.i className="h-5 w-5" />
                <h3 className="mt-3 text-base font-semibold">{c.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-3xl font-extrabold sm:text-5xl">How it works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border p-6">
                <span className="font-display text-4xl font-extrabold text-muted-foreground/40">
                  {s.n}
                </span>
                <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="privacy"
        className="border-t border-border bg-primary py-20 text-primary-foreground"
      >
        <div className="mx-auto max-w-3xl px-5 text-center">
          <h2 className="font-display text-3xl font-extrabold sm:text-5xl">
            Your chat, your rules.
          </h2>
          <p className="mt-4 text-sm opacity-80 sm:text-base">
            Passwords are hashed and never stored in the app. Messages, files and groups are locked
            to their members by database-level rules — not by hiding buttons.
          </p>
          <Link
            to="/auth"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-background px-6 py-3 text-sm font-semibold text-foreground transition-transform hover:scale-[1.03]"
          >
            Create your account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-muted-foreground sm:flex-row">
          <span className="flex items-center gap-2 font-display text-base font-extrabold text-foreground">
            <BrandLogo compact /> Chat Ebola
          </span>
          <span>© {new Date().getFullYear()} Chat Ebola. All rights reserved.</span>
          <Link to="/auth" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
