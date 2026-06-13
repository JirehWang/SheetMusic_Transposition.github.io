import { copyFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDir = resolve('dist');
const nestedIndex = resolve(distDir, 'src/index.html');
const rootIndex = resolve(distDir, 'index.html');

await copyFile(nestedIndex, rootIndex);
await rm(resolve(distDir, 'src'), { recursive: true, force: true });
