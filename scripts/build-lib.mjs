// Пакет библиотеки генераторов: dist-lib/package и архив npm pack рядом с ним.
// Порядок: ESM-модуль (Vite), декларации (tsc), текстуры, package.json и README
// из lib-package/, manifest.json по собранному модулю, архив.
import { execFileSync } from 'node:child_process';
import { copyFile, cp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'dist-lib');
const pkgDir = path.join(out, 'package');

const run = (file, args) => execFileSync(process.execPath, [path.join(root, file), ...args], { cwd: root, stdio: 'inherit' });

await rm(out, { recursive: true, force: true });
run('node_modules/vite/bin/vite.js', ['build', '--config', 'vite.lib.config.ts', '--logLevel', 'warn']);
run('node_modules/typescript/bin/tsc', ['-p', 'tsconfig.lib-types.json']);

await cp(path.join(root, 'public/textures'), path.join(pkgDir, 'textures'), { recursive: true });
await copyFile(path.join(root, 'lib-package/README.md'), path.join(pkgDir, 'README.md'));
const pkg = JSON.parse(await readFile(path.join(root, 'lib-package/package.json'), 'utf8'));
await writeFile(path.join(pkgDir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

// Список генераторов берётся из собранного модуля, а не из исходников: в архив
// попадает ровно то, что в нём реально зарегистрировано.
const lib = await import(pathToFileURL(path.join(pkgDir, 'index.js')).href);
const three = JSON.parse(await readFile(path.join(root, 'node_modules/three/package.json'), 'utf8'));
const generators = new lib.GeneratorRegistry().list()
  .map((generator) => ({ id: generator.id, version: generator.version }))
  .sort((a, b) => a.id.localeCompare(b.id));
const manifest = { name: pkg.name, version: pkg.version, three: three.version, generators };
await writeFile(path.join(pkgDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

// npm на Windows — cmd-обёртка; при запуске через `npm run` путь к самому npm известен.
const npmCli = process.env.npm_execpath;
const packArgs = ['pack', pkgDir, '--pack-destination', out, '--silent'];
const archive = npmCli
  ? execFileSync(process.execPath, [npmCli, ...packArgs], { cwd: root, encoding: 'utf8' })
  : execFileSync('npm', packArgs, { cwd: root, encoding: 'utf8', shell: true });

const files = await readdir(pkgDir, { recursive: true });
console.log(`${pkg.name}@${pkg.version}: генераторов ${generators.length}, файлов ${files.length}`);
console.log(`архив: ${path.join('dist-lib', archive.trim().split(/\r?\n/).pop())}`);
