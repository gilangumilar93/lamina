import type { Box, DesignFile, DesignNode, HandleId, Vec } from "@/design/types";

export type Mat = { a: number; b: number; c: number; d: number; e: number; f: number };

const IDENT: Mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function parentIndex(file: DesignFile): Map<string, string | null> {
  const map = new Map<string, string | null>();
  const walk = (id: string, parent: string | null) => {
    map.set(id, parent);
    const node = file.nodes[id];
    if (!node) return;
    for (const child of node.children) walk(child, id);
  };
  for (const id of file.rootIds) walk(id, null);
  return map;
}

export function ang(deg: number) {
  const r = (deg * Math.PI) / 180;
  return { cos: Math.cos(r), sin: Math.sin(r) };
}

export function rotateVec(v: Vec, deg: number): Vec {
  const { cos, sin } = ang(deg);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

export function nodeMat(n: Pick<DesignNode, "x" | "y" | "rotation">): Mat {
  const { cos, sin } = ang(n.rotation);
  return { a: cos, b: sin, c: -sin, d: cos, e: n.x, f: n.y };
}

export function mul(m1: Mat, m2: Mat): Mat {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  };
}

export function apply(m: Mat, x: number, y: number): Vec {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

export function invert(m: Mat): Mat {
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-8) return IDENT;
  const a = m.d / det;
  const b = -m.b / det;
  const c = -m.c / det;
  const d = m.a / det;
  return { a, b, c, d, e: -(a * m.e + c * m.f), f: -(b * m.e + d * m.f) };
}

export function matCss(m: Mat) {
  return `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, ${m.e}, ${m.f})`;
}

export function worldMat(file: DesignFile, id: string, parents = parentIndex(file)): Mat {
  const chain: DesignNode[] = [];
  let cur: string | null = id;
  while (cur) {
    const node = file.nodes[cur];
    if (!node) break;
    chain.push(node);
    cur = parents.get(cur) ?? null;
  }
  let m = IDENT;
  for (const node of chain.reverse()) m = mul(m, nodeMat(node));
  return m;
}

export function worldToLocal(file: DesignFile, id: string, wx: number, wy: number, parents?: Map<string, string | null>): Vec {
  return apply(invert(worldMat(file, id, parents)), wx, wy);
}

export function worldRotation(file: DesignFile, id: string, parents = parentIndex(file)): number {
  let r = 0;
  let cur: string | null = id;
  while (cur) {
    r += file.nodes[cur]?.rotation ?? 0;
    cur = parents.get(cur) ?? null;
  }
  return r;
}

export function worldAabb(file: DesignFile, id: string, parents?: Map<string, string | null>): Box {
  const node = file.nodes[id];
  const m = worldMat(file, id, parents);
  return boxOf([
    apply(m, 0, 0),
    apply(m, node.w, 0),
    apply(m, node.w, node.h),
    apply(m, 0, node.h),
  ]);
}

export function parentAabb(node: DesignNode): Box {
  const m = nodeMat(node);
  return boxOf([
    apply(m, 0, 0),
    apply(m, node.w, 0),
    apply(m, node.w, node.h),
    apply(m, 0, node.h),
  ]);
}

export function boxOf(pts: Vec[]): Box {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

export function unionBox(a: Box, b: Box): Box {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function fileAabb(file: DesignFile): Box | null {
  const parents = parentIndex(file);
  let box: Box | null = null;
  for (const id of file.rootIds) {
    if (!file.nodes[id]?.visible) continue;
    const next = worldAabb(file, id, parents);
    box = box ? unionBox(box, next) : next;
  }
  return box;
}

export function intersects(a: Box, b: Box) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function distToSeg(p: Vec, a: Vec, b: Vec) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function pointInNode(file: DesignFile, id: string, wx: number, wy: number, zoom: number, parents?: Map<string, string | null>) {
  const node = file.nodes[id];
  if (!node) return false;
  const p = worldToLocal(file, id, wx, wy, parents);
  if (node.type === "ellipse") {
    if (node.w <= 0 || node.h <= 0) return false;
    const nx = (p.x - node.w / 2) / (node.w / 2);
    const ny = (p.y - node.h / 2) / (node.h / 2);
    return nx * nx + ny * ny <= 1;
  }
  if (node.type === "line") {
    const a = node.lineFrom === "tr" ? { x: node.w, y: 0 } : { x: 0, y: 0 };
    const b = node.lineFrom === "tr" ? { x: 0, y: node.h } : { x: node.w, y: node.h };
    const tol = Math.max(node.strokeWidth, 8 / zoom);
    return distToSeg(p, a, b) <= tol;
  }
  return p.x >= 0 && p.y >= 0 && p.x <= node.w && p.y <= node.h;
}

export function hitDeep(file: DesignFile, wx: number, wy: number, zoom: number): string | null {
  const parents = parentIndex(file);
  const walk = (ids: string[]): string | null => {
    for (let i = ids.length - 1; i >= 0; i--) {
      const node = file.nodes[ids[i]];
      if (!node?.visible) continue;
      const child = walk(node.children);
      if (child) return child;
      if (node.locked || node.type === "group") continue;
      if (pointInNode(file, node.id, wx, wy, zoom, parents)) return node.id;
    }
    return null;
  };
  return walk(file.rootIds);
}

export function deepestContainer(file: DesignFile, wx: number, wy: number, zoom: number): string | null {
  const parents = parentIndex(file);
  const walk = (ids: string[]): string | null => {
    for (let i = ids.length - 1; i >= 0; i--) {
      const node = file.nodes[ids[i]];
      if (!node?.visible) continue;
      const deeper = walk(node.children);
      if (deeper) return deeper;
      if ((node.type === "frame" || node.type === "group") && pointInNode(file, node.id, wx, wy, zoom, parents)) {
        return node.id;
      }
    }
    return null;
  };
  return walk(file.rootIds);
}

export function topLevel(file: DesignFile, ids: string[]): string[] {
  const parents = parentIndex(file);
  const set = new Set(ids);
  return ids.filter((id) => {
    if (!file.nodes[id]) return false;
    let parent = parents.get(id) ?? null;
    while (parent) {
      if (set.has(parent)) return false;
      parent = parents.get(parent) ?? null;
    }
    return true;
  });
}

export function selectedAncestor(file: DesignFile, id: string, selection: string[]): string | null {
  const parents = parentIndex(file);
  let parent = parents.get(id) ?? null;
  let found: string | null = null;
  while (parent) {
    if (selection.includes(parent)) found = parent;
    parent = parents.get(parent) ?? null;
  }
  return found;
}

const HANDLE_ANGLE: Record<HandleId, number> = {
  n: 0,
  ne: 45,
  e: 90,
  se: 135,
  s: 180,
  sw: 225,
  w: 270,
  nw: 315,
};

export function resizeCursor(handle: HandleId, rotation: number) {
  const a = (HANDLE_ANGLE[handle] + rotation + 360) % 180;
  const idx = Math.round(a / 45) % 4;
  return ["ns-resize", "nesw-resize", "ew-resize", "nwse-resize"][idx];
}

export function resizeNode(node: DesignNode, handle: HandleId, dx: number, dy: number, shift: boolean) {
  const east = handle === "ne" || handle === "e" || handle === "se";
  const west = handle === "nw" || handle === "w" || handle === "sw";
  const north = handle === "nw" || handle === "n" || handle === "ne";
  const south = handle === "sw" || handle === "s" || handle === "se";
  const { cos, sin } = ang(node.rotation);
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  let newW = node.w;
  let newH = node.h;
  if (east) newW = node.w + lx;
  if (west) newW = node.w - lx;
  if (south) newH = node.h + ly;
  if (north) newH = node.h - ly;
  const corner = (east || west) && (north || south);
  if (shift && corner && node.h !== 0) {
    const ratio = node.w / node.h;
    if (Math.abs(newW - node.w) >= Math.abs((newH - node.h) * ratio)) newH = newW / (ratio || 1);
    else newW = newH * ratio;
  }
  const min = node.type === "line" ? 1 : 8;
  newW = Math.max(min, newW);
  newH = Math.max(min, newH);
  const oldAX = west ? node.w : 0;
  const oldAY = north ? node.h : 0;
  const newAX = west ? newW : 0;
  const newAY = north ? newH : 0;
  const fx = node.x + oldAX * cos - oldAY * sin;
  const fy = node.y + oldAX * sin + oldAY * cos;
  return {
    x: fx - newAX * cos + newAY * sin,
    y: fy - newAX * sin - newAY * cos,
    w: newW,
    h: newH,
  };
}

export function rectFromDrag(x0: number, y0: number, x1: number, y1: number, shift: boolean) {
  let dx = x1 - x0;
  let dy = y1 - y0;
  if (shift) {
    const s = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * s;
    dy = Math.sign(dy || 1) * s;
  }
  return {
    x: dx < 0 ? x0 + dx : x0,
    y: dy < 0 ? y0 + dy : y0,
    w: Math.abs(dx),
    h: Math.abs(dy),
  };
}

export function lineFromDrag(x0: number, y0: number, x1: number, y1: number, shift: boolean) {
  let x = x1;
  let y = y1;
  if (shift) {
    const angle = Math.atan2(y1 - y0, x1 - x0);
    const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const len = Math.hypot(x1 - x0, y1 - y0);
    x = x0 + Math.cos(snapped) * len;
    y = y0 + Math.sin(snapped) * len;
  }
  const left = Math.min(x0, x);
  const top = Math.min(y0, y);
  return {
    x: left,
    y: top,
    w: Math.max(1, Math.abs(x - x0)),
    h: Math.max(1, Math.abs(y - y0)),
    lineFrom: (x - x0) * (y - y0) >= 0 ? ("tl" as const) : ("tr" as const),
  };
}

export function marqueeHits(file: DesignFile, box: Box): string[] {
  const parents = parentIndex(file);
  const acc: string[] = [];
  const walk = (ids: string[]) => {
    for (const id of ids) {
      const node = file.nodes[id];
      if (!node?.visible || node.locked) continue;
      if (intersects(worldAabb(file, id, parents), box)) acc.push(id);
      else walk(node.children);
    }
  };
  walk(file.rootIds);
  return acc;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
