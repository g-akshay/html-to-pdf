import express from 'express';
import { createServer } from 'http';

/**
 * Spawn a local HTTP server serving a folder.
 * Uses port 0 so the OS picks a free port.
 * Returns { baseUrl, close }.
 */
export async function spawnLocalServer(folderPath) {
  const app = express();
  app.use(express.static(folderPath, {
    dotfiles: 'allow',
    setHeaders: (res) => {
      // Allow cross-origin requests so canvas/WebGL don't get tainted
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    },
  }));

  const httpServer = createServer(app);

  await new Promise((resolve, reject) => {
    httpServer.listen(0, '127.0.0.1', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const { port } = httpServer.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    close: () => new Promise((resolve) => httpServer.close(resolve)),
  };
}
