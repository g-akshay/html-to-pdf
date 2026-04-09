# ⚡ html-convert

> Convert any HTML file or folder into a **PDF** or **EPUB** — from your terminal or a browser tab.

Handles canvas, SVG, charts, custom fonts, CSS animations, and anything a real browser can render.

---

## 📋 Table of Contents

- [🚀 Install](#-install)
- [🌐 Method 1 — Web UI](#-method-1--web-ui)
- [💻 Method 2 — CLI](#-method-2--cli)
  - [1. Interactive wizard](#1-interactive-wizard)
  - [2. Convert a single file to PDF](#2-convert-a-single-file-to-pdf)
  - [3. Convert to EPUB](#3-convert-to-epub)
  - [4. Convert to both PDF and EPUB](#4-convert-to-both-pdf-and-epub)
  - [5. Convert a whole folder](#5-convert-a-whole-folder)
  - [6. Choose where to save](#6-choose-where-to-save)
  - [7. Change page size](#7-change-page-size)
  - [8. All options](#8-all-options)
- [✅ What it supports](#-what-it-supports)
- [🧪 Test it quickly](#-test-it-quickly)
- [🗂️ Project layout](#️-project-layout)
- [📦 Requirements](#-requirements)

---

## 🚀 Install

You need **Node.js 18 or newer**. Check with:

```bash
node --version
```

Then clone and install:

```bash
git clone <this-repo>
cd html-to-pdf
npm install
npm link
```

> `npm link` makes the `html-convert` command available anywhere on your machine.

---

## 🌐 Method 1 — Web UI

**Best for:** one-off conversions, non-technical users, or when you just want to drag and drop.

**Step 1** — Start the server:

```bash
html-convert serve
```

**Step 2** — A browser tab opens at **http://localhost:3000**. Then:

1. 📂 Drag a file or folder onto the drop zone — or click **Choose File** / **Choose Folder**
2. 🎛️ Pick your format: `PDF`, `EPUB`, or `Both`
3. ⚡ Click **Convert**
4. ⬇️ Download the result when it appears

Want a different port?

```bash
html-convert serve --port 8080
```

---

## 💻 Method 2 — CLI

**Best for:** automation, batch processing, or if you prefer the terminal.

### 1. Interactive wizard

Not sure about flags? Just run it — a wizard will guide you:

```bash
html-convert
```

It asks what to convert, which format, and where to save. No flags needed.

---

### 2. Convert a single file to PDF

```bash
html-convert convert mypage.html
```

Output is saved next to the file as `mypage.pdf`.

---

### 3. Convert to EPUB

```bash
html-convert convert mypage.html --format epub
```

---

### 4. Convert to both PDF and EPUB

```bash
html-convert convert mypage.html --format pdf,epub
```

Both files are saved to the same output folder.

---

### 5. Convert a whole folder

If your HTML references local CSS, images, or fonts, pass the **folder** — not just the file:

```bash
html-convert convert ./my-site
```

All assets are picked up automatically.

---

### 6. Choose where to save

```bash
html-convert convert ./my-site --output ./exports
```

The folder is created if it doesn't exist.

---

### 7. Change page size

```bash
html-convert convert mypage.html --page-format Letter
```

| Option | Size |
|---|---|
| `A4` _(default)_ | 297 × 210 mm |
| `Letter` | 279 × 216 mm |
| `Legal` | 356 × 216 mm |
| `A3` | 420 × 297 mm |

---

### 8. All options

```
html-convert convert <file-or-folder> [options]

  -f, --format <formats>     pdf, epub, or pdf,epub     (default: pdf)
  -o, --output <dir>         Where to save the output
  -t, --title <title>        Document title
  -a, --author <author>      Author name (used in EPUB)
  -p, --page-format <size>   A4 | Letter | Legal | A3   (default: A4)
```

---

## ✅ What it supports

| Feature | PDF | EPUB |
|---|---|---|
| 🎨 Canvas elements | ✅ Yes | ❌ No (static HTML only) |
| 🔷 SVG graphics | ✅ Yes | ✅ Yes |
| 📊 Charts (Chart.js, D3, etc.) | ✅ Yes | ❌ No |
| 🔤 Custom fonts | ✅ Yes | ✅ Yes (inlined) |
| 🎨 CSS (Flexbox, Grid, animations) | ✅ Yes | ✅ Yes |
| 🖼️ Images | ✅ Yes | ✅ Yes (inlined as base64) |
| 📄 Multi-page / multi-file | ✅ Yes | ✅ Yes (as chapters) |

- **PDF** uses headless Chrome — renders exactly what a browser would show.
- **EPUB** inlines all images and CSS so the file is fully self-contained.

---

## 🧪 Test it quickly

A sample HTML file with canvas, SVG, charts, and tables is included:

```bash
html-convert convert test/fixtures/sample/index.html --format pdf,epub --output /tmp/test-out
```

---

## 🗂️ Project layout

```
bin/html-convert.js       CLI entry point
src/cli/                  Commands, interactive wizard, visual helpers
src/core/                 PDF and EPUB conversion logic
src/web/                  Express web server + Socket.io
src/web/public/           Browser UI (drag & drop, progress, download)
src/utils/                File walker, temp directory manager
test/fixtures/sample/     Sample HTML for testing
```

---

## 📦 Requirements

- **Node.js 18+**
- Chromium downloads automatically via Puppeteer on first `npm install` (~170 MB)
