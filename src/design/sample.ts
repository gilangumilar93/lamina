import { createNode } from "@/design/ops";
import type { DesignFile, DesignNode } from "@/design/types";

function node(
  type: DesignNode["type"],
  id: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<DesignNode> = {},
): DesignNode {
  return createNode(type, { id, name, x, y, w, h, ...extra });
}

export function sampleFile(): DesignFile {
  const screenKids = [
    "band",
    "mark",
    "title",
    "lede",
    "card",
    "card-title",
    "card-body",
    "chip",
    "chip-label",
    "row",
    "dot",
    "row-title",
    "row-body",
    "caption",
  ];
  const paletteKids = ["pal-title", "pal-lede", "rule", "s1", "s2", "s3", "l1", "l2", "l3", "s4", "s5", "s6", "l4", "l5", "l6"];

  const nodes: Record<string, DesignNode> = {
    screen: node("frame", "screen", "Screen", 64, 48, 390, 720, {
      fill: "#f3f1ec",
      stroke: "#e3dfd8",
      radius: 28,
      children: screenKids,
    }),
    band: node("rect", "band", "Night band", 0, 0, 390, 228, { fill: "#1b1b1f" }),
    mark: node("ellipse", "mark", "Mark", 308, 52, 52, 52, { fill: "#6d8fbf" }),
    title: node("text", "title", "Title", 28, 64, 250, 56, {
      text: "Field notes",
      fontSize: 40,
      fontWeight: 600,
      fill: "#f6f4ef",
    }),
    lede: node("text", "lede", "Lede", 28, 124, 250, 72, {
      text: "Layouts for visits, boards,\nand the notes between.",
      fontSize: 16,
      fontWeight: 400,
      fill: "#c8c6c1",
    }),
    card: node("rect", "card", "Card", 20, 256, 350, 188, { fill: "#ffffff", radius: 16 }),
    "card-title": node("text", "card-title", "Card title", 40, 276, 250, 28, {
      text: "North elevation",
      fontSize: 18,
      fontWeight: 600,
      fill: "#1b1b1f",
    }),
    "card-body": node("text", "card-body", "Card body", 40, 312, 280, 60, {
      text: "Two bays. Modular wall.\nCheck the joint at grid C.",
      fontSize: 15,
      fontWeight: 400,
      fill: "#5c5c66",
    }),
    chip: node("rect", "chip", "Chip", 40, 388, 112, 36, { fill: "#1b1b1f", radius: 18 }),
    "chip-label": node("text", "chip-label", "Chip label", 40, 396, 112, 22, {
      text: "Review",
      fontSize: 14,
      fontWeight: 600,
      fill: "#f4f1eb",
      align: "center",
    }),
    row: node("rect", "row", "Status card", 20, 464, 350, 112, { fill: "#ffffff", radius: 16 }),
    dot: node("ellipse", "dot", "Dot", 40, 492, 18, 18, { fill: "#8d9a86" }),
    "row-title": node("text", "row-title", "Status", 72, 478, 240, 28, {
      text: "Site clear",
      fontSize: 16,
      fontWeight: 600,
      fill: "#1b1b1f",
    }),
    "row-body": node("text", "row-body", "Status note", 72, 508, 260, 44, {
      text: "Photos and measurements\nstay on this board.",
      fontSize: 14,
      fontWeight: 400,
      fill: "#6e6e78",
    }),
    caption: node("text", "caption", "Caption", 28, 612, 320, 52, {
      text: "Saved on this device.\nNo account required.",
      fontSize: 14,
      fontWeight: 400,
      fill: "#6e6e78",
    }),
    palette: node("frame", "palette", "Palette", 500, 48, 300, 392, {
      fill: "#ffffff",
      stroke: "#e3dfd8",
      radius: 16,
      children: paletteKids,
    }),
    "pal-title": node("text", "pal-title", "Palette title", 24, 24, 220, 32, {
      text: "Palette",
      fontSize: 22,
      fontWeight: 600,
      fill: "#1b1b1f",
    }),
    "pal-lede": node("text", "pal-lede", "Palette note", 24, 58, 250, 44, {
      text: "Steel, clay, and paper.\nChange any fill.",
      fontSize: 14,
      fontWeight: 400,
      fill: "#6e6e78",
    }),
    rule: node("line", "rule", "Rule", 24, 112, 252, 1, { stroke: "#e4e0d8", strokeWidth: 1 }),
    s1: node("rect", "s1", "Ink", 24, 136, 72, 72, { fill: "#1b1b1f", radius: 8 }),
    s2: node("rect", "s2", "Steel", 114, 136, 72, 72, { fill: "#6d8fbf", radius: 8 }),
    s3: node("rect", "s3", "Clay", 204, 136, 72, 72, { fill: "#c46b5a", radius: 8 }),
    l1: node("text", "l1", "Ink label", 24, 214, 72, 20, { text: "Ink", fontSize: 12, fill: "#6e6e78", align: "center" }),
    l2: node("text", "l2", "Steel label", 114, 214, 72, 20, { text: "Steel", fontSize: 12, fill: "#6e6e78", align: "center" }),
    l3: node("text", "l3", "Clay label", 204, 214, 72, 20, { text: "Clay", fontSize: 12, fill: "#6e6e78", align: "center" }),
    s4: node("rect", "s4", "Paper", 24, 248, 72, 72, { fill: "#f3f1ec", stroke: "#dedad4", radius: 8 }),
    s5: node("rect", "s5", "Olive", 114, 248, 72, 72, { fill: "#8d9a86", radius: 8 }),
    s6: node("rect", "s6", "Sand", 204, 248, 72, 72, { fill: "#d9d6d0", radius: 8 }),
    l4: node("text", "l4", "Paper label", 24, 328, 72, 20, { text: "Paper", fontSize: 12, fill: "#6e6e78", align: "center" }),
    l5: node("text", "l5", "Olive label", 114, 328, 72, 20, { text: "Olive", fontSize: 12, fill: "#6e6e78", align: "center" }),
    l6: node("text", "l6", "Sand label", 204, 328, 72, 20, { text: "Sand", fontSize: 12, fill: "#6e6e78", align: "center" }),
  };

  return {
    id: "file-field-notes",
    name: "Field notes",
    updatedAt: 1_700_000_000_000,
    nodes,
    rootIds: ["screen", "palette"],
  };
}

export function blankFile(name: string): DesignFile {
  const frame = createNode("frame", {
    name: "Frame",
    x: 80,
    y: 80,
    w: 390,
    h: 640,
    fill: "#f4f1eb",
    stroke: "#e3dfd8",
    radius: 0,
  });
  return {
    id: uidSafe(),
    name,
    updatedAt: Date.now(),
    nodes: { [frame.id]: frame },
    rootIds: [frame.id],
  };
}

function uidSafe() {
  return `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
