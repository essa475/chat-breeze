import logoAsset from "@/assets/chat-ebola-logo.jpg.asset.json";
import markAsset from "@/assets/chat-ebola-mark.jpg.asset.json";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src={compact ? markAsset.url : logoAsset.url}
      alt="Chat Ebola"
      className={compact ? "h-10 w-10 rounded-full object-cover object-center" : "h-auto w-48 object-contain"}
    />
  );
}