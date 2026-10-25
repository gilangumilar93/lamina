import { IconBtn, Kbd, Wordmark } from "@/components/ui";
import { downloadBlob, downloadText, fileToPng, fileToSvg } from "@/design/export";
import { keys, viewportEl } from "@/design/keys";
import { useActiveFile, useStore } from "@/design/store";
import { TOOLS, type Tool } from "@/design/types";
import {
  Circle,
  Download,
  Frame,
  Hand,
  Keyboard,
  Magnet,
  Minus,
  MousePointer2,
  Redo2,
  Square,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useState } from "react";

const ICONS: Record<Tool, typeof Square> = {
  select: MousePointer2,
  hand: Hand,
  frame: Frame,
  rect: Square,
  ellipse: Circle,
  line: Minus,
  text: Type,
};

export function ToolButtons({ onPick }: { onPick?: () => void }) {
  const tool = useStore((s) => s.tool);
  return (
    <>
      {TOOLS.map((item) => {
        const Icon = ICONS[item.id];
        return (
          <IconBtn
            key={item.id}
            label={`${item.label} (${item.key})`}
            active={tool === item.id}
            onClick={() => {
              useStore.getState().setTool(item.id);
              onPick?.();
            }}
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </IconBtn>
        );
      })}
    </>
  );
}

export function ToolRail() {
  return (
    <div className="hidden w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface py-2 lg:flex">
      <ToolButtons />
    </div>
  );
}

export function TopBar() {
  const file = useActiveFile();
  const zoom = useStore((s) => s.zoom);
  const snap = useStore((s) => s.snap);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const [name, setName] = useState(file?.name ?? "");
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => setName(file?.name ?? ""), [file?.id, file?.name]);

  const exportSvg = () => {
    if (!file) return;
    const result = fileToSvg(file, useStore.getState().selection);
    if (result) downloadText(result.svg, result.name, "image/svg+xml");
    setExportOpen(false);
  };
  const exportPng = async () => {
    if (!file) return;
    const result = await fileToPng(file, useStore.getState().selection);
    if (result) downloadBlob(result.blob, result.name);
    setExportOpen(false);
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border bg-surface px-2">
      <button
        type="button"
        aria-label="All files"
        className="inline-flex h-11 shrink-0 items-center rounded-sm px-1"
        onClick={() => useStore.getState().goHome()}
      >
        <span className="sm:hidden">
          <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
            <rect x="3" y="6" width="12" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="9" y="3" width="12" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </span>
        <span className="hidden sm:inline-flex">
          <Wordmark />
        </span>
      </button>
      <input
        aria-label="File name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => file && useStore.getState().renameFile(file.id, name)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="h-9 min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-2 text-sm font-medium text-fg outline-none focus:border-border focus:bg-bg"
      />
      <IconBtn label="Undo" disabled={!canUndo} onClick={() => useStore.getState().undo()}>
        <Undo2 className="size-4" />
      </IconBtn>
      <IconBtn label="Redo" disabled={!canRedo} onClick={() => useStore.getState().redo()}>
        <Redo2 className="size-4" />
      </IconBtn>
      <div className="mx-1 hidden items-center gap-1 sm:flex">
        <IconBtn label="Zoom out" onClick={() => useStore.getState().zoomBy(1 / 1.15)}>
          <ZoomOut className="size-4" />
        </IconBtn>
        <button
          type="button"
          className="h-9 min-w-14 rounded-sm px-2 font-mono text-xs text-muted tabular-nums hover:bg-surface-2 hover:text-fg"
          onClick={() => useStore.getState().zoom100()}
        >
          {Math.round(zoom * 100)}%
        </button>
        <IconBtn label="Zoom in" onClick={() => useStore.getState().zoomBy(1.15)}>
          <ZoomIn className="size-4" />
        </IconBtn>
        <button
          type="button"
          className="h-9 rounded-sm px-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg"
          onClick={() => useStore.getState().fit("all")}
        >
          Fit
        </button>
      </div>
      <IconBtn label={snap ? "Snap on" : "Snap off"} active={snap} onClick={() => useStore.getState().toggleSnap()}>
        <Magnet className="size-4" />
      </IconBtn>
      <IconBtn label="Shortcuts" className="hidden sm:inline-flex" onClick={() => useStore.getState().setShortcuts(true)}>
        <Keyboard className="size-4" />
      </IconBtn>
      <div className="relative">
        <IconBtn label="Export" active={exportOpen} onClick={() => setExportOpen((open) => !open)}>
          <Download className="size-4" />
        </IconBtn>
        {exportOpen && (
          <div className="modal-enter absolute top-12 right-0 z-30 w-44 rounded-md border border-border bg-surface p-1 shadow-lg">
            <button type="button" className="block h-11 w-full rounded-sm px-3 text-left text-sm hover:bg-surface-2" onClick={exportSvg}>
              Export SVG
            </button>
            <button type="button" className="block h-11 w-full rounded-sm px-3 text-left text-sm hover:bg-surface-2" onClick={exportPng}>
              Export PNG
            </button>
            <p className="px-3 py-2 text-xs text-subtle">Uses the selection, or the whole file.</p>
          </div>
        )}
      </div>
    </header>
  );
}

export function MobileDock() {
  return (
    <div className="safe-bottom flex border-t border-border bg-surface lg:hidden">
      <div className="flex w-full gap-0.5 overflow-x-auto px-1 py-1">
        <ToolButtons />
      </div>
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ["V H F", "Select, hand, frame"],
  ["R O L T", "Rect, ellipse, line, text"],
  ["Ctrl Z", "Undo"],
  ["Ctrl Shift Z", "Redo"],
  ["Ctrl D", "Duplicate"],
  ["Ctrl C V", "Copy and paste"],
  ["Ctrl G", "Group"],
  ["Ctrl Shift G", "Ungroup"],
  ["Arrows", "Nudge 1px"],
  ["Shift arrows", "Nudge 10px"],
  ["Ctrl 0", "Fit"],
  ["Ctrl 1", "Zoom 100%"],
  ["[ ]", "Send back / forward"],
  ["Space", "Pan"],
  ["Shift", "Constrain"],
  ["Alt drag", "Duplicate"],
  ["Delete", "Remove"],
];

export function Shortcuts() {
  const open = useStore((s) => s.shortcuts);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 p-3 sm:items-center" onClick={() => useStore.getState().setShortcuts(false)}>
      <div
        className="modal-enter max-h-[80%] w-full max-w-md overflow-auto rounded-xl border border-border bg-surface p-4"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Shortcuts"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Shortcuts</h2>
          <button type="button" className="h-9 rounded-sm px-2 text-sm text-muted hover:text-fg" onClick={() => useStore.getState().setShortcuts(false)}>
            Close
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {SHORTCUTS.map(([key, label]) => (
            <li key={key} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">{label}</span>
              <Kbd>{key}</Kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function syncSpaceCursor() {
  if (viewportEl.current) viewportEl.current.dataset.space = keys.space ? "1" : "0";
}
