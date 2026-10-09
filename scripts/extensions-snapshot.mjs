// Снимки новых моделей на локальном стенде. Node 22+, Vite :5199, headless Chrome CDP :9225.
// node scripts/extensions-snapshot.mjs [out.png]
import { writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'docs/img/catalog-extensions.png';
const cdp = 'http://127.0.0.1:9225';
const target = await (await fetch(`${cdp}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let serial = 0;
const pending = new Map();
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  pending.get(message.id)?.(message);
  pending.delete(message.id);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++serial;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
  pending.set(id, (response) => { clearTimeout(timer); response.error ? reject(new Error(JSON.stringify(response.error))) : resolve(response.result); });
  ws.send(JSON.stringify({ id, method, params }));
});
try {
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:5199/' });
  // Дождаться загрузки модулей стенда, чтобы использовать тот же экземпляр Three.js.
  let ready = false;
  for (let i = 0; i < 50; i++) {
    const response = await send('Runtime.evaluate', { expression: `performance.getEntriesByType('resource').some(e => e.name.includes('/deps/three.js'))`, returnByValue: true });
    if (response.result.value) { ready = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Стенд не загрузил Three.js');
  const response = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const lib = await import('/src/lib/index.ts');
    const { EXTENSION_CATALOG } = await import('/src/lib/catalog/extensions.ts');
    const url = performance.getEntriesByType('resource').find(e => e.name.includes('/deps/three.js')).name;
    const THREE = await import(url);
    const registry = new lib.GeneratorRegistry();
    const materials = new lib.MaterialLibrary();
    materials.setThreadTexture(await new THREE.TextureLoader().loadAsync('/textures/rezba_1.png'));
    const cases = EXTENSION_CATALOG.map(entry => ({ id: entry.generatorId, params: registry.get(entry.generatorId).defaults }));
    for (const id of ['steel.union', 'valve.lockshield', 'valve.radiator-h-block']) {
      const defaults = registry.get(id).defaults;
      cases.push({ id, params: { ...defaults, configuration: defaults.configuration === 'angle' ? 'straight' : 'angle' } });
    }
    cases.push({ id: 'valve.thermostatic-angle', params: { ...registry.get('valve.thermostatic-angle').defaults, head: 'cap' } });
    const width = 360, height = 340, columns = 4;
    const canvas = document.createElement('canvas');
    canvas.width = width * columns; canvas.height = height * Math.ceil(cases.length / columns);
    const context = canvas.getContext('2d');
    context.fillStyle = '#edf0f2'; context.fillRect(0, 0, canvas.width, canvas.height);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height - 55);
    for (let i = 0; i < cases.length; i++) {
      const { id, params } = cases[i];
      const model = registry.get(id).build(params);
      const object = lib.createModelObject(model, materials);
      const scene = new THREE.Scene(); scene.background = new THREE.Color(0xedf0f2); scene.add(object);
      scene.add(new THREE.AmbientLight(0xffffff, Math.PI * 0.5));
      const light = new THREE.DirectionalLight(0xffffff, 1.5); light.position.set(2, 3, 4); scene.add(light);
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const radius = box.getSize(new THREE.Vector3()).length() / 2;
      const camera = new THREE.PerspectiveCamera(30, width / (height - 55), radius / 100, radius * 100);
      camera.position.copy(center).addScaledVector(new THREE.Vector3(0.7, 0.55, 1).normalize(), radius / Math.sin(Math.PI / 12));
      camera.lookAt(center); renderer.render(scene, camera);
      const x = (i % columns) * width, y = Math.floor(i / columns) * height;
      context.drawImage(renderer.domElement, x, y + 50);
      context.fillStyle = '#172b3a'; context.font = 'bold 14px Arial'; context.fillText(model.title, x + 12, y + 22, width - 24);
      context.fillStyle = '#536676'; context.font = '12px Arial'; context.fillText(id, x + 12, y + 42);
      model.dispose();
    }
    renderer.dispose(); materials.dispose();
    return canvas.toDataURL('image/png');
  })()` });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  writeFileSync(out, Buffer.from(response.result.value.split(',')[1], 'base64'));
  console.log(out);
} finally {
  await fetch(`${cdp}/json/close/${target.id}`).catch(() => {});
  ws.close();
}
