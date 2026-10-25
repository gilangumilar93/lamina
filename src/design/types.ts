export type NodeType = "frame" | "rect" | "ellipse" | "line" | "text" | "group";

export type LineFrom = "tl" | "tr";

export type Align = "left" | "center" | "right";

export type DesignNode = {
  id: string;
  type: NodeType;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  radius: number;
  visible: boolean;
  locked: boolean;
  text: string;
  fontSize: number;
  fontWeight: number;
  align: Align;
  lineFrom: LineFrom;
  children: string[];
};

export type DesignFile = {
  id: string;
  name: string;
  updatedAt: number;
  nodes: Record<string, DesignNode>;
  rootIds: string[];
};

export type Tool = "select" | "hand" | "frame" | "rect" | "ellipse" | "line" | "text";

export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export type Vec = { x: number; y: number };

export type Box = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export const TEXT_LEADING = 1.35;

export const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: "select", label: "Select", key: "V" },
  { id: "frame", label: "Frame", key: "F" },
  { id: "rect", label: "Rectangle", key: "R" },
  { id: "ellipse", label: "Ellipse", key: "O" },
  { id: "line", label: "Line", key: "L" },
  { id: "text", label: "Text", key: "T" },
  { id: "hand", label: "Hand", key: "H" },
];
