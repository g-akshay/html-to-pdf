import { load } from 'cheerio';
import { readFile } from 'fs/promises';
import { resolve as resolvePath, dirname, extname } from 'path';
import { existsSync } from 'fs';
import mime from 'mime-types';

/**
 * Inline all local assets (images, CSS, fonts) into an HTML string for EPUB embedding.
 */
export async function inlineAssets(htmlPath) {
  const dir = dirname(htmlPath);
  const raw = await readFile(htmlPath, 'utf8');
  const $ = load(raw, { decodeEntities: false });

  // Inline images
  const imgEls = $('img[src]').toArray();
  for (const el of imgEls) {
    const src = $(el).attr('src');
    if (!src || src.startsWith('data:') || /^https?:\/\//.test(src)) continue;
    const absPath = resolvePath(dir, src);
    if (!existsSync(absPath)) continue;
    try {
      const buf = await readFile(absPath);
      const mimeType = mime.lookup(absPath) || 'image/png';
      $(el).attr('src', `data:${mimeType};base64,${buf.toString('base64')}`);
    } catch {}
  }

  // Inline stylesheets
  const linkEls = $('link[rel="stylesheet"]').toArray();
  for (const el of linkEls) {
    const href = $(el).attr('href');
    if (!href || /^https?:\/\//.test(href)) continue;
    const cssPath = resolvePath(dir, href);
    if (!existsSync(cssPath)) continue;
    try {
      let css = await readFile(cssPath, 'utf8');
      css = await inlineCssUrls(css, dirname(cssPath));
      $('head').append(`<style>\n${css}\n</style>`);
      $(el).remove();
    } catch {}
  }

  // Inline background images in <style> tags
  const styleTags = $('style').toArray();
  for (const el of styleTags) {
    const css = $(el).html();
    if (css) {
      const inlined = await inlineCssUrls(css, dir);
      $(el).html(inlined);
    }
  }

  // Remove scripts (EPUB readers don't execute JS)
  $('script').remove();

  return $.html();
}

/**
 * Process url(...) references inside CSS, inlining them as base64 data URIs.
 */
async function inlineCssUrls(css, cssDir) {
  const urlPattern = /url\(['"]?([^'")\s]+)['"]?\)/g;
  const replacements = [];

  let match;
  while ((match = urlPattern.exec(css)) !== null) {
    const url = match[1];
    if (url.startsWith('data:') || /^https?:\/\//.test(url) || url.startsWith('#')) continue;
    const absPath = resolvePath(cssDir, url);
    if (!existsSync(absPath)) continue;
    replacements.push({ original: match[0], url, absPath });
  }

  for (const { original, absPath } of replacements) {
    try {
      const buf = await readFile(absPath);
      const mimeType = mime.lookup(absPath) || 'application/octet-stream';
      const dataUri = `data:${mimeType};base64,${buf.toString('base64')}`;
      css = css.replace(original, `url("${dataUri}")`);
    } catch {}
  }

  return css;
}

/**
 * Extract a title from an HTML file (from <title> or first <h1>).
 */
export async function extractTitle(htmlPath) {
  try {
    const raw = await readFile(htmlPath, 'utf8');
    const $ = load(raw);
    const title = $('title').text().trim() || $('h1').first().text().trim();
    return title || 'Untitled';
  } catch {
    return 'Untitled';
  }
}
