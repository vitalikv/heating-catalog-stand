// Сверка генераторов стенда с gl2: для каждого набора stand/presets.ts строит модель
// в gl2 и на стенде и сравнивает габариты, число треугольников и число разъёмов.
//
// Нужны: gl2 в OpenServer, стенд `npx vite --port 5199` и headless Chrome с CDP:
//   chrome.exe --headless=new --remote-debugging-port=9223 --enable-unsafe-swiftshader
//     --user-data-dir=<временная папка> about:blank
// Запуск: node scripts/gl2-compare.mjs [--only st_ugol_90_1,pl_mufta_1] [--out report.json]
//   [--fixture tests/fixtures/gl2-reference.json]
//   [--gl2 http://3d-stroyka/gl2/index.php] [--stand http://localhost:5199/] [--cdp 9223]
// --fixture записывает эталон gl2 (название, треугольники, габарит) для теста gl2Reference.

import { writeFileSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
const GL2 = args.gl2 ?? 'http://3d-stroyka/gl2/index.php';
const STAND = args.stand ?? 'http://localhost:5199/';
const CDP = `http://127.0.0.1:${args.cdp ?? 9223}`;
const ONLY = args.only ? args.only.split(',') : null;
/** Допуск габаритов, м. */
const TOLERANCE = 1e-6;

async function evaluate(url, expression, waitMs) {
  const target = await (await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const i = ++id;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  try {
    await send('Page.enable');
    await send('Page.navigate', { url });
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    const { result, exceptionDetails } = response.result;
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  } finally {
    await fetch(`${CDP}/json/close/${target.id}`);
    ws.close();
  }
}

// На стенде: наборы, габариты, треугольники и разъёмы моделей.
const standExpression = `(async () => {
  const lib = await import('/src/lib/index.ts');
  const { STAND_PRESETS } = await import('/src/stand/presets.ts');
  const registry = new lib.GeneratorRegistry(new lib.MaterialLibrary());
  const only = ${JSON.stringify(ONLY)};
  const cases = [];
  for (const generator of registry.list()) {
    if (only && !only.includes(generator.id)) continue;
    const entry = STAND_PRESETS.find((presets) => presets.generatorId === generator.id);
    for (const preset of entry?.presets ?? []) {
      const model = generator.build(preset.params);
      let triangles = 0;
      model.root.traverse((object) => { if (object.isMesh) triangles += object.geometry.getAttribute('position').count / 3; });
      cases.push({
        id: generator.id, label: preset.label, params: preset.params, title: model.title, triangles,
        bounds: { min: model.bounds.min.toArray(), max: model.bounds.max.toArray() },
        connectors: model.connectors.map((c) => ({ id: c.id, position: [c.position.x, c.position.y, c.position.z] })),
      });
      model.dispose();
    }
  }
  return cases;
})()`;

const stand = await evaluate(STAND, standExpression, 3000);

// В gl2: те же параметры через window[имя](cdm). Цвет коллектора — ключ материала gl2.
const gl2Expression = `(() => {
  const cases = ${JSON.stringify(stand.map(({ id, params }) => ({ id, params })))};
  return cases.map(({ id, params }) => {
    try {
      const cdm = JSON.parse(JSON.stringify(params));
      if (typeof cdm.color === 'string') cdm.color = infProject.material[cdm.color + '_1'];
      // Головка регулировочного крана: в gl2 — termoreg: true или его отсутствие.
      if (cdm.head) { if (cdm.head === 'termo') cdm.termoreg = true; delete cdm.head; }
      const obj = window[id](cdm);
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3();
      let triangles = 0;
      const points = [];
      obj.traverse((child) => {
        if (child instanceof PointObj) {
          const p = child.getWorldPosition(new THREE.Vector3());
          points.push([p.x, p.y, p.z]);
        } else if (child.isMesh && Array.isArray(child.material)) {
          box.expandByObject(child);
          const g = child.geometry;
          triangles += g.faces ? g.faces.length : (g.index ? g.index.count : g.attributes.position.count) / 3;
        }
      });
      return { title: obj.userData.obj3D?.nameRus, triangles, points, bounds: { min: box.min.toArray(), max: box.max.toArray() } };
    } catch (error) {
      return { error: String(error) };
    }
  });
})()`;

const gl2 = await evaluate(GL2, gl2Expression, 6000);

const report = stand.map((s, i) => {
  const g = gl2[i];
  if (g.error) return { ...s, gl2: g, ok: false, problems: [`gl2: ${g.error}`] };
  const problems = [];
  const delta = Math.max(...[0, 1, 2].flatMap((k) => [Math.abs(s.bounds.min[k] - g.bounds.min[k]), Math.abs(s.bounds.max[k] - g.bounds.max[k])]));
  if (delta > TOLERANCE) problems.push(`габарит: расхождение ${(delta * 1000).toFixed(4)} мм`);
  if (s.triangles !== g.triangles) problems.push(`треугольники: стенд ${s.triangles}, gl2 ${g.triangles}`);
  if (s.connectors.length !== g.points.length) problems.push(`разъёмы: стенд ${s.connectors.length}, gl2 ${g.points.length}`);
  return { ...s, gl2: g, boundsDelta: delta, ok: problems.length === 0, problems };
});

const byGenerator = new Map();
for (const row of report) byGenerator.set(row.id, [...(byGenerator.get(row.id) ?? []), row]);
for (const [id, rows] of byGenerator) {
  const bad = rows.filter((row) => !row.ok);
  console.log(`${bad.length === 0 ? 'OK  ' : 'DIFF'} ${id}: ${rows.length - bad.length}/${rows.length}`);
  for (const row of bad) console.log(`       ${row.label}: ${row.problems.join('; ')}`);
}
if (args.out) writeFileSync(args.out, JSON.stringify(report, null, 2));
if (args.fixture) {
  const round = (values) => values.map((value) => Math.round(value * 1e9) / 1e9);
  const reference = report
    .filter((row) => !row.gl2.error)
    .map(({ id, params, gl2: g }) => ({
      id,
      params,
      title: g.title,
      triangles: g.triangles,
      connectors: g.points.length,
      bounds: { min: round(g.bounds.min), max: round(g.bounds.max) },
    }));
  // Одна запись на строку: диф фикстуры читается по наборам.
  writeFileSync(args.fixture, `[\n${reference.map((row) => JSON.stringify(row)).join(',\n')}\n]\n`);
}
