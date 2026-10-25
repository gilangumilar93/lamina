import { fileAabb, clamp, worldAabb } from "@/design/geometry";
import {
  alignNodes,
  copySelection,
  createNode,
  deleteNodes,
  distributeNodes,
  duplicateInPlace,
  groupNodes,
  nudge,
  pasteClipboard,
  reorder,
  ungroupNodes,
  uid,
  type Clipboard,
} from "@/design/ops";
import { blankFile, sampleFile } from "@/design/sample";
import type { DesignFile, DesignNode, NodeType, Tool } from "@/design/types";
import { create } from "zustand";

const KEY = "lamina.v1";
const HISTORY = 50;

export type Panel = "layers" | "props" | null;

type State = {
  files: DesignFile[];
  activeId: string;
  screen: "home" | "editor";
  tool: Tool;
  selection: string[];
  zoom: number;
  panX: number;
  panY: number;
  viewW: number;
  viewH: number;
  snap: boolean;
  panel: Panel;
  shortcuts: boolean;
  editingId: string | null;
  ready: boolean;
  past: DesignFile[];
  future: DesignFile[];
  gesture: DesignFile | null;
  clipboard: Clipboard | null;
  hydrate: () => void;
  goHome: () => void;
  openFile: (id: string) => void;
  newFile: () => void;
  renameFile: (id: string, name: string) => void;
  duplicateFile: (id: string) => void;
  deleteFile: (id: string) => void;
  setTool: (tool: Tool) => void;
  setSelection: (ids: string[]) => void;
  toggleSnap: () => void;
  setPanel: (panel: Panel) => void;
  setShortcuts: (open: boolean) => void;
  setEditing: (id: string | null) => void;
  setView: (zoom: number, panX: number, panY: number) => void;
  setViewport: (w: number, h: number) => void;
  fit: (mode?: "all" | "smart") => void;
  zoomBy: (factor: number) => void;
  zoom100: () => void;
  beginGesture: () => void;
  live: (mut: (file: DesignFile) => DesignFile) => void;
  commitGesture: () => void;
  cancelGesture: () => void;
  commit: (mut: (file: DesignFile) => DesignFile) => void;
  undo: () => void;
  redo: () => void;
  removeSelection: () => void;
  duplicateSelection: () => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  alignSelection: (mode: "left" | "center" | "right" | "top" | "middle" | "bottom") => void;
  distributeSelection: (axis: "h" | "v") => void;
  reorderSelection: (dir: "front" | "back" | "forward" | "backward") => void;
  nudgeSelection: (dx: number, dy: number) => void;
  copy: () => void;
  cut: () => void;
  paste: () => void;
  selectAll: () => void;
};

function active(files: DesignFile[], id: string) {
  return files.find((file) => file.id === id) ?? null;
}

function swap(files: DesignFile[], next: DesignFile) {
  return files.map((file) => (file.id === next.id ? next : file));
}

function same(a: DesignFile, b: DesignFile) {
  return JSON.stringify(a.nodes) === JSON.stringify(b.nodes) && JSON.stringify(a.rootIds) === JSON.stringify(b.rootIds);
}

function persist(files: DesignFile[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(files));
  } catch {
    /* quota */
  }
}

function normalizeNode(raw: Partial<DesignNode> & { id: string }): DesignNode {
  const type: NodeType = raw.type && ["frame", "rect", "ellipse", "line", "text", "group"].includes(raw.type) ? raw.type : "rect";
  return createNode(type, { ...raw, children: Array.isArray(raw.children) ? raw.children : [] });
}

function normalize(file: DesignFile): DesignFile | null {
  if (!file || typeof file.id !== "string" || !file.nodes) return null;
  const nodes: Record<string, DesignNode> = {};
  for (const [id, raw] of Object.entries(file.nodes)) {
    if (!raw || typeof raw !== "object") continue;
    nodes[id] = normalizeNode({ ...raw, id });
  }
  for (const node of Object.values(nodes)) {
    node.children = node.children.filter((id) => nodes[id]);
  }
  return {
    id: file.id,
    name: file.name || "Untitled",
    updatedAt: file.updatedAt || Date.now(),
    nodes,
    rootIds: (file.rootIds ?? []).filter((id) => nodes[id]),
  };
}

function load(): DesignFile[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DesignFile[];
    if (!Array.isArray(parsed)) return null;
    const files = parsed.map(normalize).filter((file): file is DesignFile => !!file);
    return files.length ? files : null;
  } catch {
    return null;
  }
}

const sample = sampleFile();

export const useStore = create<State>((set, get) => ({
  files: [sample],
  activeId: sample.id,
  screen: "editor",
  tool: "select",
  selection: ["screen"],
  zoom: 1,
  panX: 48,
  panY: 48,
  viewW: 800,
  viewH: 600,
  snap: true,
  panel: null,
  shortcuts: false,
  editingId: null,
  ready: false,
  past: [],
  future: [],
  gesture: null,
  clipboard: null,

  hydrate: () => {
    const saved = load();
    if (saved) {
      const newest = [...saved].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      set({ files: saved, activeId: newest.id, ready: true, past: [], future: [], selection: [], editingId: null });
      return;
    }
    const files = get().files.map((file) => ({ ...file, updatedAt: Date.now() }));
    persist(files);
    set({ files, ready: true });
  },

  goHome: () => set({ screen: "home", panel: null, editingId: null, shortcuts: false }),

  openFile: (id) =>
    set({
      activeId: id,
      screen: "editor",
      selection: [],
      editingId: null,
      past: [],
      future: [],
      gesture: null,
      tool: "select",
      panel: null,
    }),

  newFile: () => {
    const count = get().files.length + 1;
    const file = blankFile(count === 1 ? "Untitled" : `Untitled ${count}`);
    const files = [file, ...get().files];
    persist(files);
    set({ files, activeId: file.id, screen: "editor", selection: [], past: [], future: [], editingId: null, tool: "select" });
  },

  renameFile: (id, name) => {
    const trimmed = name.trim() || "Untitled";
    const files = get().files.map((file) => (file.id === id ? { ...file, name: trimmed, updatedAt: Date.now() } : file));
    persist(files);
    set({ files });
  },

  duplicateFile: (id) => {
    const file = get().files.find((item) => item.id === id);
    if (!file) return;
    const copy = structuredClone(file);
    copy.id = uid();
    copy.name = `${file.name} copy`;
    copy.updatedAt = Date.now();
    const files = [copy, ...get().files];
    persist(files);
    set({ files });
  },

  deleteFile: (id) => {
    const files = get().files.filter((file) => file.id !== id);
    persist(files);
    const activeId = get().activeId === id ? (files[0]?.id ?? "") : get().activeId;
    set({ files, activeId, screen: files.length ? get().screen : "home" });
  },

  setTool: (tool) => set({ tool, editingId: tool === "text" ? get().editingId : null }),
  setSelection: (ids) => set({ selection: ids }),
  toggleSnap: () => set({ snap: !get().snap }),
  setPanel: (panel) => set({ panel: get().panel === panel ? null : panel }),
  setShortcuts: (shortcuts) => set({ shortcuts }),

  setEditing: (id) => {
    const current = get().editingId;
    if (current && current !== id) get().commitGesture();
    if (id && id !== current) get().beginGesture();
    set({ editingId: id });
  },

  setView: (zoom, panX, panY) => set({ zoom, panX, panY }),
  setViewport: (viewW, viewH) => set({ viewW, viewH }),

  fit: (mode = "all") => {
    const file = active(get().files, get().activeId);
    const { viewW, viewH } = get();
    if (!file || viewW < 20 || viewH < 20) return;
    const focus = mode === "smart" && viewW < 560 && file.rootIds[0];
    const box = focus ? worldAabb(file, file.rootIds[0]) : fileAabb(file);
    if (!box) {
      set({ zoom: 1, panX: 48, panY: 48 });
      return;
    }
    const bw = Math.max(1, box.maxX - box.minX);
    const bh = Math.max(1, box.maxY - box.minY);
    const pad = viewW < 560 ? 28 : 72;
    const zoom = clamp(Math.min((viewW - pad * 2) / bw, (viewH - pad * 2) / bh), 0.08, 2);
    set({
      zoom,
      panX: (viewW - bw * zoom) / 2 - box.minX * zoom,
      panY: (viewH - bh * zoom) / 2 - box.minY * zoom,
    });
  },

  zoomBy: (factor) => {
    const { zoom, panX, panY, viewW, viewH } = get();
    const next = clamp(zoom * factor, 0.08, 6);
    const cx = viewW / 2;
    const cy = viewH / 2;
    const wx = (cx - panX) / zoom;
    const wy = (cy - panY) / zoom;
    set({ zoom: next, panX: cx - wx * next, panY: cy - wy * next });
  },

  zoom100: () => {
    const { zoom, panX, panY, viewW, viewH } = get();
    const cx = viewW / 2;
    const cy = viewH / 2;
    const wx = (cx - panX) / zoom;
    const wy = (cy - panY) / zoom;
    set({ zoom: 1, panX: cx - wx, panY: cy - wy });
  },

  beginGesture: () => {
    if (get().gesture) return;
    const file = active(get().files, get().activeId);
    if (!file) return;
    set({ gesture: structuredClone(file) });
  },

  live: (mut) => {
    const file = active(get().files, get().activeId);
    if (!file) return;
    const next = mut(file);
    if (next === file) return;
    set({ files: swap(get().files, { ...next, updatedAt: file.updatedAt }) });
  },

  commitGesture: () => {
    const gesture = get().gesture;
    const file = active(get().files, get().activeId);
    if (!gesture || !file) {
      set({ gesture: null });
      return;
    }
    if (same(gesture, file)) {
      set({ gesture: null });
      return;
    }
    const stamped = { ...file, updatedAt: Date.now() };
    const files = swap(get().files, stamped);
    persist(files);
    set({
      gesture: null,
      files,
      past: [...get().past, gesture].slice(-HISTORY),
      future: [],
    });
  },

  cancelGesture: () => {
    const gesture = get().gesture;
    if (!gesture) return;
    const files = swap(get().files, gesture);
    set({
      gesture: null,
      files,
      selection: get().selection.filter((id) => gesture.nodes[id]),
      editingId: null,
    });
  },

  commit: (mut) => {
    if (get().gesture) get().commitGesture();
    const file = active(get().files, get().activeId);
    if (!file) return;
    const next = mut(file);
    if (same(file, next)) return;
    const stamped = { ...next, updatedAt: Date.now() };
    const files = swap(get().files, stamped);
    persist(files);
    set({
      files,
      past: [...get().past, file].slice(-HISTORY),
      future: [],
    });
  },

  undo: () => {
    const file = active(get().files, get().activeId);
    const past = get().past;
    if (!file || !past.length) return;
    const prev = past[past.length - 1];
    const files = swap(get().files, prev);
    persist(files);
    set({
      files,
      past: past.slice(0, -1),
      future: [...get().future, file].slice(-HISTORY),
      selection: get().selection.filter((id) => prev.nodes[id]),
      editingId: null,
      gesture: null,
    });
  },

  redo: () => {
    const file = active(get().files, get().activeId);
    const future = get().future;
    if (!file || !future.length) return;
    const next = future[future.length - 1];
    const files = swap(get().files, next);
    persist(files);
    set({
      files,
      future: future.slice(0, -1),
      past: [...get().past, file].slice(-HISTORY),
      selection: get().selection.filter((id) => next.nodes[id]),
      editingId: null,
    });
  },

  removeSelection: () => {
    const ids = get().selection;
    if (!ids.length) return;
    get().commit((file) => deleteNodes(file, ids));
    set({ selection: [], editingId: null });
  },

  duplicateSelection: () => {
    const ids = get().selection;
    if (!ids.length) return;
    let created: string[] = [];
    get().commit((file) => {
      const result = duplicateInPlace(file, ids);
      created = result.ids;
      return result.file;
    });
    if (created.length) set({ selection: created });
  },

  groupSelection: () => {
    let created: string | null = null;
    get().commit((file) => {
      const result = groupNodes(file, get().selection);
      created = result.id;
      return result.file;
    });
    if (created) set({ selection: [created] });
  },

  ungroupSelection: () => {
    let created: string[] = [];
    get().commit((file) => {
      const result = ungroupNodes(file, get().selection);
      created = result.ids;
      return result.file;
    });
    if (created.length) set({ selection: created });
  },

  alignSelection: (mode) => get().commit((file) => alignNodes(file, get().selection, mode)),
  distributeSelection: (axis) => get().commit((file) => distributeNodes(file, get().selection, axis)),
  reorderSelection: (dir) => {
    const id = get().selection[get().selection.length - 1];
    if (!id) return;
    get().commit((file) => reorder(file, id, dir));
  },
  nudgeSelection: (dx, dy) => get().commit((file) => nudge(file, get().selection, dx, dy)),

  copy: () => {
    const file = active(get().files, get().activeId);
    if (!file) return;
    const clip = copySelection(file, get().selection);
    if (clip) set({ clipboard: clip });
  },

  cut: () => {
    get().copy();
    get().removeSelection();
  },

  paste: () => {
    const clip = get().clipboard;
    const file = active(get().files, get().activeId);
    if (!clip || !file) return;
    const parents = new Map<string, string | null>();
    const walk = (id: string, parent: string | null) => {
      parents.set(id, parent);
      file.nodes[id]?.children.forEach((child) => walk(child, id));
    };
    file.rootIds.forEach((id) => walk(id, null));
    const selected = get().selection.filter((id) => file.nodes[id]);
    const parent = selected.length ? (parents.get(selected[0]) ?? null) : null;
    const sameParent = selected.every((id) => (parents.get(id) ?? null) === parent);
    let created: string[] = [];
    get().commit((current) => {
      const result = pasteClipboard(current, clip, sameParent ? parent : null, 24);
      created = result.ids;
      return result.file;
    });
    if (created.length) set({ selection: created });
  },

  selectAll: () => {
    const file = active(get().files, get().activeId);
    if (!file) return;
    set({ selection: [...file.rootIds] });
  },
}));

export function useActiveFile() {
  return useStore((s) => s.files.find((file) => file.id === s.activeId) ?? null);
}
