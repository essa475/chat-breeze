import logoAsset from "@/assets/chat-ebola-logo.jpg.asset.json";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src={logoAsset.url}
      alt="Chat Ebola"
      className={compact ? "h-9 w-[116px] object-cover object-center" : "h-auto w-48 object-contain"}
    />
  );
}