import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import figlet from 'figlet';
import ora from 'ora';

const BRAND_GRADIENT = gradient(['#6EE7F7', '#A78BFA', '#F472B6']);

export function printHeader() {
  const art = figlet.textSync('HTML → PDF', {
    font: 'Small',
    horizontalLayout: 'default',
  });

  const styledArt = BRAND_GRADIENT(art);
  const subtitle = chalk.dim('  Convert HTML files & folders to PDF and EPUB\n');

  console.log(
    boxen(`${styledArt}\n${subtitle}`, {
      padding: { top: 0, bottom: 0, left: 2, right: 2 },
      borderStyle: 'round',
      borderColor: 'cyan',
      dimBorder: true,
    })
  );
  console.log();
}

export function printSuccess(msg) {
  console.log(chalk.green('  ✓ ') + chalk.white(msg));
}

export function printError(msg, err) {
  const body = err
    ? `${chalk.red.bold(msg)}\n\n${chalk.dim(err.stack || err.message)}`
    : chalk.red.bold(msg);

  console.error(
    boxen(body, {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'red',
      title: chalk.red.bold(' Error '),
      titleAlignment: 'left',
    })
  );
}

export function printInfo(msg) {
  console.log(chalk.cyan('  › ') + chalk.dim(msg));
}

export function printWarning(msg) {
  console.log(chalk.yellow('  ⚠ ') + chalk.yellow(msg));
}

export function createSpinner(text) {
  return ora({
    text: chalk.cyan(text),
    color: 'cyan',
    spinner: 'dots',
    indent: 2,
  });
}

export function printSummary(results) {
  if (!results || results.length === 0) return;

  const rows = results.map((r) => {
    const sizeKb = (r.size / 1024).toFixed(1);
    const sizeMb = r.size > 1024 * 1024 ? `${(r.size / 1024 / 1024).toFixed(2)} MB` : `${sizeKb} KB`;
    return `  ${chalk.green('✓')} ${chalk.bold(r.format.toUpperCase().padEnd(5))}  ${chalk.white(r.outputPath)}\n         ${chalk.dim(`${sizeMb}`)}`;
  });

  const content = rows.join('\n\n');

  console.log(
    boxen(content, {
      title: chalk.cyan.bold(' Conversion Complete '),
      titleAlignment: 'center',
      padding: 1,
      borderStyle: 'round',
      borderColor: 'green',
      margin: { top: 1, bottom: 1 },
    })
  );
}

export function printFormatBadge(format) {
  const colors = { pdf: 'red', epub: 'blue' };
  const color = colors[format] || 'white';
  return chalk[color].bold(` ${format.toUpperCase()} `);
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
