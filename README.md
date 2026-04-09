# html-convert

Convert any HTML file or folder into a **PDF** or **EPUB** — from your terminal or a browser tab.

Handles canvas, SVG, charts, custom fonts, CSS, and anything a real browser can render.

---

## Table of Contents

- [Install](#install)
- [Use the CLI](#use-the-cli)
  - [Simplest: just run it and answer the questions](#simplest-just-run-it-and-answer-the-questions)
  - [Convert a single HTML file to PDF](#convert-a-single-html-file-to-pdf)
  - [Convert to EPUB instead](#convert-to-epub-instead)
  - [Convert to both PDF and EPUB at once](#convert-to-both-pdf-and-epub-at-once)
  - [Convert a whole folder](#convert-a-whole-folder)
  - [Choose where to save](#choose-where-to-save)
  - [Change page size (PDF only)](#change-page-size-pdf-only)
  - [Full options](#full-options)
- [Use the Web UI](#use-the-web-ui)
- [What it supports](#what-it-supports)
- [Test it quickly](#test-it-quickly)
- [Project layout](#project-layout)
- [Requirements](#requirements)

---

## Install

You need **Node.js 18 or newer**. Check with:

```
node --version
```

Then clone and install:

```bash
git clone <this-repo>
cd html-to-pdf
npm install
npm link
```

`npm link` makes the `html-convert` command available anywhere on your machine.

---

## Use the CLI

### Simplest: just run it and answer the questions

```bash
html-convert
```

An interactive wizard will ask what to convert, which format, and where to save. No flags needed.

---

### Convert a single HTML file to PDF

```bash
html-convert convert mypage.html
```

Output lands next to the file as `mypage.pdf`.

---

### Convert to EPUB instead

```bash
html-convert convert mypage.html --format epub
```

---

### Convert to both PDF and EPUB at once

```bash
html-convert convert mypage.html --format pdf,epub
```

---

### Convert a whole folder

If your HTML references local CSS, images, or fonts, pass the folder:

```bash
html-convert convert ./my-site
```

All assets are picked up automatically.

---

### Choose where to save

```bash
html-convert convert ./my-site --output ./exports
```

---

### Change page size (PDF only)

```bash
html-convert convert mypage.html --page-format Letter
```

Options: `A4` (default), `Letter`, `Legal`, `A3`

---

### Full options

```
html-convert convert <file-or-folder> [options]

Options:
  -f, --format <formats>     pdf, epub, or pdf,epub   (default: pdf)
  -o, --output <dir>         Where to save the output
  -t, --title <title>        Document title
  -a, --author <author>      Author name (used in EPUB)
  -p, --page-format <size>   A4 | Letter | Legal | A3  (default: A4)
```

---

## Use the Web UI

If you prefer clicking over typing:

```bash
html-convert serve
```

This opens a browser tab at **http://localhost:3000**

From there:
1. Drag a file or folder onto the drop zone (or click "Choose File" / "Choose Folder")
2. Pick your format: PDF, EPUB, or Both
3. Click **Convert**
4. Download the result when it appears

That's it.

To use a different port:

```bash
html-convert serve --port 8080
```

---

## What it supports

| Feature | PDF | EPUB |
|---|---|---|
| Canvas elements | Yes | No (static HTML only) |
| SVG graphics | Yes | Yes |
| Charts (Chart.js, D3, etc.) | Yes | No |
| Custom fonts | Yes | Yes (inlined) |
| CSS (Flexbox, Grid, animations) | Yes | Yes |
| Images | Yes | Yes (inlined as base64) |
| Multi-page / multi-file | Yes | Yes (chapters) |

PDF uses headless Chrome so it renders exactly what a browser would show.
EPUB inlines all images and CSS so the file is fully self-contained.

---

## Test it quickly

A sample HTML file with canvas, SVG, charts, and tables is included:

```bash
html-convert convert test/fixtures/sample/index.html --format pdf,epub --output /tmp/test-out
```

---

## Project layout

```
bin/html-convert.js       CLI entry point
src/cli/                  CLI commands, wizard, visual helpers
src/core/                 PDF and EPUB conversion logic
src/web/                  Express web server + Socket.io
src/web/public/           Browser UI (drag & drop, progress, download)
src/utils/                File walker, temp directory manager
test/fixtures/sample/     Sample HTML for testing
```

---

## Requirements

- Node.js 18+
- Chromium is downloaded automatically by Puppeteer on first `npm install` (~170 MB)
