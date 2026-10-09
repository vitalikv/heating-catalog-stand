// Снимок рядом «gl2 | стенд» для списка моделей: обе страницы рендерят модель своим
// WebGLRenderer одинаковой камерой на сером фоне, свет — как в каждом проекте.
// Нужны те же gl2, стенд и headless Chrome, что для gl2-compare.mjs.
// Запуск: node scripts/gl2-snapshot.mjs <cases.json> <out.png> [--columns 2] [--tile 300]
//   cases.json: [{ "id": "st_ugol_90_1", "params": { ... } }, ...]

import { readFileSync, writeFileSync } from 'node:fs';

const [casesFile, out, ...rest] = process.argv.slice(2);
const option = (name, fallback) => {
  const index = rest.indexOf(`--${name}`);
  return index >= 0 ? Number(rest[index + 1]) : fallback;
};
const COLUMNS = option('columns', 2);
const TILE = option('tile', 300);
const GL2 = 'http://3d-stroyka/gl2/index.php';
const STAND = 'http://localhost:5199/';
const CDP = 'http://127.0.0.1:9223';
const cases = JSON.parse(readFileSync(casesFile, 'utf8'));

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

// Общая камера: вид спереди-сверху-справа, модель целиком в кадре.
const shoot = `
  const frame = (THREE, box) => {
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    const camera = new THREE.PerspectiveCamera(30, 1, radius / 100, radius * 100);
    const direction = new THREE.Vector3(0.7, 0.6, 1).normalize();
    camera.position.copy(center).addScaledVector(direction, radius / Math.sin((15 * Math.PI) / 180));
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    return camera;
  };
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(${TILE}, ${TILE});
`;

const gl2Expression = `(() => {
  ${shoot}
  return ${JSON.stringify(cases)}.map(({ id, params }) => {
    const cdm = JSON.parse(JSON.stringify(params));
    if (typeof cdm.color === 'string') cdm.color = infProject.material[cdm.color + '_1'];
    // Головка регулировочного крана: в gl2 — termoreg: true или его отсутствие.
    if (cdm.head) { if (cdm.head === 'termo') cdm.termoreg = true; delete cdm.head; }
    const obj = window[id](cdm);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8a9099);
    // Свет gl2: sceneInit.js, initLights.
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    for (const [intensity, x, z] of [[0.7, -1000, 1000], [0.5, -1000, -1000], [0.8, 1000, -1000], [0.2, 1000, 1000]]) {
      const light = new THREE.PointLight(0x222222, intensity, 0);
      light.position.set(x, 200, z);
      scene.add(light);
    }
    const directional = new THREE.DirectionalLight(0xffffff, 0.3);
    directional.position.set(10, 10, 10);
    scene.add(directional);
    scene.add(obj);
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3();
    // Точки разъёмов и бокс-обёртку getBoundObject_1 не рисуем: обёртка — меш с одним материалом.
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    obj.traverse((child) => {
      if (child instanceof PointObj) child.visible = false;
      else if (child.isMesh && Array.isArray(child.material)) box.expandByObject(child);
      else if (child.isMesh) child.material = hidden;
    });
    renderer.render(scene, frame(THREE, box));
    return renderer.domElement.toDataURL('image/png');
  });
})()`;

const standExpression = `(async () => {
  const url = performance.getEntriesByType('resource').map((entry) => entry.name).find((name) => name.includes('/deps/three.js'));
  const THREE = await import(url);
  const lib = await import('/src/lib/index.ts');
  const { fromGl2 } = await import('/src/lib/legacy/gl2.ts');
  const texture = await new THREE.TextureLoader().loadAsync('/textures/rezba_1.png');
  const registry = new lib.GeneratorRegistry();
  const library = new lib.MaterialLibrary(texture);
  ${shoot}
  return ${JSON.stringify(cases)}.map(({ id, params }) => {
    const converted = fromGl2(id, params);
    const model = registry.get(converted.generatorId).build(converted.params);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8a9099);
    scene.add(lib.createModelObject(model, library));
    const { min, max } = model.bounds;
    const camera = frame(THREE, new THREE.Box3(new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(max.x, max.y, max.z)));
    // Свет стенда и редактора: Viewer.ts.
    scene.add(new THREE.AmbientLight(0xffffff, 0.5 * Math.PI));
    const light = new THREE.DirectionalLight(0xffffff, 1.5);
    light.position.set(0, 0.5, 1);
    light.target.position.set(0, 0, -1);
    camera.add(light, light.target);
    scene.add(camera);
    renderer.render(scene, camera);
    const image = renderer.domElement.toDataURL('image/png');
    model.dispose();
    return image;
  });
})()`;

const gl2 = await evaluate(GL2, gl2Expression, 6000);
const stand = await evaluate(STAND, standExpression, 3000);

// Сетка пар: слева gl2, справа стенд, подпись — ID и параметры.
const rows = Math.ceil(cases.length / COLUMNS);
const composeExpression = `(async () => {
  const gl2 = ${JSON.stringify(gl2)};
  const stand = ${JSON.stringify(stand)};
  const cases = ${JSON.stringify(cases)};
  const tile = ${TILE};
  const canvas = document.createElement('canvas');
  canvas.width = ${COLUMNS} * tile * 2;
  canvas.height = ${rows} * tile;
  const context = canvas.getContext('2d');
  const load = (src) => new Promise((resolve) => { const image = new Image(); image.onload = () => resolve(image); image.src = src; });
  for (let i = 0; i < cases.length; i++) {
    const x = (i % ${COLUMNS}) * tile * 2;
    const y = Math.floor(i / ${COLUMNS}) * tile;
    context.drawImage(await load(gl2[i]), x, y);
    context.drawImage(await load(stand[i]), x + tile, y);
    context.strokeStyle = '#ffffff';
    context.strokeRect(x + 0.5, y + 0.5, tile * 2 - 1, tile - 1);
    context.fillStyle = '#ffffff';
    context.font = '13px sans-serif';
    context.fillText('gl2 · ' + cases[i].id, x + 8, y + 18);
    context.fillText('стенд', x + tile + 8, y + 18);
    context.fillText(Object.values(cases[i].params).map((v) => typeof v === 'object' ? Object.values(v).join('×') : v).join(', '), x + 8, y + tile - 10);
  }
  return canvas.toDataURL('image/png');
})()`;

const composed = await evaluate('about:blank', composeExpression, 300);
writeFileSync(out, Buffer.from(composed.split(',')[1], 'base64'));
console.log(`${out}: ${cases.length} моделей`);
