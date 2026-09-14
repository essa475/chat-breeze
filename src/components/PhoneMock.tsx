import { CheckCheck, FileText, Paperclip, Search, Users } from "lucide-react";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-[26px] border border-border bg-background shadow-panel">
      {children}
    </div>
  );
}

export function ChatListMock() {
  const rows = [
    { n: "Dannyal", m: "Sent the deck ✓", t: "12:08" },
    { n: "Design crew", m: "Ayesha: moving to 4pm", t: "11:42" },
    { n: "Father", m: "Call me when free", t: "09:30" },
    { n: "Zoya", m: "Photo", t: "Yesterday" },
  ];
  return (
    <Frame>
      <div className="space-y-3 p-4">
        <p className="font-display text-lg font-bold">Chats</p>
        <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-xs text-muted-foreground">
          <Search className="h-3.5 w-3.5" /> Search
        </div>
        {rows.map((r) => (
          <div key={r.n} className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-full bg-secondary" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{r.n}</span>
              <span className="block truncate text-xs text-muted-foreground">{r.m}</span>
            </span>
            <span className="text-[10px] text-muted-foreground">{r.t}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function ConversationMock() {
  return (
    <Frame>
      <div className="space-y-3 bg-surface p-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <span className="h-8 w-8 rounded-full bg-secondary" />
          <span className="text-sm font-semibold">Dannyal</span>
        </div>
        <div className="max-w-[70%] rounded-2xl rounded-bl-md bg-bubble-in px-3 py-2 text-xs text-bubble-in-foreground">
          Did the file upload work?
        </div>
        <div className="ml-auto max-w-[75%] rounded-2xl rounded-br-md bg-bubble-out px-3 py-2 text-xs text-bubble-out-foreground">
          Yes — 42 MB, no problem.
          <span className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-80">
            12:04 <CheckCheck className="h-3 w-3 text-read" />
          </span>
        </div>
        <div className="ml-auto flex max-w-[75%] items-center gap-2 rounded-2xl rounded-br-md bg-bubble-out px-3 py-2 text-[11px] text-bubble-out-foreground">
          <FileText className="h-4 w-4" />
          <span className="min-w-0">
            <span className="block truncate">report-q3.xlsx</span>
            <span className="opacity-70">1.2 MB</span>
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" /> Message
        </div>
      </div>
    </Frame>
  );
}

export function GroupMock() {
  return (
    <Frame>
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <p className="font-display text-base font-bold">Design crew</p>
        </div>
        {["Ayesha — admin", "Bilal — admin", "Hina", "Usman"].map((m) => (
          <div key={m} className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2">
            <span className="h-7 w-7 rounded-full bg-secondary" />
            <span className="text-xs font-medium">{m}</span>
          </div>
        ))}
        <div className="rounded-xl border border-dashed border-border px-3 py-2 text-center text-[11px] text-muted-foreground">
          Add members
        </div>
      </div>
    </Frame>
  );
}
