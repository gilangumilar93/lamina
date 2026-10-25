import { IconBtn } from "@/components/ui";
import { parentIndex, topLevel } from "@/design/geometry";
import { patchNode } from "@/design/ops";
import { useActiveFile, useStore } from "@/design/store";
import type { DesignFile, DesignNode } from "@/design/types";
import { cn } from "@/lib/cn";
import {
  AlignCenter,
  AlignCenterVertical,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  BringToFront,
  ChevronDown,
  ChevronRight,
  Circle,
  Eye,
  EyeOff,
  Frame,
  Group,
  Lock,
  Minus,
  SendToBack,
  Square,
  Trash2,
  Type,
  Ungroup,
  Unlock,
} from "lucide-react";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

const ICONS = { frame: Frame, rect: Square, ellipse: Circle, line: Minus, text: Type, group: Group };
const SWATCHES = ["#1b1b1f", "#f4f1eb", "#ffffff", "#6d8fbf", "#8d9a86", "#c46b5a", "#d9d6d0", "#9aa4b2"];

function trimNum(value: number) {
  return String(Math.round(value * 100) / 100);
}

function shared<T>(nodes: DesignNode[], pick: (node: DesignNode) => T): T | null {
  if (!nodes.length) return null;
  const first = pick(nodes[0]);
  return nodes.every((node) => pick(node) === first) ? first : null;
}

function NumField({
  label,
  value,
  onLive,
}: {
  label: string;
  value: number | null;
  onLive: (value: number) => void;
}) {
  const [text, setText] = useState(value === null ? "" : trimNum(value));
  useEffect(() => setText(value === null ? "" : trimNum(value)), [value]);
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <input
        value={text}
        inputMode="decimal"
        placeholder={value === null ? "Mixed" : undefined}
        aria-label={label}
        className="h-11 rounded-sm border border-border bg-bg px-2 font-mono text-base text-fg outline-none focus:border-border-strong lg:h-9 lg:text-sm"
        onFocus={() => useStore.getState().beginGesture()}
        onBlur={() => useStore.getState().commitGesture()}
        onChange={(event) => {
          setText(event.target.value);
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onLive(next);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          event.stopPropagation();
        }}
      />
    </label>
  );
}

export function LayersPanel({ className = "" }: { className?: string }) {
  const file = useActiveFile();
  const selection = useStore((s) => s.selection);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (!file) return null;
  return (
    <aside className={cn("flex min-h-0 w-56 shrink-0 flex-col border-r border-border bg-surface", className)}>
      <div className="flex h-11 items-center px-3 text-xs font-medium tracking-wide text-muted uppercase">Layers</div>
      <div className="min-h-0 flex-1 overflow-auto pb-3">
        <LayerList ids={file.rootIds} depth={0} selection={selection} open={open} setOpen={setOpen} />
      </div>
    </aside>
  );
}

function LayerList({
  ids,
  depth,
  selection,
  open,
  setOpen,
}: {
  ids: string[];
  depth: number;
  selection: string[];
  open: Record<string, boolean>;
  setOpen: Dispatch<SetStateAction<Record<string, boolean>>>;
}) {
  const file = useActiveFile();
  if (!file) return null;
  return [...ids].reverse().map((id) => {
    const node = file.nodes[id];
    if (!node) return null;
    const Icon = ICONS[node.type];
    const selected = selection.includes(id);
    const expanded = open[id] ?? false;
    return (
      <div key={id}>
        <div
          className={`flex h-10 items-center gap-0.5 pr-1 ${selected ? "bg-surface-2 text-fg" : "text-muted hover:bg-bg hover:text-fg"}`}
          style={{ paddingLeft: 4 + depth * 12 }}
        >
          {node.children.length > 0 ? (
            <button
              type="button"
              aria-label={expanded ? "Collapse" : "Expand"}
              className="inline-flex size-8 items-center justify-center"
              onClick={() => setOpen((prev) => ({ ...prev, [id]: !expanded }))}
            >
              {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          ) : (
            <span className="inline-flex size-8" />
          )}
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => useStore.getState().setSelection([id])}>
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate text-sm">{node.name}</span>
          </button>
          <button
            type="button"
            aria-label={node.visible ? "Hide layer" : "Show layer"}
            className="inline-flex size-8 items-center justify-center"
            onClick={() => useStore.getState().commit((doc) => patchNode(doc, id, { visible: !node.visible }))}
          >
            {node.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </button>
          <button
            type="button"
            aria-label={node.locked ? "Unlock layer" : "Lock layer"}
            className="inline-flex size-8 items-center justify-center"
            onClick={() => useStore.getState().commit((doc) => patchNode(doc, id, { locked: !node.locked }))}
          >
            {node.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
          </button>
        </div>
        {expanded && node.children.length > 0 && (
          <LayerList ids={node.children} depth={depth + 1} selection={selection} open={open} setOpen={setOpen} />
        )}
      </div>
    );
  });
}

export function PropertiesPanel({ className = "" }: { className?: string }) {
  const file = useActiveFile();
  const selection = useStore((s) => s.selection);
  const nodes = (file ? selection.map((id) => file.nodes[id]).filter(Boolean) : []) as DesignNode[];
  const ids = nodes.map((node) => node.id);
  const one = nodes.length === 1 ? nodes[0] : null;

  const livePatch = (patch: Partial<DesignNode>, filter?: (node: DesignNode) => boolean) => {
    useStore.getState().live((doc) => {
      const next = { ...doc.nodes };
      for (const id of ids) {
        const node = next[id];
        if (!node || (filter && !filter(node))) continue;
        next[id] = { ...node, ...patch };
      }
      return { ...doc, nodes: next };
    });
  };

  const canGroup = (() => {
    if (!file || nodes.length < 2) return false;
    const tops = topLevel(file, ids);
    if (tops.length < 2) return false;
    const parents = parentIndex(file);
    const parent = parents.get(tops[0]) ?? null;
    return tops.every((id) => (parents.get(id) ?? null) === parent);
  })();

  return (
    <aside className={cn("flex min-h-0 w-64 shrink-0 flex-col border-l border-border bg-surface", className)}>
      <div className="flex h-11 items-center justify-between px-3">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">Design</span>
        {nodes.length > 0 && (
          <IconBtn label="Delete" onClick={() => useStore.getState().removeSelection()}>
            <Trash2 className="size-4" />
          </IconBtn>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-3 pb-4">
        {nodes.length === 0 && (
          <p className="text-sm leading-normal text-muted">Select a layer to edit position, fill, stroke, and type. Or draw with the tools on the left.</p>
        )}
        {one && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Name</span>
            <input
              value={one.name}
              aria-label="Layer name"
              className="h-11 rounded-sm border border-border bg-bg px-2 text-base text-fg outline-none lg:h-9 lg:text-sm"
              onFocus={() => useStore.getState().beginGesture()}
              onBlur={() => useStore.getState().commitGesture()}
              onChange={(event) => livePatch({ name: event.target.value })}
              onKeyDown={(event) => event.stopPropagation()}
            />
          </label>
        )}
        {nodes.length > 1 && (
          <div className="grid grid-cols-3 gap-1">
            <IconBtn label="Align left" onClick={() => useStore.getState().alignSelection("left")}>
              <AlignLeft className="size-4" />
            </IconBtn>
            <IconBtn label="Align center" onClick={() => useStore.getState().alignSelection("center")}>
              <AlignCenter className="size-4" />
            </IconBtn>
            <IconBtn label="Align right" onClick={() => useStore.getState().alignSelection("right")}>
              <AlignRight className="size-4" />
            </IconBtn>
            <IconBtn label="Align top" onClick={() => useStore.getState().alignSelection("top")}>
              <AlignStartVertical className="size-4" />
            </IconBtn>
            <IconBtn label="Align middle" onClick={() => useStore.getState().alignSelection("middle")}>
              <AlignCenterVertical className="size-4" />
            </IconBtn>
            <IconBtn label="Align bottom" onClick={() => useStore.getState().alignSelection("bottom")}>
              <AlignEndVertical className="size-4" />
            </IconBtn>
          </div>
        )}
        {nodes.length > 2 && (
          <div className="flex gap-2">
            <button type="button" className="h-9 flex-1 rounded-sm border border-border text-xs text-muted hover:text-fg" onClick={() => useStore.getState().distributeSelection("h")}>
              Distribute H
            </button>
            <button type="button" className="h-9 flex-1 rounded-sm border border-border text-xs text-muted hover:text-fg" onClick={() => useStore.getState().distributeSelection("v")}>
              Distribute V
            </button>
          </div>
        )}
        {one && (
          <div className="grid grid-cols-2 gap-2">
            <NumField label="X" value={one.x} onLive={(x) => livePatch({ x })} />
            <NumField label="Y" value={one.y} onLive={(y) => livePatch({ y })} />
            <NumField label="W" value={one.w} onLive={(w) => livePatch({ w: Math.max(1, w) })} />
            <NumField label="H" value={one.h} onLive={(h) => livePatch({ h: Math.max(1, h) })} />
            <NumField label="Rotate" value={one.rotation} onLive={(rotation) => livePatch({ rotation })} />
          </div>
        )}
        {nodes.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Opacity {shared(nodes, (node) => node.opacity) ?? "mixed"}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={shared(nodes, (node) => node.opacity) ?? 100}
              aria-label="Opacity"
              className="w-full"
              onPointerDown={() => useStore.getState().beginGesture()}
              onPointerUp={() => useStore.getState().commitGesture()}
              onChange={(event) => livePatch({ opacity: Number(event.target.value) })}
            />
          </label>
        )}
        {nodes.length > 0 && (
          <ColorField label={nodes.every((node) => node.type === "text") ? "Color" : "Fill"} value={shared(nodes, (node) => node.fill)} ids={ids} kind="fill" />
        )}
        {nodes.some((node) => node.type !== "text") && (
          <>
            <ColorField label="Stroke" value={shared(nodes, (node) => node.stroke)} ids={ids} kind="stroke" />
            <NumField
              label="Stroke width"
              value={shared(nodes, (node) => node.strokeWidth)}
              onLive={(strokeWidth) => livePatch({ strokeWidth: Math.max(0, strokeWidth) })}
            />
          </>
        )}
        {nodes.some((node) => node.type === "rect" || node.type === "frame") && (
          <NumField
            label="Radius"
            value={shared(
              nodes.filter((node) => node.type === "rect" || node.type === "frame"),
              (node) => node.radius,
            )}
            onLive={(radius) => livePatch({ radius: Math.max(0, radius) }, (node) => node.type === "rect" || node.type === "frame")}
          />
        )}
        {nodes.some((node) => node.type === "text") && (
          <div className="flex flex-col gap-2">
            <NumField
              label="Font size"
              value={shared(
                nodes.filter((node) => node.type === "text"),
                (node) => node.fontSize,
              )}
              onLive={(fontSize) => livePatch({ fontSize: Math.max(1, fontSize) }, (node) => node.type === "text")}
            />
            <div className="flex gap-1">
              {[400, 500, 600, 700].map((weight) => (
                <button
                  key={weight}
                  type="button"
                  className={`h-9 flex-1 rounded-sm border text-xs ${shared(nodes, (node) => node.fontWeight) === weight ? "border-border-strong text-fg" : "border-border text-muted"}`}
                  onClick={() => useStore.getState().commit((doc) => {
                    let next = doc;
                    for (const id of ids) if (doc.nodes[id]?.type === "text") next = patchNode(next, id, { fontWeight: weight });
                    return next;
                  })}
                >
                  {weight}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  className={`h-9 flex-1 rounded-sm border text-xs capitalize ${shared(nodes, (node) => node.align) === align ? "border-border-strong text-fg" : "border-border text-muted"}`}
                  onClick={() =>
                    useStore.getState().commit((doc) => {
                      let next = doc;
                      for (const id of ids) if (next.nodes[id]?.type === "text") next = patchNode(next, id, { align });
                      return next;
                    })
                  }
                >
                  {align}
                </button>
              ))}
            </div>
          </div>
        )}
        {one && (
          <div className="flex gap-1">
            <IconBtn label="Send backward" onClick={() => useStore.getState().reorderSelection("backward")}>
              <SendToBack className="size-4" />
            </IconBtn>
            <IconBtn label="Bring forward" onClick={() => useStore.getState().reorderSelection("forward")}>
              <BringToFront className="size-4" />
            </IconBtn>
            <IconBtn label="Group" disabled={!canGroup} onClick={() => useStore.getState().groupSelection()}>
              <Group className="size-4" />
            </IconBtn>
            <IconBtn label="Ungroup" disabled={one.type !== "group"} onClick={() => useStore.getState().ungroupSelection()}>
              <Ungroup className="size-4" />
            </IconBtn>
          </div>
        )}
        {nodes.length > 1 && (
          <IconBtn label="Group selection" disabled={!canGroup} onClick={() => useStore.getState().groupSelection()}>
            <Group className="size-4" />
          </IconBtn>
        )}
      </div>
    </aside>
  );
}

function ColorField({
  label,
  value,
  ids,
  kind,
}: {
  label: string;
  value: string | null | undefined;
  ids: string[];
  kind: "fill" | "stroke";
}) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [value]);
  const hex = value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#6d8fbf";
  const write = (next: string | null, mode: "live" | "commit") => {
    const apply = (doc: DesignFile) => {
      let file = doc;
      for (const id of ids) file = patchNode(file, id, { [kind]: next });
      return file;
    };
    if (mode === "live") useStore.getState().live(apply);
    else useStore.getState().commit(apply);
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex flex-wrap gap-1">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={swatch}
            className="size-8 rounded-sm border border-border"
            style={{ background: swatch }}
            onClick={() => write(swatch, "commit")}
          />
        ))}
        <button type="button" className="h-8 rounded-sm border border-border px-2 text-xs text-muted" onClick={() => write(null, "commit")}>
          None
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={hex}
          className="size-11 shrink-0 cursor-pointer rounded-sm border border-border bg-bg p-1 lg:size-9"
          onFocus={() => useStore.getState().beginGesture()}
          onBlur={() => useStore.getState().commitGesture()}
          onChange={(event) => write(event.target.value, "live")}
        />
        <input
          value={text}
          placeholder="None"
          aria-label={`${label} hex`}
          className="h-11 min-w-0 flex-1 rounded-sm border border-border bg-bg px-2 font-mono text-sm text-fg lg:h-9"
          onFocus={() => useStore.getState().beginGesture()}
          onBlur={() => useStore.getState().commitGesture()}
          onChange={(event) => {
            const next = event.target.value.trim();
            setText(event.target.value);
            if (next === "") write(null, "live");
            else if (/^#[0-9a-fA-F]{6}$/.test(next)) write(next, "live");
          }}
          onKeyDown={(event) => event.stopPropagation()}
        />
      </div>
    </div>
  );
}
