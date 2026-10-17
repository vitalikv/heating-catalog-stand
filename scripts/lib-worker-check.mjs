// Пакет в настоящем web worker: headless Chrome открывает страницу, она
// запускает module worker, и тот работает с пакетом так же, как воркер сцены
// редактора — без DOM. В воркере:
// - каждый генератор строит модель, createModelObject собирает объект;
// - текстуры грузятся loadMaterialTextures (ImageBitmapLoader);
// - манометр рисуется на OffscreenCanvas с картой и без неё: на циферблате
//   с картой есть тёмные деления шкалы, на белом — нет.
//
// Файлы отдаёт маленький сервер из папки потребителя. Import map в воркере
// не работает, поэтому голые импорты ('three', имя пакета) сервер переписывает
// на пути в node_modules — как это сделал бы сборщик.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.json': 'application/json' };

const PAGE = `<!doctype html><meta charset="utf-8"><script type="module">
  const worker = new Worker('/worker.js', { type: 'module' });
  worker.onmessage = (event) => { window.__result = event.data; };
  worker.onerror = (event) => { window.__result = { error: event.message || 'ошибка загрузки воркера' }; };
</script>`;

function workerSource(packageName) {
  return `
import { GeneratorRegistry, MaterialLibrary, createModelObject, loadMaterialTextures } from '${packageName}';
import { AmbientLight, Color, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';

const result = { document: typeof document, image: typeof Image, built: 0, failed: [] };
try {
  const materials = new MaterialLibrary();
  result.textures = await loadMaterialTextures(materials, (file) => '/node_modules/${packageName}/textures/' + file);
  const registry = new GeneratorRegistry();
  for (const generator of registry.list()) {
    try {
      const model = generator.build(generator.defaults);
      createModelObject(model, materials);
      model.dispose();
      result.built++;
    } catch (error) {
      result.failed.push(generator.id + ': ' + error.message);
    }
  }

  // Манометр анфас: доля тёмных пикселей в середине циферблата.
  const size = 160;
  const renderer = new WebGLRenderer({ canvas: new OffscreenCanvas(size, size) });
  const gauge = registry.get('equipment.gauge').build(registry.get('equipment.gauge').defaults);
  const { min, max } = gauge.bounds;
  const center = new Vector3((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
  const radius = new Vector3(max.x - min.x, max.y - min.y, max.z - min.z).length() / 2;
  const camera = new PerspectiveCamera(35, 1, radius / 100, radius * 100);
  camera.position.copy(center).add(new Vector3(0, 0, radius * 3.2));
  camera.lookAt(center);
  const darkShare = (library) => {
    const scene = new Scene();
    scene.background = new Color(0x808080);
    scene.add(new AmbientLight(0xffffff, 3));
    scene.add(createModelObject(gauge, library));
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const pixels = new Uint8Array(size * size * 4);
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let dark = 0, total = 0;
    for (let y = size * 0.35; y < size * 0.65; y++) {
      for (let x = size * 0.35; x < size * 0.65; x++) {
        const i = (Math.floor(y) * size + Math.floor(x)) * 4;
        total++;
        if (pixels[i] + pixels[i + 1] + pixels[i + 2] < 240) dark++;
      }
    }
    return dark / total;
  };
  const plain = new MaterialLibrary();
  result.dialTextured = darkShare(materials);
  result.dialPlain = darkShare(plain);
  gauge.dispose();
  plain.dispose();
  materials.dispose();
  renderer.dispose();
} catch (error) {
  result.error = String(error && error.stack || error);
}
postMessage(result);
`;
}

/** Голые импорты → пути в node_modules: в воркере import map нет. */
function rewriteImports(code, packageName) {
  return code.replace(/(from\s*|import\s*\(\s*)(['"])(three|[^'"]*heating-generators)(\/[^'"]*)?\2/g,
    (whole, prefix, quote, name, subpath = '') => {
      if (name === 'three') {
        const target = subpath ? `/node_modules/three${subpath}` : '/node_modules/three/build/three.module.js';
        return `${prefix}${quote}${target}${quote}`;
      }
      if (name === packageName) {
        return `${prefix}${quote}/node_modules/${packageName}${subpath || '/index.js'}${quote}`;
      }
      return whole;
    });
}

function serve(consumer, packageName) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    try {
      let body;
      if (url.pathname === '/') body = PAGE;
      else if (url.pathname === '/worker.js') body = workerSource(packageName);
      else {
        const file = path.join(consumer, decodeURIComponent(url.pathname));
        if (!file.startsWith(consumer)) throw new Error('вне папки');
        body = await readFile(file);
      }
      const type = TYPES[path.extname(url.pathname)] ?? (url.pathname === '/' ? TYPES['.html'] : 'application/octet-stream');
      if (type === TYPES['.js']) body = rewriteImports(body.toString(), packageName);
      response.writeHead(200, { 'Content-Type': type });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/** Chrome со своим профилем; порт отладки он выбирает сам и называет в stderr. */
async function launchChrome() {
  const profile = await mkdtemp(path.join(tmpdir(), 'heating-lib-chrome-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((resolve, reject) => {
    let text = '';
    const timer = setTimeout(() => reject(new Error(`Chrome не открыл порт отладки (${CHROME})`)), 20000);
    chrome.once('error', (error) => { clearTimeout(timer); reject(error); });
    chrome.stderr.on('data', (chunk) => {
      text += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(text);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  const close = async () => {
    if (chrome.exitCode === null) {
      chrome.kill();
      await new Promise((resolve) => chrome.once('exit', resolve));
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined);
  };
  return { port: new URL(endpoint).port, close };
}

/** Результат воркера: то, что он отправил в postMessage. */
export async function runInWorker(consumer, packageName) {
  const server = await serve(consumer, packageName);
  const chrome = await launchChrome();
  try {
    const base = `http://127.0.0.1:${chrome.port}`;
    const tab = await (await fetch(`${base}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
    let id = 0;
    const waiting = new Map();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && waiting.has(message.id)) { waiting.get(message.id)(message.result); waiting.delete(message.id); }
    });
    const send = (method, params = {}) => new Promise((resolve) => {
      const next = ++id;
      waiting.set(next, resolve);
      ws.send(JSON.stringify({ id: next, method, params }));
    });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
    const deadline = Date.now() + 60000;
    let result;
    while (Date.now() < deadline) {
      const value = await send('Runtime.evaluate', { expression: 'window.__result', returnByValue: true });
      result = value?.result?.value;
      if (result) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    ws.close();
    if (!result) throw new Error('воркер не ответил за 60 с');
    return result;
  } finally {
    await chrome.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
