import { resolve, join, basename, extname, dirname } from 'path';
import { mkdirSync, statSync } from 'fs';
import { collectHtmlFiles } from '../utils/file-walker.js';
import { generatePdf } from './pdf.js';
import { generateEpub } from './epub.js';

/**
 * Main conversion orchestrator.
 *
 * @param {object} opts
 * @param {string}   opts.input      - HTML file or folder path
 * @param {string[]} opts.formats    - ['pdf'] | ['epub'] | ['pdf','epub']
 * @param {string}   opts.outputDir  - Where to write output files
 * @param {string}   [opts.title]    - Document title (for EPUB metadata)
 * @param {string}   [opts.author]   - Author (for EPUB metadata)
 * @param {string}   [opts.pageFormat] - 'A4' | 'Letter'
 * @param {Function} [opts.onProgress] - ({ format, pct, label }) => void
 *
 * @returns {Promise<Array<{format, outputPath, size}>>}
 */
export async function convert({
  input,
  formats = ['pdf'],
  outputDir,
  title,
  author = 'html-convert',
  pageFormat = 'A4',
  onProgress = () => {},
}) {
  const inputPath = resolve(input);
  const outDir = resolve(outputDir || dirname(inputPath));
  mkdirSync(outDir, { recursive: true });

  // Infer document title from folder/file name if not provided
  const inputStat = statSync(inputPath);
  const baseName = basename(inputPath, extname(inputPath));
  const docTitle = title || (inputStat.isDirectory() ? basename(inputPath) : baseName);

  const htmlFiles = await collectHtmlFiles(inputPath);
  const results = [];

  for (const format of formats) {
    const outFileName = `${docTitle}.${format}`;
    const outputPath = join(outDir, outFileName);

    const progress = (pct, label) => onProgress({ format, pct, label });

    if (format === 'pdf') {
      // For PDF: convert each HTML file to a separate PDF (or first file if single)
      if (htmlFiles.length === 1) {
        await generatePdf({
          inputPath,
          htmlFile: htmlFiles[0].path,
          outputPath,
          pageFormat,
          onProgress: progress,
        });
      } else {
        // Multiple HTML files: generate one PDF per file, then note them
        for (const f of htmlFiles) {
          const fBase = basename(f.path, extname(f.path));
          const fOut = join(outDir, `${docTitle}-${fBase}.pdf`);
          await generatePdf({
            inputPath,
            htmlFile: f.path,
            outputPath: fOut,
            pageFormat,
            onProgress: progress,
          });
          const { size } = statSync(fOut);
          results.push({ format, outputPath: fOut, size });
        }
        continue;
      }
    } else if (format === 'epub') {
      await generateEpub({
        htmlFiles,
        outputPath,
        title: docTitle,
        author,
        onProgress: progress,
      });
    } else {
      throw new Error(`Unknown format: ${format}`);
    }

    const { size } = statSync(outputPath);
    results.push({ format, outputPath, size });
  }

  return results;
}
