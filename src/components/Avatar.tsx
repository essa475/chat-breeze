import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/chat";

type Props = {
  path?: string | null;
  fallback: string;
  size?: number;
  className?: string;
  square?: boolean;
};

export function Avatar({ path, fallback, size = 48, className = "", square = false }: Props) {
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
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-secondary font-semibold text-secondary-foreground ${
        square ? "rounded-2xl" : "rounded-full"
      } ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="select-none">{fallback}</span>
      )}
    </span>
  );
}
