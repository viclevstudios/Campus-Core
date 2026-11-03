import { mkdir, copyFile } from 'node:fs/promises';

export async function prepareAssets() {
  await mkdir('public/vendor', { recursive: true });
  await copyFile('node_modules/ical.js/dist/ical.js', 'public/vendor/ical.js');
  await copyFile('node_modules/ical.js/LICENSE', 'public/vendor/LICENSE-ical.js.txt');
  await mkdir('public/fonts', { recursive: true });
  for (const weight of [400, 500, 600]) {
    await copyFile(`node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-${weight}-normal.woff2`, `public/fonts/ibm-plex-sans-${weight}.woff2`);
  }
  await copyFile('node_modules/@fontsource/ibm-plex-sans/LICENSE', 'public/fonts/LICENSE.txt');
}
