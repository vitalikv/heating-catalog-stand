import { Box3, Group, InstancedMesh, Matrix4, Mesh, TextureLoader, Vector3 } from 'three';
import { createModelObject, GeneratorRegistry, MaterialLibrary } from '../lib/index';
import { Viewer } from './Viewer';

const info = document.getElementById('info')!;
const viewport = document.getElementById('viewport')!;
const viewer = new Viewer(viewport);
viewer.renderer.setAnimationLoop(null);
viewer.renderer.setPixelRatio(1);
viewer.grid.visible = viewer.axes.visible = false;
viewer.controls.enabled = false;
viewer.camera.far = 10000;
viewer.camera.updateProjectionMatrix();
const materials = new MaterialLibrary();
const root = new Group();
viewer.scene.add(root);
const instanced = new URLSearchParams(location.search).get('benchmark') === 'million';
const count = instanced ? 1_000_000 : 5000;
const countLabel = count.toLocaleString('ru-RU');
const modeLabel = instanced ? 'Инстансинг, полная геометрия деталей' : 'Общая геометрия повторов, без инстансинга';
const warmupMs = 5000;
const durationMs = 30000;
const warnings: string[] = [];
info.textContent = `Подготовка ${countLabel} моделей…`;

const textureJobs: [string, (texture: Awaited<ReturnType<TextureLoader['loadAsync']>>) => void][] = [
  ['rezba_1.png', (texture: Awaited<ReturnType<TextureLoader['loadAsync']>>) => materials.setThreadTexture(texture)],
  ['manometr.png', (texture: Awaited<ReturnType<TextureLoader['loadAsync']>>) => materials.setManometerTexture(texture)],
];
await Promise.all(textureJobs.map(async ([file, apply]) => {
  try {
    const texture = await new TextureLoader().loadAsync(`${import.meta.env.BASE_URL}textures/${file}`);
    apply(texture);
  } catch {
    warnings.push(`Не загружена текстура ${file}`);
  }
}));

const generators = new GeneratorRegistry().list();
const models = generators.map((generator) => generator.build(generator.defaults));
const centers = models.map((model) => new Vector3(
  (model.bounds.min.x + model.bounds.max.x) / 2,
  (model.bounds.min.y + model.bounds.max.y) / 2,
  (model.bounds.min.z + model.bounds.max.z) / 2,
));
const spacing = Math.max(...models.map((model) => Math.max(
  model.bounds.max.x - model.bounds.min.x,
  model.bounds.max.y - model.bounds.min.y,
  model.bounds.max.z - model.bounds.min.z,
))) * 1.2;
const buildStart = performance.now();
const side = instanced ? 100 : 25;
const batches = instanced ? models.map((model, index) => {
  const instances = Math.floor(count / models.length) + (index < count % models.length ? 1 : 0);
  const batch = new InstancedMesh(model.geometry, model.materials.map((key) => materials.get(key)), instances);
  batch.frustumCulled = false;
  root.add(batch);
  return batch;
}) : [];
const matrix = new Matrix4();
const position = new Vector3();
for (let i = 0; i < count; i++) {
  const index = i % models.length;
  position.set((i % side) * spacing, Math.floor(i / (side * side)) * spacing, (Math.floor(i / side) % side) * spacing);
  position.sub(centers[index]);
  if (instanced) {
    batches[index].setMatrixAt(Math.floor(i / models.length), matrix.makeTranslation(position));
  } else {
    const object = createModelObject(models[index], materials);
    object.position.copy(position);
    object.traverse((child) => { if (child instanceof Mesh) child.frustumCulled = false; });
    root.add(object);
  }
  if (i % (instanced ? 10000 : 250) === 0) {
    info.textContent = `Подготовка: ${i} / ${count}`;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}
for (const batch of batches) batch.instanceMatrix.needsUpdate = true;
const placementMs = performance.now() - buildStart;
const bounds = new Box3().setFromObject(root);
const center = bounds.getCenter(new Vector3());
const radius = bounds.getSize(new Vector3()).length() / 2;
const toolbar = document.createElement('div');
toolbar.style.cssText = 'position:absolute;top:8px;left:8px;z-index:10;display:flex;gap:8px';
const restart = document.createElement('button');
restart.textContent = 'Повторить замер';
const download = document.createElement('button');
download.textContent = 'Скачать JSON';
download.disabled = true;
const back = document.createElement('a');
back.href = location.pathname;
back.textContent = 'Вернуться к стенду';
toolbar.append(restart, download, back);
document.body.append(toolbar);
let result: Record<string, unknown> | null = null;
let start = 0;
let previous = 0;
let lastUi = 0;
let measuring = false;
let frames: number[] = [];
let measuredMs = 0;
let totalCalls = 0;
let totalTriangles = 0;
let size = '';
const buffer = new Vector3();
function resolution(): string {
  const canvas = viewer.renderer.domElement;
  return `${canvas.width}×${canvas.height}`;
}
function reset(): void {
  start = previous = lastUi = 0;
  frames = [];
  measuredMs = 0;
  totalCalls = totalTriangles = 0;
  measuring = false;
  result = null;
  download.disabled = true;
  size = resolution();
}
restart.onclick = reset;
download.onclick = () => {
  if (!result) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `benchmark-${count}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
document.addEventListener('visibilitychange', reset);
viewer.renderer.domElement.addEventListener('webglcontextlost', () => {
  viewer.renderer.setAnimationLoop(null);
  result = null;
  download.disabled = true;
  info.textContent = 'Контекст WebGL потерян. Перезагрузите страницу для нового теста.';
});
reset();
viewer.renderer.setAnimationLoop((now: number) => {
  if (document.hidden || result) return;
  if (size !== resolution()) reset();
  if (!start) start = now;
  const elapsed = now - start;
  const halfFov = Math.atan(Math.tan(viewer.camera.fov * Math.PI / 360) * Math.min(1, viewer.camera.aspect));
  const distance = radius / Math.sin(halfFov) * 1.1;
  const angle = elapsed / 1000 * 0.15;
  buffer.set(Math.cos(angle), 0.6, Math.sin(angle)).normalize();
  viewer.camera.position.copy(center).addScaledVector(buffer, distance);
  viewer.camera.lookAt(center);
  viewer.renderer.render(viewer.scene, viewer.camera);
  if (elapsed >= warmupMs) {
    if (measuring) {
      frames.push(now - previous);
      measuredMs += now - previous;
      totalCalls += viewer.renderer.info.render.calls;
      totalTriangles += viewer.renderer.info.render.triangles;
    }
    measuring = true;
  }
  previous = now;
  if (measuredMs >= durationMs) {
    const sorted = [...frames].sort((a, b) => a - b);
    const fps = frames.length * 1000 / measuredMs;
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
    const gl = viewer.renderer.getContext();
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    result = {
      date: new Date().toISOString(), models: count, generatorIds: generators.map((g) => g.id),
      mode: instanced ? 'InstancedMesh per generator; full geometry; frustum culling disabled' : 'Separate meshes, shared geometry per generator; no instancing; frustum culling disabled',
      instanced, grid: [side, Math.ceil(count / (side * side)), side],
      resolution: size, pixelRatio: 1, antialias: true, shadows: false,
      warmupMs, measuredMs, frames: frames.length, averageFps: fps, p95FrameMs: p95,
      averageDrawCalls: totalCalls / frames.length, averageTriangles: totalTriangles / frames.length,
      geometries: viewer.renderer.info.memory.geometries, textures: viewer.renderer.info.memory.textures,
      placementMs, gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      userAgent: navigator.userAgent, warnings, frameTimesMs: frames,
    };
    download.disabled = false;
    info.textContent = `${countLabel} моделей · ${size} · DPR 1\nСредний FPS: ${fps.toFixed(1)}\n95% кадров ≤ ${p95.toFixed(1)} мс\nВызовов отрисовки/кадр: ${Math.round(totalCalls / frames.length)}\nТреугольников/кадр: ${Math.round(totalTriangles / frames.length).toLocaleString('ru-RU')}\nGPU: ${result.gpu}\n${modeLabel}\n${warnings.join('\n')}`;
  } else if (now - lastUi > 500) {
    lastUi = now;
    info.textContent = `${countLabel} моделей · ${size} · DPR 1\n${modeLabel}\n${measuring ? `Замер: ${(measuredMs / 1000).toFixed(0)} / 30 с` : `Прогрев: ${(elapsed / 1000).toFixed(0)} / 5 с`}\n${frames.length ? `FPS: ${(frames.length * 1000 / measuredMs).toFixed(1)}` : ''}\nПри скрытии вкладки или изменении размера замер начинается заново.`;
  }
});
