import { useEffect, useMemo, useState } from "react";
import { File, Loader2, Send, X } from "lucide-react";
import { formatBytes, kindOf } from "@/lib/chat";

export function AttachmentComposer({
  files,
  recipient,
  sending,
  onCancel,
  onSend,
}: {
  files: File[];
  recipient: string;
  sending: boolean;
  onCancel: () => void;
  onSend: (caption: string) => void;
}) {
  const [caption, setCaption] = useState("");
  const previews = useMemo(
    () => files.map((file) => ({ file, kind: kindOf(file.type, file.name), url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-foreground text-background animate-pop">
      <header className="flex items-center gap-3 border-b border-background/15 px-4 py-3">
        <button onClick={onCancel} aria-label="Close preview" className="rounded-full p-2 hover:bg-background/10">
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{files.length === 1 ? files[0]?.name : `${files.length} files`}</p>
          <p className="text-xs opacity-60">Send to {recipient}</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto">
        {previews.map(({ file, kind, url }) => (
          <div key={`${file.name}-${file.size}`} className="flex min-w-full snap-center items-center justify-center p-5">
            {kind === "image" ? (
              <img src={url} alt={file.name} className="max-h-full max-w-full object-contain" />
            ) : kind === "video" ? (
              <video src={url} controls playsInline className="max-h-full max-w-full" />
            ) : kind === "audio" ? (
              <audio src={url} controls className="w-full max-w-md" />
            ) : (
              <div className="flex max-w-sm flex-col items-center text-center">
                <File className="h-20 w-20 opacity-70" />
                <p className="mt-4 max-w-full break-all font-semibold">{file.name}</p>
                <p className="mt-1 text-sm opacity-60">{formatBytes(file.size)}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <footer className="border-t border-background/15 p-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-3xl bg-background/10 p-2 pl-4 transition-all focus-within:bg-background/15 focus-within:ring-1 focus-within:ring-background/30">
          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            rows={1}
            maxLength={1000}
            placeholder="Add a caption…"
            className="max-h-28 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-background/50"
          />
          <button
            onClick={() => onSend(caption.trim())}
            disabled={sending}
            aria-label="Send attachment"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background text-foreground disabled:opacity-60"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </footer>
    </div>
  );
}