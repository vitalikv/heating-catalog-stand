// Проверка архива пакета на чистой установке — без доступа к исходникам стенда.
// Потребитель — временная папка: архив ставится в неё через npm, three
// подкладывается ссылкой на стенд (сети не нужно). Проверяется:
// - в модуле нет кода three, и объекты сцены строятся из three потребителя;
// - каждый генератор из manifest.json строит модель по своим умолчаниям;
// - текстуры доступны по экспорту пакета;
// - типы проходят tsc у потребителя, а внутренние модули закрыты;
// - в настоящем web worker (headless Chrome) строятся модели, грузятся
//   текстуры и рисуется циферблат — scripts/lib-worker-check.mjs.
// Запуск: npm run build:lib && npm run verify:lib
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInWorker } from './lib-worker-check.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(await readFile(path.join(root, 'lib-package/package.json'), 'utf8'));
const archive = path.join(root, 'dist-lib', `${pkg.name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz`);
const consumer = await mkdtemp(path.join(tmpdir(), 'heating-lib-consumer-'));

const npm = (args) => {
  const npmCli = process.env.npm_execpath;
  return npmCli
    ? execFileSync(process.execPath, [npmCli, ...args], { cwd: consumer, encoding: 'utf8' })
    : execFileSync('npm', args, { cwd: consumer, encoding: 'utf8', shell: true });
};

try {
  await writeFile(path.join(consumer, 'package.json'), JSON.stringify({ name: 'consumer', private: true, type: 'module' }));
  // Peer-зависимости npm поставил бы из сети — их подкладывают ссылками ниже.
  npm(['install', archive, '--offline', '--legacy-peer-deps', '--no-audit', '--no-fund', '--silent']);
  await mkdir(path.join(consumer, 'node_modules/@types'), { recursive: true });
  for (const name of ['three', '@types/three']) {
    await symlink(path.join(root, 'node_modules', name), path.join(consumer, 'node_modules', name), 'junction');
  }
  const installed = path.join(consumer, 'node_modules', pkg.name);

  const source = await readFile(path.join(installed, 'index.js'), 'utf8');
  assert.doesNotMatch(source, /\bREVISION\s*=/, 'в модуль попал код three');
  assert.match(source, /from "three"/);
  console.log('ok: three не входит в модуль');

  await writeFile(path.join(consumer, 'run.mjs'), `
    import { Object3D } from 'three';
    import { readFile } from 'node:fs/promises';
    import { fileURLToPath } from 'node:url';
    import { ASSEMBLY_RECIPES, Assembly, CATALOG, GeneratorRegistry, MaterialLibrary, createModelObject } from '${pkg.name}';
    const manifest = JSON.parse(await readFile(fileURLToPath(import.meta.resolve('${pkg.name}/manifest.json')), 'utf8'));
    const registry = new GeneratorRegistry();
    const materials = new MaterialLibrary();
    const listed = registry.list().map((g) => g.id + '@' + g.version).sort();
    const expected = manifest.generators.map((g) => g.id + '@' + g.version).sort();
    if (JSON.stringify(listed) !== JSON.stringify(expected)) throw new Error('manifest.json расходится с реестром');
    const failed = [];
    for (const generator of registry.list()) {
      const errors = generator.validate(generator.defaults);
      if (errors.length) { failed.push(generator.id + ': ' + errors[0].message); continue; }
      const model = generator.build(generator.defaults);
      const object = createModelObject(model, materials);
      // Объект собран из того же three, что у потребителя: копии движка нет.
      if (!(object instanceof Object3D)) failed.push(generator.id + ': чужой экземпляр three');
      model.dispose();
    }
    const recipes = ASSEMBLY_RECIPES.map((r) => r.id + '@' + r.version).sort();
    const expectedRecipes = manifest.assemblies.map((r) => r.id + '@' + r.version).sort();
    if (JSON.stringify(recipes) !== JSON.stringify(expectedRecipes)) throw new Error('manifest.json расходится с рецептами сборок');
    for (const recipe of ASSEMBLY_RECIPES) {
      const listed = manifest.assemblies.find((r) => r.id === recipe.id);
      const keys = (recipe.variants ?? []).map((v) => v.key);
      if (JSON.stringify(listed?.variants ?? []) !== JSON.stringify(keys)) failed.push(recipe.id + ': исполнения расходятся с manifest.json');
      for (const key of keys.length ? keys : [undefined]) {
        const assembly = new Assembly(registry, recipe.build(key));
        const broken = [...assembly.errors, ...assembly.joints.filter((j) => !j.check.compatible).map((j) => j.label),
          ...assembly.closures.filter((c) => !c.closed).map((c) => c.label)];
        if (broken.length) failed.push(recipe.id + (key ? ' ' + key : '') + ': ' + broken[0]);
        assembly.dispose();
      }
    }
    materials.dispose();
    for (const file of ['rezba_1.png', 'manometr.png', 'termometr.png', 'termomanometr.png']) {
      await readFile(fileURLToPath(import.meta.resolve('${pkg.name}/textures/' + file)));
    }
    let closed = false;
    try { await import('${pkg.name}/generators/GeneratorRegistry.js'); } catch { closed = true; }
    console.log(JSON.stringify({ generators: listed.length, assemblies: recipes.length, catalog: CATALOG.length, failed, closed }));
  `);
  const result = JSON.parse(execFileSync(process.execPath, ['run.mjs'], { cwd: consumer, encoding: 'utf8' }).trim().split('\n').pop());
  assert.deepEqual(result.failed, []);
  assert.equal(result.closed, true, 'внутренний модуль открыт снаружи');
  console.log(`ok: ${result.generators} генераторов строят модели, рецептов сборок: ${result.assemblies}, все собираются, каталог — ${result.catalog} позиций, текстуры на месте`);

  await writeFile(path.join(consumer, 'check.ts'), `
    import { GeneratorRegistry, MaterialLibrary, createModelObject, type ParamSpec, type GeneratedModel } from '${pkg.name}';
    import type { Group } from 'three';
    const registry = new GeneratorRegistry();
    const coupling = registry.get('steel.coupling');
    const model: GeneratedModel = coupling.build(coupling.defaults);
    const specs: readonly ParamSpec[] = coupling.paramSpecs;
    const object: Group = createModelObject(model, new MaterialLibrary());
    // @ts-expect-error — внутренние модули пакета закрыты
    import('${pkg.name}/generators/GeneratorRegistry');
    export { specs, object };
  `);
  // Декларации проверяются целиком (skipLibCheck: false); DOM в lib нужен
  // самому @types/three. Что генераторы обходятся без DOM, проверяет
  // tsconfig.lib.json на стенде.
  await writeFile(path.join(consumer, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true,
      noEmit: true, lib: ['ES2022', 'DOM'], types: [], skipLibCheck: false,
    },
    files: ['check.ts'],
  }));
  execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], { cwd: consumer, stdio: 'inherit' });
  console.log('ok: декларации пакета проходят tsc у потребителя, внутренние модули закрыты');

  const worker = await runInWorker(consumer, pkg.name);
  assert.equal(worker.error, undefined, worker.error);
  assert.deepEqual([worker.document, worker.image], ['undefined', 'undefined'], 'у воркера нашёлся DOM');
  assert.deepEqual(worker.failed, []);
  assert.equal(worker.built, result.generators);
  assert.deepEqual(worker.textures.failed, []);
  assert.equal(worker.textures.loaded.length, 4);
  // Шкала циферблата — тёмные деления и цифры; белый циферблат без карты их не имеет.
  assert.ok(worker.dialTextured > 0.02 && worker.dialTextured > worker.dialPlain * 4,
    `циферблат в воркере без шкалы: ${worker.dialTextured} против ${worker.dialPlain}`);
  console.log(`ok: в web worker ${worker.built} генераторов строят модели, текстуры грузятся,`
    + ` циферблат со шкалой (тёмного ${(worker.dialTextured * 100).toFixed(1)}% против ${(worker.dialPlain * 100).toFixed(1)}%)`);
} finally {
  await rm(consumer, { recursive: true, force: true });
}
