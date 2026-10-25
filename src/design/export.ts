import { fileAabb, parentIndex, topLevel, unionBox, worldAabb, worldMat } from "@/design/geometry";
import type { Box, DesignFile, DesignNode } from "@/design/types";
import { TEXT_LEADING } from "@/design/types";

const AMP = "&" + "amp;";
const LT = "&" + "lt;";
const GT = "&" + "gt;";
const QUOT = "&" + "quot;";

function escapeXml(value: string) {
  return value.replace(/&/g, AMP).replace(/</g, LT).replace(/>/g, GT).replace(/"/g, QUOT);
}

function safeName(name: string) {
  return name.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "lamina";
}

function selectionBox(file: DesignFile, ids: string[]): Box | null {
  const parents = parentIndex(file);
  const use = ids.length ? topLevel(file, ids).filter((id) => file.nodes[id]) : file.rootIds;
  let box: Box | null = null;
  for (const id of use) {
    if (!file.nodes[id]) continue;
    const next = worldAabb(file, id, parents);
    box = box ? unionBox(box, next) : next;
  }
  return box;
}

function paintLocal(node: DesignNode) {
  if (node.type === "rect" || node.type === "frame" || (node.type === "group" && node.fill)) {
    return `<rect width="${node.w}" height="${node.h}" rx="${node.radius}" fill="${node.fill ?? "none"}" stroke="${node.stroke ?? "none"}" stroke-width="${node.stroke ? node.strokeWidth : 0}"/>`;
  }
  if (node.type === "ellipse") {
    return `<ellipse cx="${node.w / 2}" cy="${node.h / 2}" rx="${node.w / 2}" ry="${node.h / 2}" fill="${node.fill ?? "none"}" stroke="${node.stroke ?? "none"}" stroke-width="${node.stroke ? node.strokeWidth : 0}"/>`;
  }
  if (node.type === "line") {
    const x1 = node.lineFrom === "tr" ? node.w : 0;
    const x2 = node.lineFrom === "tr" ? 0 : node.w;
    return `<line x1="${x1}" y1="0" x2="${x2}" y2="${node.h}" stroke="${node.stroke ?? "#1c1c1f"}" stroke-width="${node.strokeWidth || 2}" stroke-linecap="round"/>`;
  }
  if (node.type === "text") {
    const anchor = node.align === "center" ? "middle" : node.align === "right" ? "end" : "start";
    const x = node.align === "center" ? node.w / 2 : node.align === "right" ? node.w : 0;
    const lines = (node.text || "").split("\n");
    const tspans = lines
      .map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : node.fontSize * TEXT_LEADING}">${escapeXml(line) || " "}</tspan>`)
      .join("");
    return `<text x="${x}" y="${node.fontSize}" fill="${node.fill ?? "#1c1c1f"}" font-family="Outfit, sans-serif" font-size="${node.fontSize}" font-weight="${node.fontWeight}" text-anchor="${anchor}">${tspans}</text>`;
  }
  return "";
}

function paintNode(file: DesignFile, id: string, absolute: boolean): string {
  const node = file.nodes[id];
  if (!node?.visible) return "";
  const transform = absolute
    ? (() => {
        const m = worldMat(file, id);
        return `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
      })()
    : `translate(${node.x} ${node.y})${node.rotation ? ` rotate(${node.rotation})` : ""}`;
  const kids = node.children.map((child) => paintNode(file, child, false)).join("");
  const clipped =
    node.type === "frame"
      ? `<defs><clipPath id="clip-${node.id}"><rect width="${node.w}" height="${node.h}" rx="${node.radius}"/></clipPath></defs><g clip-path="url(#clip-${node.id})">${kids}</g>`
      : kids;
  return `<g transform="${transform}" opacity="${node.opacity / 100}">${paintLocal(node)}${clipped}</g>`;
}

export function fileToSvg(file: DesignFile, ids: string[]) {
  const use = ids.length ? topLevel(file, ids).filter((id) => file.nodes[id]) : file.rootIds;
  const box = selectionBox(file, use);
  if (!box) return null;
  const w = Math.max(1, box.maxX - box.minX);
  const h = Math.max(1, box.maxY - box.minY);
  const body = use.map((id) => paintNode(file, id, true)).join("");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${box.minX} ${box.minY} ${w} ${h}">${body}</svg>`;
  return { svg, name: `${safeName(file.name)}.svg` };
}

function traceRound(ctx: CanvasRenderingContext2D, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, radius);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxW) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

function drawShape(ctx: CanvasRenderingContext2D, node: DesignNode) {
  if (node.type === "rect" || node.type === "frame" || (node.type === "group" && (node.fill || node.stroke))) {
    traceRound(ctx, node.w, node.h, node.radius);
    if (node.fill) {
      ctx.fillStyle = node.fill;
      ctx.fill();
    }
    if (node.stroke && node.strokeWidth > 0) {
      ctx.strokeStyle = node.stroke;
      ctx.lineWidth = node.strokeWidth;
      ctx.stroke();
    }
    return;
  }
  if (node.type === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(node.w / 2, node.h / 2, Math.max(0.5, node.w / 2), Math.max(0.5, node.h / 2), 0, 0, Math.PI * 2);
    if (node.fill) {
      ctx.fillStyle = node.fill;
      ctx.fill();
    }
    if (node.stroke && node.strokeWidth > 0) {
      ctx.strokeStyle = node.stroke;
      ctx.lineWidth = node.strokeWidth;
      ctx.stroke();
    }
    return;
  }
  if (node.type === "line") {
    ctx.beginPath();
    if (node.lineFrom === "tr") {
      ctx.moveTo(node.w, 0);
      ctx.lineTo(0, node.h);
    } else {
      ctx.moveTo(0, 0);
      ctx.lineTo(node.w, node.h);
    }
    ctx.strokeStyle = node.stroke ?? "#1c1c1f";
    ctx.lineWidth = node.strokeWidth || 2;
    ctx.lineCap = "round";
    ctx.stroke();
    return;
  }
  if (node.type === "text") {
    ctx.fillStyle = node.fill ?? "#1c1c1f";
    ctx.font = `${node.fontWeight} ${node.fontSize}px Outfit, sans-serif`;
    ctx.textBaseline = "top";
    ctx.textAlign = node.align;
    const x = node.align === "center" ? node.w / 2 : node.align === "right" ? node.w : 0;
    const lines = wrapLines(ctx, node.text || "", Math.max(4, node.w));
    lines.forEach((line, i) => ctx.fillText(line, x, i * node.fontSize * TEXT_LEADING));
  }
}

function drawLocal(ctx: CanvasRenderingContext2D, file: DesignFile, id: string) {
  const node = file.nodes[id];
  if (!node?.visible) return;
  ctx.save();
  const cos = Math.cos((node.rotation * Math.PI) / 180);
  const sin = Math.sin((node.rotation * Math.PI) / 180);
  ctx.transform(cos, sin, -sin, cos, node.x, node.y);
  ctx.globalAlpha *= node.opacity / 100;
  drawShape(ctx, node);
  if (node.type === "frame") {
    ctx.save();
    traceRound(ctx, node.w, node.h, node.radius);
    ctx.clip();
    for (const child of node.children) drawLocal(ctx, file, child);
    ctx.restore();
  } else {
    for (const child of node.children) drawLocal(ctx, file, child);
  }
  ctx.restore();
}

export async function fileToPng(file: DesignFile, ids: string[]) {
  const use = ids.length ? topLevel(file, ids).filter((id) => file.nodes[id]) : file.rootIds;
  const box = selectionBox(file, use) ?? fileAabb(file);
  if (!box) return null;
  const w = Math.max(1, box.maxX - box.minX);
  const h = Math.max(1, box.maxY - box.minY);
  let scale = 2;
  if (w * scale > 4096) scale = 4096 / w;
  if (h * scale > 4096) scale = Math.min(scale, 4096 / h);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (document.fonts?.ready) await document.fonts.ready;
  ctx.scale(scale, scale);
  ctx.translate(-box.minX, -box.minY);
  for (const id of use) {
    const node = file.nodes[id];
    if (!node) continue;
    const m = worldMat(file, id);
    ctx.save();
    ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.globalAlpha *= node.opacity / 100;
    drawShape(ctx, node);
    if (node.type === "frame") {
      ctx.save();
      traceRound(ctx, node.w, node.h, node.radius);
      ctx.clip();
      for (const child of node.children) drawLocal(ctx, file, child);
      ctx.restore();
    } else {
      for (const child of node.children) drawLocal(ctx, file, child);
    }
    ctx.restore();
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return null;
  return { blob, name: `${safeName(file.name)}.png` };
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadText(text: string, name: string, type: string) {
  downloadBlob(new Blob([text], { type }), name);
}
