import { input, select, confirm, checkbox } from '@inquirer/prompts';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';
import { printInfo } from './ui.js';

/**
 * Interactive wizard when user runs `html-convert` with no arguments.
 * Returns a resolved options object ready for converter.convert().
 */
export async function runWizard() {
  console.log(chalk.dim('  No arguments provided — launching interactive mode.\n'));

  // Input type
  const inputType = await select({
    message: 'What would you like to convert?',
    choices: [
      { name: 'Single HTML file', value: 'file' },
      { name: 'Folder (with assets, CSS, etc.)', value: 'folder' },
      { name: chalk.cyan('Open Web UI instead'), value: 'web' },
    ],
    theme: { prefix: chalk.cyan('›') },
  });

  if (inputType === 'web') {
    return { action: 'serve' };
  }

  // Input path
  const inputPath = await input({
    message: inputType === 'file' ? 'Path to HTML file:' : 'Path to folder:',
    validate: (val) => {
      const p = resolve(val.trim());
      if (!existsSync(p)) return `Path not found: ${p}`;
      const s = statSync(p);
      if (inputType === 'file' && !s.isFile()) return 'Must be a file';
      if (inputType === 'folder' && !s.isDirectory()) return 'Must be a folder';
      return true;
    },
    theme: { prefix: chalk.cyan('›') },
  });

  // Output formats
  const formatChoices = await checkbox({
    message: 'Output format(s):',
    choices: [
      { name: 'PDF  (full rendering — supports canvas, charts, SVG)', value: 'pdf', checked: true },
      { name: 'EPUB (e-book — text + inlined images)', value: 'epub' },
    ],
    validate: (ans) => ans.length > 0 || 'Select at least one format',
    theme: { prefix: chalk.cyan('›') },
  });

  // Output directory
  const outputDir = await input({
    message: 'Output directory:',
    default: '.',
    theme: { prefix: chalk.cyan('›') },
  });

  // Extra metadata for EPUB
  let title = '';
  let author = '';
  if (formatChoices.includes('epub')) {
    title = await input({
      message: 'Document title (for EPUB metadata):',
      default: '',
      theme: { prefix: chalk.cyan('›') },
    });
    author = await input({
      message: 'Author (for EPUB metadata):',
      default: '',
      theme: { prefix: chalk.cyan('›') },
    });
  }

  // Page format for PDF
  let pageFormat = 'A4';
  if (formatChoices.includes('pdf')) {
    pageFormat = await select({
      message: 'Page format:',
      choices: [
        { name: 'A4  (297 × 210 mm)', value: 'A4' },
        { name: 'Letter (279 × 216 mm)', value: 'Letter' },
        { name: 'Legal (356 × 216 mm)', value: 'Legal' },
        { name: 'A3  (420 × 297 mm)', value: 'A3' },
      ],
      default: 'A4',
      theme: { prefix: chalk.cyan('›') },
    });
  }

  console.log();
  printInfo(`Input: ${resolve(inputPath.trim())}`);
  printInfo(`Formats: ${formatChoices.join(', ')}`);
  printInfo(`Output: ${resolve(outputDir.trim())}`);
  console.log();

  return {
    action: 'convert',
    input: inputPath.trim(),
    formats: formatChoices,
    outputDir: outputDir.trim(),
    title: title.trim(),
    author: author.trim(),
    pageFormat,
  };
}
