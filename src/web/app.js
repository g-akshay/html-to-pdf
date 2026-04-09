import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import multer from 'multer';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { convert } from '../core/converter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, 'public');

// In-memory job store: jobId → { status, outputFiles, error }
const jobs = new Map();

/**
 * Start the web UI server.
 * @returns {Promise<{url: string, server: http.Server}>}
 */
export async function startWebServer({ port = 3000 } = {}) {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketServer(httpServer, { cors: { origin: '*' } });

  // ── Socket.io ────────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    socket.on('join', (jobId) => {
      socket.join(jobId);
      // If job already finished, replay the result
      const job = jobs.get(jobId);
      if (job) {
        socket.emit('job:update', { jobId, ...job });
      }
    });
  });

  // ── Multer: reconstruct folder structure ─────────────────────────────────
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // originalname carries the relative path sent from the client
      const relDir = dirname(file.originalname);
      const destDir = join(req.uploadRoot, relDir);
      mkdirSync(destDir, { recursive: true });
      cb(null, destDir);
    },
    filename: (req, file, cb) => cb(null, basename(file.originalname)),
  });

  const upload = multer({ storage });

  // ── Static files ─────────────────────────────────────────────────────────
  app.use(express.static(PUBLIC_DIR));
  app.use(express.json());

  // ── POST /api/convert ────────────────────────────────────────────────────
  app.post('/api/convert', (req, res, next) => {
    // Attach a per-request upload root before multer runs
    req.uploadRoot = join(tmpdir(), `html-convert-upload-${uuidv4()}`);
    mkdirSync(req.uploadRoot, { recursive: true });
    next();
  }, upload.array('files'), async (req, res) => {
    const jobId = uuidv4();
    const { format = 'pdf', title = '', author = 'html-convert', pageFormat = 'A4' } = req.body;
    const formats = format.split(',').map((f) => f.trim().toLowerCase()).filter(Boolean);
    const uploadRoot = req.uploadRoot;

    // Output directory for this job
    const outputDir = join(tmpdir(), `html-convert-output-${jobId}`);
    mkdirSync(outputDir, { recursive: true });

    jobs.set(jobId, { status: 'running', outputFiles: [], error: null });
    res.json({ jobId });

    // Run conversion asynchronously
    setImmediate(async () => {
      try {
        const results = await convert({
          input: uploadRoot,
          formats,
          outputDir,
          title,
          author,
          pageFormat,
          onProgress: ({ format: fmt, pct, label }) => {
            io.to(jobId).emit('job:progress', { jobId, format: fmt, pct, label });
          },
        });

        const outputFiles = results.map((r) => ({
          format: r.format,
          filename: basename(r.outputPath),
          size: r.size,
          downloadUrl: `/api/download/${jobId}/${basename(r.outputPath)}`,
        }));

        jobs.set(jobId, { status: 'done', outputFiles, error: null });
        io.to(jobId).emit('job:done', { jobId, outputFiles });
      } catch (err) {
        jobs.set(jobId, { status: 'error', outputFiles: [], error: err.message });
        io.to(jobId).emit('job:error', { jobId, error: err.message });
      } finally {
        // Clean up upload folder after a delay
        setTimeout(() => {
          try { rmSync(uploadRoot, { recursive: true, force: true }); } catch {}
        }, 5000);
      }
    });
  });

  // ── GET /api/download/:jobId/:filename ───────────────────────────────────
  app.get('/api/download/:jobId/:filename', (req, res) => {
    const { jobId, filename } = req.params;
    const filePath = join(tmpdir(), `html-convert-output-${jobId}`, filename);
    try {
      statSync(filePath);
      res.download(filePath, filename);
    } catch {
      res.status(404).json({ error: 'File not found or expired' });
    }
  });

  // ── GET /api/status/:jobId ───────────────────────────────────────────────
  app.get('/api/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ jobId: req.params.jobId, ...job });
  });

  // ── Start listening ──────────────────────────────────────────────────────
  await new Promise((resolve, reject) => {
    httpServer.listen(port, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const url = `http://localhost:${port}`;
  return { url, server: httpServer };
}
