import { build } from 'esbuild';
import { mkdir, readdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'browser-extension/dist');
await mkdir(output, { recursive: true });
for (const name of ['manifest.json', 'worker.js', 'bridge.js', 'popup.html', 'popup.css', 'popup.js']) {
  await copyFile(path.join(root, 'browser-extension', name), path.join(output, name));
}
await build({ entryPoints: [path.join(root, 'src/utils/linkImport.ts')], outfile: path.join(output, 'link-import.js'), bundle: true, format: 'esm', target: 'chrome110' });
await build({ entryPoints: [path.join(root, 'browser-extension/extract.ts')], outfile: path.join(output, 'extract.js'), bundle: true, format: 'iife', target: 'chrome110' });

// Small, uncompressed ZIP: no extra dependency or platform-specific archiver needed.
const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const locals = [], directory = [];
let offset = 0;
for (const name of (await readdir(output)).sort()) {
  const bytes = await readFile(path.join(output, name)), filename = Buffer.from(name);
  const crc = crc32(bytes);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(bytes.length, 18); header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(filename.length, 26);
  locals.push(header, filename, bytes);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(bytes.length, 20); central.writeUInt32LE(bytes.length, 24);
  central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
  directory.push(central, filename); offset += header.length + filename.length + bytes.length;
}
const central = Buffer.concat(directory), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(directory.length / 2, 8); end.writeUInt16LE(directory.length / 2, 10);
end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
await mkdir(path.join(root, 'public'), { recursive: true });
await writeFile(path.join(root, 'public/link-import-extension.zip'), Buffer.concat([...locals, central, end]));
console.log('Расширение: browser-extension/dist; архив: public/link-import-extension.zip');
