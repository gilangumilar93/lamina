import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Wordmark() {
  return (
    <div className="flex items-center gap-2 text-fg">
      <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden="true">
        <rect x="3" y="6" width="12" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="9" y="3" width="12" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span className="text-base font-semibold tracking-tight">Lamina</span>
    </div>
  );
}

export function IconBtn({
  label,
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-muted",
        "transition-colors duration-150 hover:bg-surface-2 hover:text-fg",
        "disabled:pointer-events-none disabled:opacity-35",
        active && "bg-surface-2 text-fg",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-w-6 items-center justify-center rounded-xs border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">
      {children}
    </span>
  );
}
