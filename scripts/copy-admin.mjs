import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';

await mkdir('dist/admin', { recursive: true });
const html = (await readFile('atelier/public/index.html', 'utf8'))
  .replaceAll('/static/', '/admin/')
  .replace('<body>', '<body data-online="true">');
await writeFile('dist/admin/index.html', html);
for (const name of ['app.js', 'app.css']) await copyFile(`atelier/public/${name}`, `dist/admin/${name}`);
