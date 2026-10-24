import { readFile, writeFile } from 'node:fs/promises';
import { renderHomePage } from '../api/public-page.mjs';

const output = new URL('../dist/', import.meta.url);
const shell = await readFile(new URL('index.html', output), 'utf8');

// Vercel serves the static index before rewrites for /. Ship its SEO at build time.
// Other routes and the public-page function use the shell without home content.
await writeFile(new URL('spa-shell.html', output), shell);
await writeFile(new URL('index.html', output), renderHomePage(shell));
