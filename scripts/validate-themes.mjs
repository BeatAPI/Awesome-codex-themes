import { resolve } from 'node:path';

import { buildThemeCatalog } from './catalog.mjs';

const catalog = await buildThemeCatalog(resolve(import.meta.dirname, '../themes'));
if (catalog.length === 0) throw new Error('At least one valid theme package is required.');
console.log(`Validated ${catalog.length} theme packages.`);
