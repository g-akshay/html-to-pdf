import { writeFile } from 'fs/promises';
import { inlineAssets, extractTitle } from './asset-processor.js';

/**
 * Generate an EPUB from one or more HTML files.
 *
 * @param {object} opts
 * @param {Array<{path: string, relativePath: string}>} opts.htmlFiles
 * @param {string} opts.outputPath
 * @param {string} opts.title
 * @param {string} opts.author
 * @param {Function} opts.onProgress - (pct, label) => void
 */
export async function generateEpub({
  htmlFiles,
  outputPath,
  title = 'Converted Document',
  author = 'html-convert',
  onProgress = () => {},
}) {
  onProgress(10, 'Processing HTML assets...');

  const chapters = [];
  const total = htmlFiles.length;

  for (let i = 0; i < htmlFiles.length; i++) {
    const f = htmlFiles[i];
    const pct = 10 + Math.round((i / total) * 50);
    const chapterTitle = await extractTitle(f.path);
    onProgress(pct, `Inlining assets: ${f.relativePath}`);

    const content = await inlineAssets(f.path);
    chapters.push({ title: chapterTitle, content });
  }

  onProgress(65, 'Building EPUB structure...');

  const epubOptions = {
    title,
    author,
    tocTitle: 'Table of Contents',
    lang: 'en',
    content: chapters,
  };

  onProgress(75, 'Generating EPUB...');

  let buffer;
  // epub-gen-memory: EPub(options, chapters[]) — chapters use { title, content } (not data)
  const epubModule2 = await import('epub-gen-memory');
  const EPubClass = epubModule2.EPub || epubModule2.default;
  const epub = new EPubClass(epubOptions, chapters);
  buffer = await epub.genEpub();

  onProgress(90, 'Writing file...');
  await writeFile(outputPath, buffer);
  onProgress(98, 'Done');
}
