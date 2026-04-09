import { Command } from 'commander';
import chalk from 'chalk';
import { printHeader, printError, printInfo, printSuccess, printSummary, createSpinner } from './ui.js';
import { runWizard } from './interactive.js';
import { convert } from '../core/converter.js';
import { startWebServer } from '../web/app.js';

export async function run() {
  const program = new Command();

  program
    .name('html-convert')
    .description('Convert HTML files/folders to PDF and EPUB')
    .version('1.0.0')
    .hook('preAction', () => {
      printHeader();
    });

  // ── convert command ──────────────────────────────────────────────────────
  program
    .command('convert <input>')
    .description('Convert an HTML file or folder to PDF/EPUB')
    .option('-f, --format <formats>', 'Output format(s): pdf, epub, or both (comma-separated)', 'pdf')
    .option('-o, --output <dir>', 'Output directory (default: same as input)')
    .option('-t, --title <title>', 'Document title (used in EPUB metadata and filename)')
    .option('-a, --author <author>', 'Author name for EPUB metadata', 'html-convert')
    .option('-p, --page-format <format>', 'PDF page format: A4, Letter, Legal, A3', 'A4')
    .action(async (input, opts) => {
      const formats = opts.format
        .split(',')
        .map((f) => f.trim().toLowerCase())
        .filter((f) => ['pdf', 'epub'].includes(f));

      if (formats.length === 0) {
        printError('Invalid format. Use: pdf, epub, or pdf,epub');
        process.exit(1);
      }

      await runConvert({
        input,
        formats,
        outputDir: opts.output,
        title: opts.title || '',
        author: opts.author,
        pageFormat: opts.pageFormat,
      });
    });

  // ── serve command ────────────────────────────────────────────────────────
  program
    .command('serve')
    .description('Start the web UI for drag-and-drop conversion')
    .option('-p, --port <port>', 'Port to listen on', '3000')
    .option('--no-open', 'Do not open browser automatically')
    .action(async (opts) => {
      await runServe({ port: parseInt(opts.port, 10), openBrowser: opts.open });
    });

  // If no command given, run interactive wizard
  if (process.argv.length <= 2) {
    printHeader();
    const wizardResult = await runWizard();

    if (wizardResult.action === 'serve') {
      await runServe({ port: 3000, openBrowser: true });
    } else if (wizardResult.action === 'convert') {
      await runConvert(wizardResult);
    }
    return;
  }

  await program.parseAsync(process.argv);
}

async function runConvert({ input, formats, outputDir, title, author, pageFormat }) {
  const spinner = createSpinner('Preparing conversion...');
  spinner.start();

  let results;
  try {
    results = await convert({
      input,
      formats,
      outputDir,
      title,
      author,
      pageFormat,
      onProgress: ({ format, pct, label }) => {
        spinner.text = chalk.cyan(`[${format.toUpperCase()}] ${label} ${chalk.dim(`(${pct}%)`)}`);
      },
    });

    spinner.succeed(chalk.green('Conversion complete!'));
  } catch (err) {
    spinner.fail(chalk.red('Conversion failed'));
    printError(err.message, err);
    process.exit(1);
  }

  printSummary(results);
}

async function runServe({ port, openBrowser }) {
  const spinner = createSpinner(`Starting web server on port ${port}...`);
  spinner.start();

  try {
    const { url } = await startWebServer({ port });
    spinner.succeed(chalk.green(`Web UI running at ${chalk.cyan.underline(url)}`));
    printInfo('Drop HTML files or folders to convert them');
    printInfo('Press Ctrl+C to stop');

    if (openBrowser) {
      const { default: open } = await import('open');
      await open(url);
    }

    // Keep process alive
    await new Promise(() => {});
  } catch (err) {
    spinner.fail(chalk.red('Failed to start server'));
    printError(err.message, err);
    process.exit(1);
  }
}
