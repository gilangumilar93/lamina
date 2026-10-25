import { NodeView } from "@/components/editor/NodeView";
import {
  apply,
  clamp,
  deepestContainer,
  hitDeep,
  lineFromDrag,
  marqueeHits,
  matCss,
  parentIndex,
  rectFromDrag,
  resizeCursor,
  resizeNode,
  selectedAncestor,
  topLevel,
  worldMat,
  worldToLocal,
} from "@/design/geometry";
import { keys, uiBridge, viewportEl } from "@/design/keys";
import { copySelection, createNode, dragMove, insertNode, nextName, pasteClipboard, patchNode } from "@/design/ops";
import { useActiveFile, useStore } from "@/design/store";
import type { DesignFile, DesignNode, HandleId, Tool } from "@/design/types";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useShallow } from "zustand/react/shallow";

type Vec = { x: number; y: number };

type Drag =
  | { kind: "pan"; pid: number; sx: number; sy: number; panX: number; panY: number }
  | {
      kind: "move";
      pid: number;
      sx: number;
      sy: number;
      origins: Record<string, Vec>;
      moved: boolean;
      reselect: string | null;
      duplicated: boolean;
    }
  | {
      kind: "resize";
      pid: number;
      nodeId: string;
      handle: HandleId;
      origin: DesignNode;
      parentId: string | null;
      start: Vec;
    }
  | {
      kind: "rotate";
      pid: number;
      nodeId: string;
      cx: number;
      cy: number;
      startAngle: number;
      originRot: number;
      origin: DesignNode;
    }
  | { kind: "marquee"; pid: number; x0: number; y0: number; x1: number; y1: number; base: string[] }
  | { kind: "draw"; pid: number; nodeId: string; parentId: string | null; x0: number; y0: number; tool: Tool }
  | { kind: "pinch"; dist: number; zoom: number; wx: number; wy: number };

const HANDLES: HandleId[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const session: { drag: Drag | null } = { drag: null };

export function cancelInteraction() {
  session.drag = null;
  uiBridge.clearChrome();
  useStore.getState().cancelGesture();
}

function currentFile() {
  const { files, activeId } = useStore.getState();
  return files.find((file) => file.id === activeId) ?? null;
}

function clientToWorld(clientX: number, clientY: number): Vec {
  const el = viewportEl.current;
  const { panX, panY, zoom } = useStore.getState();
  if (!el) return { x: 0, y: 0 };
  const rect = el.getBoundingClientRect();
  return { x: (clientX - rect.left - panX) / zoom, y: (clientY - rect.top - panY) / zoom };
}

function parentPoint(file: DesignFile, parentId: string | null, world: Vec): Vec {
  if (!parentId) return world;
  return worldToLocal(file, parentId, world.x, world.y);
}

export function Canvas() {
  const file = useActiveFile();
  const zoom = useStore((s) => s.zoom);
  const panX = useStore((s) => s.panX);
  const panY = useStore((s) => s.panY);
  const tool = useStore((s) => s.tool);
  const activeId = useStore((s) => s.activeId);
  const pointers = useRef(new Map<number, Vec>());
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);

  useEffect(() => {
    uiBridge.clearChrome = () => {
      setMarquee(null);
      setPanning(false);
    };
  }, []);

  useEffect(() => {
    const el = viewportEl.current;
    if (!el) return;
    let fitted = false;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 20 || h < 20) return;
      const state = useStore.getState();
      state.setViewport(w, h);
      if (!fitted) {
        fitted = true;
        state.fit("smart");
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeId]);

  useEffect(() => {
    const el = viewportEl.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = event.clientX - rect.left;
      const cy = event.clientY - rect.top;
      const state = useStore.getState();
      const dy = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const dx = event.deltaMode === 1 ? event.deltaX * 16 : event.deltaX;
      if (event.shiftKey && !event.ctrlKey && !event.metaKey) {
        state.setView(state.zoom, state.panX - dy, state.panY - dx);
        return;
      }
      const next = clamp(state.zoom * Math.exp(-dy * 0.0016), 0.08, 6);
      const wx = (cx - state.panX) / state.zoom;
      const wy = (cy - state.panY) / state.zoom;
      state.setView(next, cx - wx * next, cy - wy * next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const drag = session.drag;
      if (!drag) {
        if (useStore.getState().tool === "select" && pointers.current.size < 2) {
          const doc = currentFile();
          if (!doc) return;
          const world = clientToWorld(event.clientX, event.clientY);
          const id = hitDeep(doc, world.x, world.y, useStore.getState().zoom);
          setHover((prev) => (prev === id ? prev : id));
        }
        return;
      }
      if (drag.kind === "pinch") {
        if (pointers.current.size < 2) return;
        const [a, b] = [...pointers.current.values()];
        const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const rect = viewportEl.current?.getBoundingClientRect();
        if (!rect) return;
        const next = clamp(drag.zoom * (dist / drag.dist), 0.08, 6);
        const local = { x: mid.x - rect.left, y: mid.y - rect.top };
        useStore.getState().setView(next, local.x - drag.wx * next, local.y - drag.wy * next);
        return;
      }
      if (event.pointerId !== drag.pid) return;
      const world = clientToWorld(event.clientX, event.clientY);
      const state = useStore.getState();

      if (drag.kind === "pan") {
        state.setView(state.zoom, drag.panX + (event.clientX - drag.sx), drag.panY + (event.clientY - drag.sy));
        return;
      }
      if (drag.kind === "marquee") {
        drag.x1 = world.x;
        drag.y1 = world.y;
        setMarquee({
          x: Math.min(drag.x0, world.x),
          y: Math.min(drag.y0, world.y),
          w: Math.abs(world.x - drag.x0),
          h: Math.abs(world.y - drag.y0),
        });
        return;
      }
      if (drag.kind === "draw") {
        const doc = currentFile();
        if (!doc) return;
        const p = parentPoint(doc, drag.parentId, world);
        if (drag.tool === "line") state.live((current) => patchNode(current, drag.nodeId, lineFromDrag(drag.x0, drag.y0, p.x, p.y, event.shiftKey)));
        else {
          const geom = rectFromDrag(drag.x0, drag.y0, p.x, p.y, event.shiftKey);
          state.live((current) => patchNode(current, drag.nodeId, { ...geom, w: Math.max(1, geom.w), h: Math.max(1, geom.h) }));
        }
        return;
      }
      if (drag.kind === "resize") {
        const doc = currentFile();
        if (!doc) return;
        const p = parentPoint(doc, drag.parentId, world);
        const geom = resizeNode(drag.origin, drag.handle, p.x - drag.start.x, p.y - drag.start.y, event.shiftKey);
        state.live((current) => patchNode(current, drag.nodeId, geom));
        return;
      }
      if (drag.kind === "rotate") {
        const angle = Math.atan2(world.y - drag.cy, world.x - drag.cx);
        let rotation = drag.originRot + ((angle - drag.startAngle) * 180) / Math.PI;
        if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
        const { w, h, x: ox, y: oy } = drag.origin;
        const oc = Math.cos((drag.originRot * Math.PI) / 180);
        const os = Math.sin((drag.originRot * Math.PI) / 180);
        const centerX = ox + (w / 2) * oc - (h / 2) * os;
        const centerY = oy + (w / 2) * os + (h / 2) * oc;
        const cos = Math.cos((rotation * Math.PI) / 180);
        const sin = Math.sin((rotation * Math.PI) / 180);
        state.live((current) =>
          patchNode(current, drag.nodeId, {
            rotation,
            x: centerX - ((w / 2) * cos - (h / 2) * sin),
            y: centerY - ((w / 2) * sin + (h / 2) * cos),
          }),
        );
        return;
      }

      const start = clientToWorld(drag.sx, drag.sy);
      let dx = world.x - start.x;
      let dy = world.y - start.y;
      if (!drag.moved && Math.hypot(dx, dy) * state.zoom < 3) return;
      if (!drag.moved) {
        state.beginGesture();
        drag.moved = true;
        if (event.altKey) {
          const doc = currentFile();
          const ids = Object.keys(drag.origins);
          const clip = doc ? copySelection(doc, ids) : null;
          if (doc && clip) {
            const parent = parentIndex(doc).get(ids[0]) ?? null;
            let created: string[] = [];
            state.live((current) => {
              const result = pasteClipboard(current, clip, parent, 0);
              created = result.ids;
              return result.file;
            });
            const next = currentFile();
            const origins: Record<string, Vec> = {};
            for (const id of created) {
              const node = next?.nodes[id];
              if (node) origins[id] = { x: node.x, y: node.y };
            }
            drag.origins = origins;
            drag.duplicated = true;
            state.setSelection(created);
          }
        }
      }
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      state.live((current) => dragMove(current, drag.origins, dx, dy, state.snap && !event.altKey && !event.shiftKey));
    };

    const up = (event: PointerEvent) => {
      pointers.current.delete(event.pointerId);
      const drag = session.drag;
      if (!drag) {
        setMarquee(null);
        setPanning(false);
        return;
      }
      if (drag.kind === "pinch") {
        if (pointers.current.size < 2) session.drag = null;
        return;
      }
      if (event.pointerId !== drag.pid) return;
      const state = useStore.getState();
      if (drag.kind === "marquee") {
        const doc = currentFile();
        const zoomNow = state.zoom;
        if (doc && (Math.abs(drag.x1 - drag.x0) > 3 / zoomNow || Math.abs(drag.y1 - drag.y0) > 3 / zoomNow)) {
          const hits = marqueeHits(doc, {
            minX: Math.min(drag.x0, drag.x1),
            minY: Math.min(drag.y0, drag.y1),
            maxX: Math.max(drag.x0, drag.x1),
            maxY: Math.max(drag.y0, drag.y1),
          });
          state.setSelection(drag.base.length ? [...new Set([...drag.base, ...hits])] : hits);
        }
        setMarquee(null);
      } else if (drag.kind === "draw") {
        const node = currentFile()?.nodes[drag.nodeId];
        if (node && node.w < 4 && node.h < 4) {
          const def =
            drag.tool === "text"
              ? { w: 180, h: 48 }
              : drag.tool === "line"
                ? { w: 140, h: 2 }
                : drag.tool === "frame"
                  ? { w: 320, h: 200 }
                  : { w: 140, h: 88 };
          state.live((current) => patchNode(current, drag.nodeId, { x: drag.x0 - def.w / 2, y: drag.y0 - def.h / 2, ...def }));
        }
        state.commitGesture();
        state.setSelection([drag.nodeId]);
        if (drag.tool === "text") state.setEditing(drag.nodeId);
      } else if (drag.kind === "move") {
        if (drag.moved) state.commitGesture();
        else if (drag.reselect) state.setSelection([drag.reselect]);
      } else if (drag.kind === "resize" || drag.kind === "rotate") {
        state.commitGesture();
      }
      session.drag = null;
      setPanning(false);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button === 2) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const state = useStore.getState();
    if (pointers.current.size >= 2) {
      if (session.drag && session.drag.kind !== "pinch") state.cancelGesture();
      const [a, b] = [...pointers.current.values()];
      const rect = viewportEl.current?.getBoundingClientRect();
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const local = rect ? { x: mid.x - rect.left, y: mid.y - rect.top } : mid;
      session.drag = {
        kind: "pinch",
        dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        zoom: state.zoom,
        wx: (local.x - state.panX) / state.zoom,
        wy: (local.y - state.panY) / state.zoom,
      };
      setMarquee(null);
      return;
    }
    if (state.editingId) state.setEditing(null);
    const world = clientToWorld(event.clientX, event.clientY);
    if (event.button === 1 || state.tool === "hand" || keys.space) {
      session.drag = { kind: "pan", pid: event.pointerId, sx: event.clientX, sy: event.clientY, panX: state.panX, panY: state.panY };
      setPanning(true);
      return;
    }
    const doc = currentFile();
    if (!doc) return;

    if (state.tool !== "select") {
      const drawTool = state.tool as Exclude<Tool, "select" | "hand">;
      const parentId = deepestContainer(doc, world.x, world.y, state.zoom);
      const origin = parentPoint(doc, parentId, world);
      const node = createNode(drawTool, { name: nextName(doc, drawTool), x: origin.x, y: origin.y, w: 1, h: 1 });
      state.beginGesture();
      state.live((current) => insertNode(current, node, parentId));
      state.setSelection([node.id]);
      session.drag = { kind: "draw", pid: event.pointerId, nodeId: node.id, parentId, x0: origin.x, y0: origin.y, tool: state.tool };
      return;
    }

    const deep = hitDeep(doc, world.x, world.y, state.zoom);
    if (!deep) {
      session.drag = {
        kind: "marquee",
        pid: event.pointerId,
        x0: world.x,
        y0: world.y,
        x1: world.x,
        y1: world.y,
        base: event.shiftKey ? state.selection : [],
      };
      if (!event.shiftKey) state.setSelection([]);
      return;
    }
    if (event.detail >= 2 && doc.nodes[deep]?.type === "text") {
      state.setSelection([deep]);
      state.setEditing(deep);
      return;
    }
    const ancestor = selectedAncestor(doc, deep, state.selection);
    let ids: string[];
    let reselect: string | null = null;
    if (event.shiftKey) {
      const next = state.selection.includes(deep) ? state.selection.filter((id) => id !== deep) : [...state.selection, deep];
      state.setSelection(next);
      ids = topLevel(doc, next);
    } else if (ancestor) {
      ids = topLevel(doc, state.selection);
      reselect = deep;
    } else if (state.selection.includes(deep)) {
      ids = topLevel(doc, state.selection);
    } else {
      state.setSelection([deep]);
      ids = [deep];
    }
    ids = ids.filter((id) => doc.nodes[id] && !doc.nodes[id].locked);
    if (!ids.length) return;
    const origins: Record<string, Vec> = {};
    for (const id of ids) origins[id] = { x: doc.nodes[id].x, y: doc.nodes[id].y };
    session.drag = { kind: "move", pid: event.pointerId, sx: event.clientX, sy: event.clientY, origins, moved: false, reselect, duplicated: false };
  };

  return (
    <div
      ref={(node) => {
        viewportEl.current = node;
        if (node && node.clientWidth > 20) useStore.getState().setViewport(node.clientWidth, node.clientHeight);
      }}
      data-canvas="true"
      data-tool={tool}
      data-panning={panning ? "1" : "0"}
      className="canvas-viewport relative min-w-0 flex-1 overflow-hidden bg-canvas touch-none"
      onPointerDown={onPointerDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }}>
        <div className="board-grid" />
        {file?.rootIds.map((id) => (
          <NodeView key={id} id={id} />
        ))}
        <Overlay hover={hover} zoom={zoom} />
        {marquee && (
          <div
            className="pointer-events-none absolute border border-select bg-select/20"
            style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
          />
        )}
      </div>
      {file && file.rootIds.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="max-w-xs text-sm text-ink">Pick a tool and drag. Frames, type, and shapes stay in this browser.</p>
        </div>
      )}
    </div>
  );
}

function Overlay({ hover, zoom }: { hover: string | null; zoom: number }) {
  const file = useActiveFile();
  const tool = useStore((s) => s.tool);
  const selected = useStore(
    useShallow((s) => {
      const doc = s.files.find((item) => item.id === s.activeId);
      if (!doc) return [] as DesignNode[];
      return s.selection.map((id) => doc.nodes[id]).filter((node): node is DesignNode => !!node);
    }),
  );
  const primary = selected.length === 1 ? selected[0] : null;
  if (!file) return null;
  const frames = Object.values(file.nodes).filter((node) => node.type === "frame" && node.visible);
  const hoverNode = hover && !selected.some((node) => node.id === hover) ? file.nodes[hover] : null;

  const startResize = (event: ReactPointerEvent, node: DesignNode, handle: HandleId) => {
    event.stopPropagation();
    event.preventDefault();
    const doc = currentFile();
    if (!doc) return;
    const parentId = parentIndex(doc).get(node.id) ?? null;
    const world = clientToWorld(event.clientX, event.clientY);
    useStore.getState().beginGesture();
    session.drag = {
      kind: "resize",
      pid: event.pointerId,
      nodeId: node.id,
      handle,
      origin: structuredClone(node),
      parentId,
      start: parentPoint(doc, parentId, world),
    };
  };

  const startRotate = (event: ReactPointerEvent, node: DesignNode) => {
    event.stopPropagation();
    event.preventDefault();
    const doc = currentFile();
    if (!doc) return;
    const world = clientToWorld(event.clientX, event.clientY);
    const center = apply(worldMat(doc, node.id), node.w / 2, node.h / 2);
    useStore.getState().beginGesture();
    session.drag = {
      kind: "rotate",
      pid: event.pointerId,
      nodeId: node.id,
      cx: center.x,
      cy: center.y,
      startAngle: Math.atan2(world.y - center.y, world.x - center.x),
      originRot: node.rotation,
      origin: structuredClone(node),
    };
  };

  return (
    <>
      {frames.map((node) => (
        <div
          key={`label-${node.id}`}
          className="pointer-events-none absolute"
          style={{ left: 0, top: 0, transform: matCss(worldMat(file, node.id)), transformOrigin: "0 0" }}
        >
          <div className="absolute font-medium whitespace-nowrap text-ink" style={{ left: 0, top: -16 / zoom, fontSize: 11 / zoom, lineHeight: 1.2 }}>
            {node.name}
          </div>
        </div>
      ))}
      {hoverNode && <Outline node={hoverNode} file={file} zoom={zoom} faint />}
      {selected.map((node) => (
        <Outline key={node.id} node={node} file={file} zoom={zoom} />
      ))}
      {tool === "select" && primary && !primary.locked && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: 0,
            top: 0,
            width: primary.w,
            height: primary.h,
            transform: matCss(worldMat(file, primary.id)),
            transformOrigin: "0 0",
          }}
        >
          {HANDLES.map((handle) => {
            const point = handlePoint(handle, primary.w, primary.h);
            const hit = 28 / zoom;
            return (
              <button
                key={handle}
                type="button"
                aria-label={`Resize ${handle}`}
                className="pointer-events-auto absolute rounded-full border-select bg-fg"
                style={{
                  left: point.x - hit / 2,
                  top: point.y - hit / 2,
                  width: hit,
                  height: hit,
                  borderWidth: 1.5 / zoom,
                  cursor: resizeCursor(handle, primary.rotation),
                }}
                onPointerDown={(event) => startResize(event, primary, handle)}
              />
            );
          })}
          <div className="absolute bg-select" style={{ left: primary.w / 2, top: -28 / zoom, width: 1 / zoom, height: 28 / zoom }} />
          <button
            type="button"
            aria-label="Rotate"
            className="pointer-events-auto absolute rounded-full border-select bg-fg"
            style={{
              left: primary.w / 2 - 12 / zoom,
              top: -40 / zoom,
              width: 24 / zoom,
              height: 24 / zoom,
              borderWidth: 1.5 / zoom,
              cursor: "grab",
            }}
            onPointerDown={(event) => startRotate(event, primary)}
          />
        </div>
      )}
    </>
  );
}

function Outline({ node, file, zoom, faint }: { node: DesignNode; file: DesignFile; zoom: number; faint?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: 0,
        top: 0,
        width: Math.max(node.w, 1),
        height: Math.max(node.h, 1),
        transform: matCss(worldMat(file, node.id)),
        transformOrigin: "0 0",
        outline: `${(faint ? 1 : 1.5) / zoom}px solid var(--color-select)`,
        opacity: faint ? 0.5 : 1,
        borderRadius: node.type === "ellipse" ? "50%" : node.radius,
      }}
    />
  );
}

function handlePoint(handle: HandleId, w: number, h: number) {
  const x = handle === "ne" || handle === "e" || handle === "se" ? w : handle === "nw" || handle === "w" || handle === "sw" ? 0 : w / 2;
  const y = handle === "sw" || handle === "s" || handle === "se" ? h : handle === "nw" || handle === "n" || handle === "ne" ? 0 : h / 2;
  return { x, y };
}
