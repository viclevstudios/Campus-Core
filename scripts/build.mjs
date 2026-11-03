import { mkdir, cp } from 'node:fs/promises';
import { prepareAssets } from './prepare-assets.mjs';
await prepareAssets();
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
console.log('Fertig: dist/ enthält die vollständige statische Web-App.');
