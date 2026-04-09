import puppeteer from 'puppeteer';
import { spawnLocalServer } from './local-server.js';
import { getServeRoot } from '../utils/file-walker.js';
import { relative, dirname } from 'path';
import { stat } from 'fs/promises';

/**
 * Convert an HTML file (or the main HTML file in a folder) to PDF using Puppeteer.
 *
 * @param {object} opts
 * @param {string} opts.inputPath   - Path to HTML file or folder
 * @param {string} opts.outputPath  - Destination .pdf path
 * @param {string} opts.pageFormat  - 'A4' | 'Letter' (default: 'A4')
 * @param {object} opts.margin      - { top, right, bottom, left } (default '20mm' each)
 * @param {Function} opts.onProgress - (pct, label) => void
 */
export async function generatePdf({
  inputPath,
  htmlFile,
  outputPath,
  pageFormat = 'A4',
  margin = { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
  onProgress = () => {},
}) {
  onProgress(5, 'Starting local server...');
  const serveRoot = await getServeRoot(inputPath);
  const server = await spawnLocalServer(serveRoot);

  let browser;
  try {
    onProgress(15, 'Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--enable-webgl',
        '--enable-accelerated-2d-canvas',
        '--disable-dev-shm-usage',
        '--disable-gpu-sandbox',
        '--allow-running-insecure-content',
      ],
    });

    const page = await browser.newPage();

    // Wide viewport so content doesn't wrap unexpectedly
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

    // Determine the URL to navigate to
    const s = await stat(inputPath);
    let url;
    if (s.isFile()) {
      url = server.baseUrl + '/' + relative(serveRoot, htmlFile || inputPath).replace(/\\/g, '/');
    } else {
      // Folder: use the provided htmlFile relative path
      url = server.baseUrl + '/' + relative(serveRoot, htmlFile || inputPath).replace(/\\/g, '/');
    }

    onProgress(30, 'Loading page...');
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 60_000,
    });

    onProgress(55, 'Waiting for renders (canvas, charts, SVG)...');
    // Wait for all canvas elements, images, fonts, and JS-driven charts to fully render
    await page.evaluate(() => {
      return new Promise((resolve) => {
        // Wait for images
        const images = Array.from(document.images);
        const incomplete = images.filter((img) => !img.complete);

        if (incomplete.length === 0) {
          // Give charts/animations a tick to settle
          requestAnimationFrame(() => setTimeout(resolve, 800));
          return;
        }

        let loaded = 0;
        for (const img of incomplete) {
          img.addEventListener('load', () => { if (++loaded === incomplete.length) setTimeout(resolve, 800); });
          img.addEventListener('error', () => { if (++loaded === incomplete.length) setTimeout(resolve, 800); });
        }
      });
    });

    // Extra wait for Chart.js / D3 / Canvas animations
    await page.evaluate(() => new Promise((r) => setTimeout(r, 600)));

    onProgress(75, 'Generating PDF...');
    await page.pdf({
      path: outputPath,
      format: pageFormat,
      margin,
      printBackground: true,
      preferCSSPageSize: false,
    });

    onProgress(95, 'Finalizing...');
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}
