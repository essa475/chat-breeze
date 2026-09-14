import { useEffect, useState } from "react";
import { Download, File, FileArchive, FileSpreadsheet, FileText, Play } from "lucide-react";
import { formatBytes, signedUrl, type Attachment } from "@/lib/chat";

function iconFor(name: string, mime: string | null) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return FileArchive;
  if (["xls", "xlsx", "csv"].includes(ext) || (mime ?? "").includes("spreadsheet")) return FileSpreadsheet;
  if (["pdf", "doc", "docx", "txt", "ppt", "pptx"].includes(ext)) return FileText;
  return File;
}

export function AttachmentView({ attachment, mine }: { attachment: Attachment; mine: boolean }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void signedUrl("attachments", attachment.path ?? attachment.url).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [attachment.path, attachment.url]);

  if (attachment.kind === "image") {
    return (
      <a href={url ?? undefined} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
        {url ? (
          <img src={url} alt={attachment.name} loading="lazy" className="max-h-80 w-full object-cover" />
        ) : (
          <span className="block h-40 w-56 animate-pulse rounded-xl bg-muted" />
        )}
      </a>
    );
  }

  if (attachment.kind === "video") {
    return url ? (
      <video src={url} controls playsInline className="max-h-80 w-full rounded-xl" />
    ) : (
      <span className="flex h-40 w-56 items-center justify-center rounded-xl bg-muted">
        <Play className="h-6 w-6 text-muted-foreground" />
      </span>
    );
  }

  if (attachment.kind === "audio") {
    return url ? <audio src={url} controls className="w-56" /> : null;
  }

  const Icon = iconFor(attachment.name, attachment.mime);
  return (
    <a
      href={url ?? undefined}
      download={attachment.name}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${mine ? "bg-black/5" : "bg-background"}`}
    >
      <Icon className="h-7 w-7 shrink-0 opacity-70" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{attachment.name}</span>
        <span className="block text-[11px] opacity-70">{formatBytes(attachment.size)}</span>
      </span>
      <Download className="h-4 w-4 shrink-0 opacity-70" />
    </a>
  );
}
