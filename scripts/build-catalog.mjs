import { resolve } from 'node:path';

import { writeThemeCatalog } from './catalog.mjs';

const root = resolve(import.meta.dirname, '..');
const catalog = await writeThemeCatalog({
  themesRoot: resolve(root, 'themes'),
  jsonPath: resolve(root, 'src/generated/themes.json'),
  publicRoot: resolve(root, 'public'),
});

console.log(`Built gallery catalog for ${catalog.length} themes.`);
