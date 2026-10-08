import GUI from 'lil-gui';
import { Box3, Mesh, TextureLoader, Vector3 } from 'three';
import type { Object3D } from 'three';
import { GeneratorRegistry, MaterialLibrary } from '../lib/index';
import type { GeneratedModel } from '../lib/index';
import { Assembly } from './Assembly';
import { STAND_ASSEMBLIES } from './assemblies';
import { ModelInspector } from './ModelInspector';
import { STAND_PRESETS } from './presets';
import type { StandParams } from './presets';
import { StandPanel } from './StandPanel';
import { Viewer } from './Viewer';

const viewport = document.getElementById('viewport');
const info = document.getElementById('info');
if (!viewport || !info) throw new Error('Не найдена разметка стенда');

const viewer = new Viewer(viewport);
const materials = new MaterialLibrary();
const registry = new GeneratorRegistry(materials);
// Переключатели общие для одиночной модели и всех деталей сборки.
const inspectorOptions = ModelInspector.defaultOptions();
const inspector = new ModelInspector(viewer.scene, inspectorOptions);

let model: GeneratedModel | null = null;
let assembly: { value: Assembly; inspectors: ModelInspector[] } | null = null;
let lastBuild: { generatorId: string; params: StandParams } | null = null;
let textureWarning = '';

function triangleCount(root: Object3D): number {
  let count = 0;
  root.traverse((object) => {
    if (object instanceof Mesh) {
      const geometry = object.geometry;
      count += (geometry.index ?? geometry.getAttribute('position')).count / 3;
    }
  });
  return count;
}

function formatSize(box: Box3): string {
  const size = box.getSize(new Vector3()).multiplyScalar(1000);
  return `Габарит: ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} мм`;
}

function showInfo(lines: string[], hasErrors: boolean): void {
  if (textureWarning) lines.push(textureWarning);
  info!.textContent = lines.join('\n');
  info!.classList.toggle('has-errors', hasErrors);
}

function clearModel(): void {
  // Старая модель освобождается при каждом перестроении.
  if (model) {
    model.root.removeFromParent();
    model.dispose();
    model = null;
  }
  inspector.attach(null);
}

function clearAssembly(): void {
  if (!assembly) return;
  for (const partInspector of assembly.inspectors) partInspector.dispose();
  assembly.value.dispose();
  assembly = null;
}

function rebuild(generatorId: string, params: StandParams, reframe: boolean): void {
  lastBuild = { generatorId, params };
  if (assembly) return;
  clearModel();

  const generator = registry.get(generatorId);
  if (!generator) {
    showInfo([`Генератор не найден: ${generatorId}`], true);
    return;
  }

  const errors = generator.validate(params);
  if (errors.length > 0) {
    showInfo([generator.title, ...errors.map((error) => `Ошибка: ${error.message}`)], true);
    return;
  }

  const started = performance.now();
  model = generator.build(params);
  const elapsed = performance.now() - started;

  viewer.scene.add(model.root);
  inspector.attach(model);
  if (reframe) viewer.frame(inspector.framingBox());

  showInfo(
    [
      model.title,
      `Треугольников: ${triangleCount(model.root).toLocaleString('ru-RU')}`,
      formatSize(model.bounds),
      `Построение: ${elapsed.toFixed(2)} мс`,
      ...model.warnings.map((warning) => `Предупреждение: ${warning}`),
    ],
    false,
  );
}

function showAssembly(index: number): void {
  clearAssembly();
  const definition = STAND_ASSEMBLIES[index];
  if (!definition) {
    panel.setVisible(true);
    panel.refresh();
    return;
  }

  panel.setVisible(false);
  clearModel();
  const value = new Assembly(registry, definition);
  viewer.scene.add(value.root);
  // Состыкованные разъёмы не рисуются: их подписи легли бы друг на друга, стыки — в сведениях.
  const mated = new Map<string, Set<string>>();
  const mark = (part: string, connector: string) => mated.set(part, (mated.get(part) ?? new Set()).add(connector));
  for (const part of definition.parts) {
    if (!part.attach) continue;
    mark(part.name, part.attach.connector);
    mark(part.attach.to, part.attach.toConnector);
  }
  const inspectors = value.parts.map(({ name, model: part }) => {
    const partInspector = new ModelInspector(viewer.scene, inspectorOptions);
    partInspector.attach(part, mated.get(name));
    return partInspector;
  });
  assembly = { value, inspectors };

  const framing = value.bounds();
  for (const partInspector of inspectors) framing.union(partInspector.framingBox());
  viewer.frame(framing);

  const joints = value.joints.map(({ label, check }) =>
    check.compatible ? `✓ ${label}: ввод ${(check.engagement * 1000).toFixed(1)} мм` : `✗ ${label}: ${check.message}`,
  );
  const failed = value.errors.length > 0 || value.joints.some(({ check }) => !check.compatible);
  showInfo(
    [
      definition.label,
      ...value.parts.map(({ name, model: part }) => `• ${name}: ${part.title}`),
      ...joints,
      ...value.errors.map((error) => `Ошибка: ${error}`),
      `Треугольников: ${triangleCount(value.root).toLocaleString('ru-RU')}`,
      formatSize(value.bounds()),
    ],
    failed,
  );
}

function refreshInspectors(): void {
  inspector.update();
  for (const partInspector of assembly?.inspectors ?? []) partInspector.update();
}

function frameCurrent(): void {
  if (assembly) {
    const framing = assembly.value.bounds();
    for (const partInspector of assembly.inspectors) framing.union(partInspector.framingBox());
    viewer.frame(framing);
  } else if (model) {
    viewer.frame(inspector.framingBox());
  }
}

const gui = new GUI({ title: 'Стенд' });

const assemblyState = { index: -1 };
const assemblyOptions = Object.fromEntries([['— одна модель —', -1], ...STAND_ASSEMBLIES.map((definition, index) => [definition.label, index])]);
gui.add(assemblyState, 'index', assemblyOptions).name('Сборка').onChange((index: number) => showAssembly(index));

const panel = new StandPanel(gui, registry.list(), STAND_PRESETS, rebuild);

const display = gui.addFolder('Отображение');
display.add(inspectorOptions, 'connectors').name('Разъёмы').onChange(refreshInspectors);
display.add(inspectorOptions, 'wireframe').name('Каркас').onChange(refreshInspectors);
display.add(inspectorOptions, 'normals').name('Нормали').onChange(refreshInspectors);
display.add(inspectorOptions, 'bounds').name('Габаритный бокс').onChange(refreshInspectors);
display.add(inspectorOptions, 'neutral').name('Нейтральный материал').onChange(refreshInspectors);
display.add(viewer.grid, 'visible').name('Сетка');
display.add(viewer.axes, 'visible').name('Оси');
display.add({ frame: frameCurrent }, 'frame').name('Показать модель целиком');

// Текстура грузится в стенде и передаётся в библиотеку готовой (п. 5 плана).
new TextureLoader()
  .loadAsync(`${import.meta.env.BASE_URL}textures/rezba_1.png`)
  .then((texture) => materials.setThreadTexture(texture))
  .catch(() => {
    textureWarning = 'Текстура резьбы не загружена: textures/rezba_1.png';
    if (assembly) showAssembly(assemblyState.index);
    else if (lastBuild) rebuild(lastBuild.generatorId, lastBuild.params, false);
  });
