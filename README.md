# Lamina

A browser-only vector design board. Draw frames, shapes, and text, then arrange them with layers, alignment, and undo. Nothing is uploaded. Files live in `localStorage` on this device.

No account. No database. No PHP.

## What you can do

- Draw frames, rectangles, ellipses, lines, and text
- Pan, zoom, snap, group, align, and distribute
- Edit type, fill, stroke, radius, and opacity
- Undo and redo
- Export SVG or PNG
- Keep multiple files on the device (new, duplicate, rename, delete)

## Run it

```bash
npm install
npm run dev
```

The app serves on port `8080`.

## Keyboard

| Key | Action |
| --- | --- |
| V | Select |
| H | Hand |
| F R O L T | Frame, rectangle, ellipse, line, text |
| Space | Pan while held |
| Cmd/Ctrl+Z | Undo |
| Cmd/Ctrl+Shift+Z | Redo |
| Cmd/Ctrl+D | Duplicate |
| Cmd/Ctrl+G | Group |
| ? | Shortcut list |

Shift constrains a draw or resize. Alt-drag duplicates.

## Stack

React 19, TanStack Start, Vite, Tailwind CSS, Zustand.
