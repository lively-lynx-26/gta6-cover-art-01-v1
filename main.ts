// main.ts — entry program for gta6-cover-art-01 ("Solmar Bay Cover Studio").
// Copies app/ and screenshots/ into the output directory (default absolute
// /output, MAKEFUN_OUTPUT_DIR as the fallback) and writes /output/dossier.json
// with buildDossier from the kit's vendor/makefun-app.ts. Standard library
// only. The program runs twice and its output is byte-identical.
//
// The output directory is never deleted or recreated: in the grader /output
// is a bind mount, and removing it breaks the run. Directories inside it are
// created as needed and files are copied over them; stale files from an
// earlier run are left alone.

import { buildDossier } from './vendor/makefun-app.ts';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// The repository root: this file's own directory, never process.cwd() (the
// grader runs from /). new URL('.', import.meta.url) is already the directory
// holding this file; do not dirname() it again.
const repoDir = fileURLToPath(new URL('.', import.meta.url));

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// Copy app/ and screenshots/ into the output directory. cpSync copies
// recursively and overwrites; the output directory itself is only created,
// never removed.
mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'app'), join(outDir, 'app'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  }),
);

console.log(`dossier written to ${join(outDir, 'dossier.json')}`);
