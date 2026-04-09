import { stat, readdir } from 'fs/promises';
import { join, extname, basename, relative } from 'path';

const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '__pycache__', '.DS_Store']);
const HTML_EXTS = new Set(['.html', '.htm']);

/**
 * Collect all HTML files from a path (file or folder).
 * Returns array of { path, relativePath } sorted logically.
 */
export async function collectHtmlFiles(inputPath) {
  const s = await stat(inputPath);

  if (s.isFile()) {
    if (!HTML_EXTS.has(extname(inputPath).toLowerCase())) {
      throw new Error(`File must be an HTML file: ${inputPath}`);
    }
    return [{ path: inputPath, relativePath: basename(inputPath) }];
  }

  if (s.isDirectory()) {
    const files = [];
    await walk(inputPath, inputPath, files);
    files.sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true }));
    if (files.length === 0) {
      throw new Error(`No HTML files found in folder: ${inputPath}`);
    }
    return files;
  }

  throw new Error(`Invalid input path: ${inputPath}`);
}

async function walk(dir, rootDir, results) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, rootDir, results);
    } else if (entry.isFile() && HTML_EXTS.has(extname(entry.name).toLowerCase())) {
      results.push({
        path: fullPath,
        relativePath: relative(rootDir, fullPath),
      });
    }
  }
}

/**
 * Get the root directory for serving (parent dir for single file, the dir itself for folders).
 */
export async function getServeRoot(inputPath) {
  const s = await stat(inputPath);
  if (s.isFile()) {
    const { dirname } = await import('path');
    return dirname(inputPath);
  }
  return inputPath;
}
