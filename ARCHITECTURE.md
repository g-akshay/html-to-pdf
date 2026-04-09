# Architecture

This document explains how html-convert works internally, why each piece exists, and how they fit together.

---

## The problem it solves

HTML files are not standalone documents. They reference CSS files, fonts, images, JavaScript-driven charts, and SVG graphics. Converting HTML to PDF or EPUB is hard because:

- Most PDF tools treat HTML as simple markup and miss CSS layouts, custom fonts, and anything drawn with JavaScript (charts, canvas, D3)
- EPUB readers have no browser engine — they cannot load external files, run JavaScript, or fetch network resources
- Local HTML files that reference sibling assets by relative path break when you try to open them from a different context

html-convert solves each of these differently for each format, using the right tool for the job.

---

## High-level overview

```
User input (file or folder)
        │
        ▼
  converter.js          ← orchestrator: resolves paths, collects HTML files,
        │                 dispatches to format-specific generators
        ├──────────────────────────────────┐
        ▼                                  ▼
      pdf.js                           epub.js
        │                                  │
        ▼                                  ▼
  local-server.js              asset-processor.js
  (serve folder over HTTP)     (inline images + CSS into HTML)
        │                                  │
        ▼                                  ▼
  puppeteer                        epub-gen-memory
  (headless Chrome → PDF)          (zip EPUB package → buffer)
```

Both paths share the same entry point (`converter.js`) and the same file discovery logic (`file-walker.js`). The output — a PDF or EPUB file on disk — is the same regardless of whether the job came from the CLI or the web UI.

---

## Entry points

There are two ways to trigger a conversion:

### CLI (`src/cli/`)

```
bin/html-convert.js
  └── src/cli/index.js       Commander commands: convert, serve
        └── src/cli/interactive.js   Inquirer wizard (no-args mode)
```

`bin/html-convert.js` is the shebang entry point. It imports `src/cli/index.js` which sets up three paths:

1. `html-convert convert <input>` — parses flags, calls `converter.convert()` directly
2. `html-convert serve` — calls `startWebServer()` and keeps the process alive
3. `html-convert` (no args) — drops into the interactive Inquirer wizard, then calls one of the above

All visual output (spinners, coloured text, result boxes) is centralised in `src/cli/ui.js`. Nothing outside that file calls `chalk` or `ora` directly.

### Web UI (`src/web/`)

```
src/web/app.js            Express + Socket.io server
  ├── POST /api/convert   Multer upload → job queue → converter.convert()
  ├── GET  /api/download  Stream output file to browser
  └── GET  /api/status    Poll job state (fallback if socket missed)

src/web/public/
  ├── index.html          Single-page UI
  ├── style.css           Dark theme
  └── app.js              Drag & drop, socket.io client, progress, download
```

The web server accepts file uploads, reconstructs the folder structure in a temp directory, fires `converter.convert()` in the background, and streams progress back to the browser over Socket.io. The browser never waits — it gets a `jobId` immediately and subscribes to a Socket.io room for updates.

---

## PDF pipeline (`src/core/pdf.js`)

**Why Puppeteer?**
Puppeteer runs a real headless Chromium browser. It is the only reliable way to capture canvas drawings, WebGL, Chart.js, D3, CSS animations, web fonts, and complex Flexbox/Grid layouts — because it actually executes all of that, exactly as a user's browser would.

**Why a local HTTP server instead of `file://`?**

Three problems with `file://`:

1. **Canvas CORS taint.** When a page is loaded via `file://`, the browser marks any canvas that draws an image as "tainted" and refuses to read pixel data. `getImageData()` throws. Charts that use image fills or sprites silently break.
2. **`networkidle0` never fires.** Puppeteer waits for network activity to go quiet. On `file://`, there is no network, so the event never arrives on some versions.
3. **Relative asset paths on Windows.** `file://` with `../fonts/` and similar paths resolves inconsistently across OSes.

The fix: `local-server.js` mounts the folder root using `express.static` on `127.0.0.1:<random-port>` (port `0` lets the OS pick a free one). The server starts before the browser opens and is destroyed immediately after the PDF is written. Each conversion job gets its own server instance — no port conflicts.

**Waiting for render**

After `page.goto()` with `waitUntil: 'networkidle0'`, there is a secondary wait that runs inside the page:

1. It checks `document.images` for any incomplete image loads and waits for them
2. It fires `requestAnimationFrame` + a 800 ms timeout to give JavaScript-driven charts (Chart.js, D3, Recharts) time to finish their render cycle
3. A second 600 ms pause catches any deferred animation or lazy-loaded content

This is intentional over-waiting. A PDF that captures a blank chart is worse than one that takes an extra second.

---

## EPUB pipeline (`src/core/epub.js` + `src/core/asset-processor.js`)

**Why not Puppeteer for EPUB?**

EPUB readers (Kindle, Apple Books, Kobo) are not browsers. They do not execute JavaScript, they cannot load external HTTP resources, and they do not support many CSS features. Running Puppeteer to produce an EPUB would create a file that looks right as a screenshot but fails as a document — no reflowable text, no accessible content, no chapter navigation.

EPUB needs actual HTML with inlined assets.

**Asset inlining (`asset-processor.js`)**

Cheerio (server-side jQuery) parses the HTML and performs three passes:

1. **Images** — every `<img src="...">` that points to a local file is read from disk and replaced with a `data:image/...;base64,...` URI. External URLs (`http://`) are left alone.
2. **Stylesheets** — every `<link rel="stylesheet">` that points to a local file is read, its own `url(...)` references (fonts, background images) are recursively base64-encoded, and the whole CSS is injected as an inline `<style>` block. The `<link>` tag is removed.
3. **Scripts** — `<script>` tags are stripped entirely. EPUB readers ignore them, and leaving them in can confuse some validators.

The result is a single self-contained HTML string with no external dependencies.

**EPUB packaging (`epub.js`)**

The processed HTML strings are passed to `epub-gen-memory`, which builds the EPUB zip structure in memory:

- `mimetype` (uncompressed, must be first entry per spec)
- `META-INF/container.xml`
- `OEBPS/content.opf` (manifest + spine)
- `OEBPS/toc.ncx` + `toc.xhtml` (navigation)
- `OEBPS/<chapter>.xhtml` per HTML file

Each HTML file in the input becomes one chapter. The chapter title is extracted from `<title>` or the first `<h1>` by `extractTitle()` in `asset-processor.js`. The output is a `Buffer` written directly to disk.

> **API note:** epub-gen-memory chapters use `{ title, content }` (not `data`). Content goes as the **second constructor argument**: `new EPub(options, chapters)` — not inside the options object.

---

## Folder upload in the browser (`src/web/public/app.js`)

Standard `<input type="file">` does not support drag-and-drop of folders. The browser's `DataTransfer` API exposes `webkitGetAsEntry()` which returns a `FileSystemEntry`. Directories return a `FileSystemDirectoryReader` whose `readEntries()` must be called in a loop — it returns a maximum of 100 entries per call.

```
drop event
  └── item.webkitGetAsEntry()
        ├── isFile → file() → attach relativePath, push to list
        └── isDirectory → createReader() → readEntries() loop
              └── recurse into each child entry
```

Each collected `File` object gets a custom `relativePath` property set to its path within the dropped folder (e.g. `my-site/css/main.css`). When uploading via `FormData`, this relative path is passed as the filename so Multer on the server can reconstruct the original folder structure in a temp directory.

---

## Shared utilities

### `src/utils/file-walker.js`

`collectHtmlFiles(path)` accepts either a single `.html` file or a directory. For directories it walks recursively, skips `node_modules` and `.git`, and returns all `.html`/`.htm` files sorted alphanumerically (so multi-chapter EPUBs come out in the right order).

`getServeRoot(path)` returns the directory to mount as the HTTP server root — the file's parent directory for a single file, the directory itself for a folder input.

### `src/utils/temp-manager.js`

All temp directories are tracked in a module-level `Set`. Cleanup handlers are registered for `process.exit`, `SIGINT`, and `SIGTERM` so no orphaned temp files are left behind even if the process is killed mid-conversion.

---

## Progress reporting

Both the CLI and web UI consume the same `onProgress(pct, label)` callback pattern emitted by `converter.js`. The caller decides what to do with it:

- **CLI:** updates the ora spinner text
- **Web server:** emits `job:progress` over Socket.io to the browser

This means the core conversion logic has no knowledge of how it is being invoked. Adding a new interface (e.g. a native app, a REST-only API) only requires wiring up the callback — the conversion logic is untouched.

---

## Data flow summary

```
CLI                              Web UI
 │                                │
 │  convert(options)              │  POST /api/convert (multipart)
 │                                │    → Multer reconstructs folder in /tmp
 │                                │    → responds { jobId } immediately
 │                                │    → setImmediate → convert(options)
 │                                │    → Socket.io streams progress to browser
 └──────────────┬─────────────────┘
                │
                ▼
         converter.js
           │  collectHtmlFiles()
           │  mkdirSync(outputDir)
           │
           ├── for format 'pdf':
           │     local-server.js   (express.static, port 0)
           │     puppeteer.launch()
           │     page.goto(http://127.0.0.1:<port>/file.html)
           │     wait for images + requestAnimationFrame + 600ms
           │     page.pdf({ printBackground: true })
           │     browser.close() + server.close()
           │
           └── for format 'epub':
                 asset-processor.js  (cheerio: inline imgs, CSS, strip scripts)
                 epub-gen-memory     (build zip in memory)
                 writeFile(outputPath, buffer)
```

---

## Adding a new output format

1. Create `src/core/<format>.js` — export `generate<Format>({ htmlFiles, outputPath, onProgress })`
2. Add a dispatch branch in `src/core/converter.js`
3. Add the format name to the CLI options in `src/cli/index.js` and the wizard in `src/cli/interactive.js`
4. Add a format badge in `src/web/public/index.html` and handle it in `src/web/public/app.js`
