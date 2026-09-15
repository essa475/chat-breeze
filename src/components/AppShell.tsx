import { Link } from "@tanstack/react-router";
import { MessageSquareText, Search, Settings, UserPlus } from "lucide-react";
import type { ReactNode } from "react";

type Tab = "chats" | "search" | "requests" | "settings";

export function AppShell({
  title,
  actions,
  tab,
  children,
  requestCount = 0,
}: {
  title: string;
  actions?: ReactNode;
  tab: Tab;
  children: ReactNode;
  requestCount?: number;
}) {
  const items: { id: Tab; label: string; icon: typeof Search; to: "/app" | "/app/search" | "/app/requests" | "/app/settings" }[] = [
    { id: "chats", label: "Chats", icon: MessageSquareText, to: "/app" },
    { id: "search", label: "Find", icon: Search, to: "/app/search" },
    { id: "requests", label: "Requests", icon: UserPlus, to: "/app/requests" },
    { id: "settings", label: "Settings", icon: Settings, to: "/app/settings" },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>
        <div className="flex items-center gap-1">{actions}</div>
      </header>

      <main key={tab} className="flex-1 pb-24 animate-tab-enter">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl">
          {items.map((item) => {
            const active = item.id === tab;
            return (
              <Link
                key={item.id}
                to={item.to}
                preload="intent"
                className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
              >
                <span
                  className={`rounded-full px-5 py-1 transition-colors ${
                    active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                </span>
                <span className={active ? "text-foreground" : "text-muted-foreground"}>
                  {item.label}
                </span>
                {item.id === "requests" && requestCount > 0 && (
                  <span className="absolute top-1 right-[28%] rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {requestCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: typeof Search;
  title: string;
  body: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </span>
      <h2 className="mt-5 font-display text-xl font-bold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && (
        <Link
          to={action.to}
          className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
