import {
  parentAabb,
  parentIndex,
  rotateVec,
  topLevel,
  unionBox,
  worldAabb,
  worldRotation,
  apply,
  nodeMat,
} from "@/design/geometry";
import type { DesignFile, DesignNode, NodeType } from "@/design/types";

let seq = 1;

export function uid() {
  seq += 1;
  return `n${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const LABELS: Record<NodeType, string> = {
  frame: "Frame",
  rect: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  text: "Text",
  group: "Group",
};

export function createNode(type: NodeType, partial: Partial<DesignNode> = {}): DesignNode {
  const base: DesignNode = {
    id: partial.id ?? uid(),
    type,
    name: partial.name ?? LABELS[type],
    x: 0,
    y: 0,
    w: type === "text" ? 180 : type === "line" ? 120 : 140,
    h: type === "text" ? 48 : type === "line" ? 2 : type === "frame" ? 480 : 88,
    rotation: 0,
    opacity: 100,
    fill: type === "line" || type === "text" || type === "group" ? null : type === "frame" ? "#f4f1eb" : "#6d8fbf",
    stroke: type === "line" ? "#1c1c1f" : type === "frame" ? "#e3dfd8" : null,
    strokeWidth: type === "line" ? 2 : 1,
    radius: 0,
    visible: true,
    locked: false,
    text: type === "text" ? "Text" : "",
    fontSize: type === "text" ? 16 : 16,
    fontWeight: 500,
    align: "left",
    lineFrom: "tl",
    children: [],
  };
  return { ...base, ...partial, id: partial.id ?? base.id, type, children: partial.children ?? base.children };
}

export function nextName(file: DesignFile, type: NodeType) {
  const label = LABELS[type];
  const used = new Set(Object.values(file.nodes).map((n) => n.name));
  let i = 1;
  while (used.has(`${label} ${i}`)) i += 1;
  return `${label} ${i}`;
}

export function patchNode(file: DesignFile, id: string, patch: Partial<DesignNode>): DesignFile {
  const node = file.nodes[id];
  if (!node) return file;
  return { ...file, nodes: { ...file.nodes, [id]: { ...node, ...patch } } };
}

export function patchMany(file: DesignFile, ids: string[], patch: Partial<DesignNode>): DesignFile {
  const nodes = { ...file.nodes };
  for (const id of ids) {
    const node = nodes[id];
    if (node) nodes[id] = { ...node, ...patch };
  }
  return { ...file, nodes };
}

export function insertNode(file: DesignFile, node: DesignNode, parentId: string | null): DesignFile {
  const nodes = { ...file.nodes, [node.id]: node };
  if (parentId && nodes[parentId]) {
    const parent = nodes[parentId];
    nodes[parentId] = { ...parent, children: [...parent.children, node.id] };
    return { ...file, nodes };
  }
  return { ...file, nodes, rootIds: [...file.rootIds, node.id] };
}

export function deleteNodes(file: DesignFile, ids: string[]): DesignFile {
  const drop = new Set<string>();
  const mark = (id: string) => {
    if (drop.has(id)) return;
    drop.add(id);
    for (const child of file.nodes[id]?.children ?? []) mark(child);
  };
  ids.forEach(mark);
  const nodes: Record<string, DesignNode> = {};
  for (const [id, node] of Object.entries(file.nodes)) {
    if (drop.has(id)) continue;
    nodes[id] = node.children.some((c) => drop.has(c))
      ? { ...node, children: node.children.filter((c) => !drop.has(c)) }
      : node;
  }
  return { ...file, nodes, rootIds: file.rootIds.filter((id) => !drop.has(id)) };
}

export function nudge(file: DesignFile, ids: string[], dx: number, dy: number): DesignFile {
  const nodes = { ...file.nodes };
  for (const id of topLevel(file, ids)) {
    const node = nodes[id];
    if (!node || node.locked) continue;
    nodes[id] = { ...node, x: node.x + dx, y: node.y + dy };
  }
  return { ...file, nodes };
}

export function dragMove(
  file: DesignFile,
  origins: Record<string, { x: number; y: number }>,
  dxWorld: number,
  dyWorld: number,
  snap: boolean,
): DesignFile {
  const parents = parentIndex(file);
  const nodes = { ...file.nodes };
  for (const id of Object.keys(origins)) {
    const node = nodes[id];
    if (!node || node.locked) continue;
    const parent = parents.get(id) ?? null;
    const rot = parent ? worldRotation(file, parent, parents) : 0;
    const d = rotateVec({ x: dxWorld, y: dyWorld }, -rot);
    let x = origins[id].x + d.x;
    let y = origins[id].y + d.y;
    if (snap) {
      x = Math.round(x / 8) * 8;
      y = Math.round(y / 8) * 8;
    }
    nodes[id] = { ...node, x, y };
  }
  return { ...file, nodes };
}

export type Clipboard = { nodes: Record<string, DesignNode>; roots: string[] };

export function copySelection(file: DesignFile, ids: string[]): Clipboard | null {
  const roots = topLevel(file, ids);
  if (!roots.length) return null;
  const nodes: Record<string, DesignNode> = {};
  const take = (id: string) => {
    const node = file.nodes[id];
    if (!node || nodes[id]) return;
    nodes[id] = { ...node, children: [...node.children] };
    node.children.forEach(take);
  };
  roots.forEach(take);
  return { nodes, roots };
}

export function pasteClipboard(file: DesignFile, clip: Clipboard, parentId: string | null, offset = 24) {
  const idMap = new Map<string, string>();
  for (const id of Object.keys(clip.nodes)) idMap.set(id, uid());
  const nodes = { ...file.nodes };
  for (const [oldId, node] of Object.entries(clip.nodes)) {
    const id = idMap.get(oldId)!;
    const root = clip.roots.includes(oldId);
    nodes[id] = {
      ...node,
      id,
      x: node.x + (root ? offset : 0),
      y: node.y + (root ? offset : 0),
      children: node.children.map((c) => idMap.get(c) ?? c),
    };
  }
  const newIds = clip.roots.map((id) => idMap.get(id)!);
  if (parentId && nodes[parentId]) {
    nodes[parentId] = { ...nodes[parentId], children: [...nodes[parentId].children, ...newIds] };
    return { file: { ...file, nodes }, ids: newIds };
  }
  return { file: { ...file, nodes, rootIds: [...file.rootIds, ...newIds] }, ids: newIds };
}

export function duplicateInPlace(file: DesignFile, ids: string[]) {
  const clip = copySelection(file, ids);
  if (!clip) return { file, ids: [] as string[] };
  const parents = parentIndex(file);
  const parent = parents.get(clip.roots[0]) ?? null;
  const same = clip.roots.every((id) => (parents.get(id) ?? null) === parent);
  return pasteClipboard(file, clip, same ? parent : null, 24);
}

export function reorder(file: DesignFile, id: string, dir: "front" | "back" | "forward" | "backward"): DesignFile {
  const parents = parentIndex(file);
  const parent = parents.get(id) ?? null;
  const list = [...(parent ? file.nodes[parent].children : file.rootIds)];
  const index = list.indexOf(id);
  if (index < 0) return file;
  list.splice(index, 1);
  if (dir === "front") list.push(id);
  else if (dir === "back") list.unshift(id);
  else if (dir === "forward") list.splice(Math.min(list.length, index + 1), 0, id);
  else list.splice(Math.max(0, index - 1), 0, id);
  if (parent) {
    return { ...file, nodes: { ...file.nodes, [parent]: { ...file.nodes[parent], children: list } } };
  }
  return { ...file, rootIds: list };
}

export function alignNodes(
  file: DesignFile,
  ids: string[],
  mode: "left" | "center" | "right" | "top" | "middle" | "bottom",
): DesignFile {
  const use = topLevel(file, ids).filter((id) => file.nodes[id] && !file.nodes[id].locked);
  if (use.length < 2) return file;
  const parents = parentIndex(file);
  const boxes = use.map((id) => ({ id, box: worldAabb(file, id, parents) }));
  const union = boxes.reduce((acc, item) => unionBox(acc, item.box), boxes[0].box);
  const nodes = { ...file.nodes };
  for (const { id, box } of boxes) {
    let dx = 0;
    let dy = 0;
    if (mode === "left") dx = union.minX - box.minX;
    if (mode === "right") dx = union.maxX - box.maxX;
    if (mode === "center") dx = (union.minX + union.maxX) / 2 - (box.minX + box.maxX) / 2;
    if (mode === "top") dy = union.minY - box.minY;
    if (mode === "bottom") dy = union.maxY - box.maxY;
    if (mode === "middle") dy = (union.minY + union.maxY) / 2 - (box.minY + box.maxY) / 2;
    const parent = parents.get(id) ?? null;
    const rot = parent ? worldRotation(file, parent, parents) : 0;
    const d = rotateVec({ x: dx, y: dy }, -rot);
    nodes[id] = { ...nodes[id], x: nodes[id].x + d.x, y: nodes[id].y + d.y };
  }
  return { ...file, nodes };
}

export function distributeNodes(file: DesignFile, ids: string[], axis: "h" | "v"): DesignFile {
  const use = topLevel(file, ids).filter((id) => file.nodes[id] && !file.nodes[id].locked);
  if (use.length < 3) return file;
  const parents = parentIndex(file);
  const items = use
    .map((id) => ({ id, box: worldAabb(file, id, parents) }))
    .sort((a, b) => (axis === "h" ? a.box.minX - b.box.minX : a.box.minY - b.box.minY));
  const span =
    axis === "h"
      ? items[items.length - 1].box.maxX - items[0].box.minX
      : items[items.length - 1].box.maxY - items[0].box.minY;
  const total = items.reduce((sum, item) => sum + (axis === "h" ? item.box.maxX - item.box.minX : item.box.maxY - item.box.minY), 0);
  const gap = (span - total) / (items.length - 1);
  let cursor = axis === "h" ? items[0].box.minX : items[0].box.minY;
  const nodes = { ...file.nodes };
  for (const item of items) {
    const size = axis === "h" ? item.box.maxX - item.box.minX : item.box.maxY - item.box.minY;
    const delta = cursor - (axis === "h" ? item.box.minX : item.box.minY);
    if (Math.abs(delta) > 0.01) {
      const parent = parents.get(item.id) ?? null;
      const rot = parent ? worldRotation(file, parent, parents) : 0;
      const d = rotateVec(axis === "h" ? { x: delta, y: 0 } : { x: 0, y: delta }, -rot);
      nodes[item.id] = { ...nodes[item.id], x: nodes[item.id].x + d.x, y: nodes[item.id].y + d.y };
    }
    cursor += size + gap;
  }
  return { ...file, nodes };
}

export function groupNodes(file: DesignFile, ids: string[]): { file: DesignFile; id: string | null } {
  const use = topLevel(file, ids).filter((id) => file.nodes[id]);
  if (use.length < 2) return { file, id: null };
  const parents = parentIndex(file);
  const parent = parents.get(use[0]) ?? null;
  if (!use.every((id) => (parents.get(id) ?? null) === parent)) return { file, id: null };
  const siblings = parent ? file.nodes[parent].children : file.rootIds;
  const boxes = use.map((id) => parentAabb(file.nodes[id]));
  const union = boxes.reduce((acc, box) => unionBox(acc, box), boxes[0]);
  const group = createNode("group", {
    name: nextName(file, "group"),
    x: union.minX,
    y: union.minY,
    w: Math.max(1, union.maxX - union.minX),
    h: Math.max(1, union.maxY - union.minY),
    fill: null,
    stroke: null,
    children: [...use].sort((a, b) => siblings.indexOf(a) - siblings.indexOf(b)),
  });
  const nodes = { ...file.nodes, [group.id]: group };
  for (const id of use) {
    nodes[id] = { ...nodes[id], x: nodes[id].x - union.minX, y: nodes[id].y - union.minY };
  }
  const indexes = use.map((id) => siblings.indexOf(id));
  const front = Math.max(...indexes);
  const removedBefore = indexes.filter((i) => i < front).length;
  const list = siblings.filter((id) => !use.includes(id));
  list.splice(front - removedBefore, 0, group.id);
  if (parent) nodes[parent] = { ...nodes[parent], children: list };
  return { file: { ...file, nodes, rootIds: parent ? file.rootIds : list }, id: group.id };
}

export function ungroupNodes(file: DesignFile, ids: string[]): { file: DesignFile; ids: string[] } {
  let next = file;
  const released: string[] = [];
  for (const id of ids) {
    const node = next.nodes[id];
    if (!node || node.type !== "group") continue;
    const parents = parentIndex(next);
    const parent = parents.get(id) ?? null;
    const siblings = [...(parent ? next.nodes[parent].children : next.rootIds)];
    const index = siblings.indexOf(id);
    const childIds = [...node.children];
    const nodes = { ...next.nodes };
    for (const childId of childIds) {
      const child = nodes[childId];
      const pos = apply(nodeMat(node), child.x, child.y);
      nodes[childId] = { ...child, x: pos.x, y: pos.y, rotation: child.rotation + node.rotation };
    }
    delete nodes[id];
    siblings.splice(index, 1, ...childIds);
    if (parent) nodes[parent] = { ...nodes[parent], children: siblings };
    next = { ...next, nodes, rootIds: parent ? next.rootIds : siblings };
    released.push(...childIds);
  }
  return { file: next, ids: released };
}
