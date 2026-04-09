# html-convert — Claude Code Context

## What this project does
CLI tool + web UI that converts HTML files and folders into **PDF** and **EPUB**.
The command is `html-convert` (globally linked via `npm link`).

## Tech stack
- **PDF**: Puppeteer (headless Chromium) — renders canvas, SVG, charts, fonts, CSS animations
- **EPUB**: epub-gen-memory — cheerio inlines all images/CSS/fonts before packaging
- **CLI**: commander (commands) · inquirer/@inquirer/prompts (wizard) · chalk + ora + boxen + gradient-string + figlet (UI)
- **Web server**: Express 4 + Socket.io 4 + Multer
- **Runtime**: Node.js ≥ 18, ESM (`"type": "module"` throughout)

## File map
```
bin/html-convert.js          Entry point (shebang, calls src/cli/index.js)
src/cli/index.js             Commander setup — convert & serve commands + no-arg fallback
src/cli/interactive.js       Inquirer wizard (runs when no args given)
src/cli/ui.js                All visual helpers: printHeader, createSpinner, printSummary, etc.
src/core/converter.js        Orchestrator — calls pdf.js or epub.js, handles single/multi file
src/core/pdf.js              Puppeteer PDF: spins up local-server.js, waits for canvas/charts
src/core/epub.js             epub-gen-memory wrapper; chapters need { title, content } (not data)
src/core/local-server.js     express.static on port 0 — solves file:// CORS/canvas issues
src/core/asset-processor.js  Cheerio: inlines <img>, <link rel=stylesheet>, url() in CSS
src/utils/file-walker.js     collectHtmlFiles() — file or folder → [{path, relativePath}]
src/utils/temp-manager.js    createTempDir / cleanupTempDir + process exit hooks
src/web/app.js               Express app + Socket.io + Multer; POST /api/convert, GET /api/download
src/web/public/index.html    Web UI — drag & drop, format picker, progress, download
src/web/public/style.css     Dark theme CSS
src/web/public/app.js        Frontend JS — webkitGetAsEntry folder traversal, socket.io client
test/fixtures/sample/        Test HTML with canvas, SVG, pie chart, tables, styled content
```

## Key decisions & gotchas

### epub-gen-memory chapter shape
Chapters must use `content` (not `data`):
```js
{ title: 'Chapter Title', content: '<p>html string</p>' }
```
Constructor: `new EPub(options, chaptersArray)` — content goes as the **second argument**, not inside options.

### Why a local HTTP server for Puppeteer (not file://)
Three problems with `file://`: (1) canvas `getImageData()` is CORS-tainted, (2) relative font paths break on Windows, (3) `networkidle0` never resolves. `spawnLocalServer()` mounts the folder on `127.0.0.1:<random-port>` and tears it down per job.

### Folder uploads in the browser
Uses `webkitGetAsEntry()` + recursive `DirectoryReader.readEntries()` (must loop — returns max 100 at a time). Relative paths are preserved in `file.relativePath` and sent as the FormData filename so Multer can reconstruct folder structure server-side.

### ESM-only packages
chalk v5, ora v8, boxen v8, gradient-string v3, open v10 are all ESM-only. Do not `require()` them. The whole project uses `"type": "module"`.

## Common commands
```bash
# Run a conversion
node bin/html-convert.js convert <file-or-folder> --format pdf,epub --output ./dist

# Start web UI
node bin/html-convert.js serve

# After npm link — use anywhere
html-convert convert ./my-page
html-convert serve

# Test with sample fixture
html-convert convert test/fixtures/sample --format pdf,epub --output /tmp/out
```

## Adding a new output format
1. Add converter in `src/core/<format>.js` following the `onProgress(pct, label)` pattern
2. Register it in `src/core/converter.js` dispatch block
3. Add the format option in `src/cli/index.js` and `src/cli/interactive.js`
4. Add a format badge in `src/web/public/index.html`
