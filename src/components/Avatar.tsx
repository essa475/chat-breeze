import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/chat";

type Props = {
  path?: string | null | undefined;
  fallback: string;
  size?: number;
  className?: string;
  square?: boolean;
  online?: boolean;
};

export function Avatar({ path, fallback, size = 48, className = "", square = false, online = false }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (path?.startsWith("http")) {
      setUrl(path);
    } else {
      void signedUrl("avatars", path).then((u) => {
        if (active) setUrl(u);
      });
    }
    return () => {
      active = false;
    };
  }, [path]);

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className={`inline-flex h-full w-full items-center justify-center overflow-hidden bg-secondary font-semibold text-secondary-foreground ${
          square ? "rounded-2xl" : "rounded-full"
        } ${className}`}
        style={{ fontSize: Math.max(11, size * 0.36) }}
      >
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="select-none">{fallback}</span>
        )}
      </span>
      {online && !square && (
        <span className="absolute right-0 bottom-0 h-[22%] w-[22%] rounded-full border-2 border-background bg-online" aria-label="Online" />
      )}
    </span>
  );
}
