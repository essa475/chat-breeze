import { useRef, type ReactNode } from "react";

export function TiltCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `rotateY(${px * 14}deg) rotateX(${-py * 14}deg) translateZ(18px) scale(1.02)`;
    el.style.boxShadow = `${-px * 30}px ${-py * 30 + 24}px 60px oklch(0 0 0 / 0.16)`;
  };

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "rotateY(0deg) rotateX(0deg) translateZ(0) scale(1)";
    el.style.boxShadow = "";
  };

  return (
    <div className="tilt-scene">
      <div
        ref={ref}
        onMouseMove={handleMove}
        onMouseLeave={reset}
        className={`rounded-3xl border border-border bg-card transition-[transform,box-shadow] duration-200 ease-out will-change-transform ${className}`}
        style={{ transformStyle: "preserve-3d" }}
      >
        {children}
      </div>
    </div>
  );
}
