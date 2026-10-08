import GUI from 'lil-gui';
import { Mesh, TextureLoader, Vector3 } from 'three';
import { GeneratorRegistry, MaterialLibrary } from '../lib/index';
import type { GeneratedModel } from '../lib/index';
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
const inspector = new ModelInspector(viewer.scene);

let model: GeneratedModel | null = null;
let lastBuild: { generatorId: string; params: StandParams } | null = null;
let textureWarning = '';

function triangleCount(current: GeneratedModel): number {
  let count = 0;
  current.root.traverse((object) => {
    if (object instanceof Mesh) {
      const geometry = object.geometry;
      count += (geometry.index ?? geometry.getAttribute('position')).count / 3;
    }
  });
  return count;
}

function showInfo(lines: string[], hasErrors: boolean): void {
  if (textureWarning) lines.push(textureWarning);
  info!.textContent = lines.join('\n');
  info!.classList.toggle('has-errors', hasErrors);
}

function rebuild(generatorId: string, params: StandParams, reframe: boolean): void {
  lastBuild = { generatorId, params };

  // Старая модель освобождается при каждом перестроении.
  if (model) {
    model.root.removeFromParent();
    model.dispose();
    model = null;
  }

  const generator = registry.get(generatorId);
  if (!generator) {
    inspector.attach(null);
    showInfo([`Генератор не найден: ${generatorId}`], true);
    return;
  }

  const errors = generator.validate(params);
  if (errors.length > 0) {
    inspector.attach(null);
    showInfo([generator.title, ...errors.map((error) => `Ошибка ${error.param}: ${error.message}`)], true);
    return;
  }

  const started = performance.now();
  model = generator.build(params);
  const elapsed = performance.now() - started;

  viewer.scene.add(model.root);
  inspector.attach(model);
  if (reframe) viewer.frame(model.root);

  const size = model.bounds.getSize(new Vector3()).multiplyScalar(1000);
  showInfo(
    [
      model.root.name || generator.title,
      `Треугольников: ${triangleCount(model).toLocaleString('ru-RU')}`,
      `Габарит: ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} мм`,
      `Построение: ${elapsed.toFixed(2)} мс`,
      ...model.warnings.map((warning) => `Предупреждение: ${warning}`),
    ],
    false,
  );
}

const gui = new GUI({ title: 'Стенд' });
const titles = new Map(registry.list().map((generator) => [generator.id, generator.title]));
new StandPanel(gui, STAND_PRESETS, titles, rebuild);

const display = gui.addFolder('Отображение');
const refresh = () => inspector.update();
display.add(inspector.options, 'connectors').name('Разъёмы').onChange(refresh);
display.add(inspector.options, 'wireframe').name('Каркас').onChange(refresh);
display.add(inspector.options, 'normals').name('Нормали').onChange(refresh);
display.add(inspector.options, 'bounds').name('Габаритный бокс').onChange(refresh);
display.add(inspector.options, 'neutral').name('Нейтральный материал').onChange(refresh);
display.add(viewer.grid, 'visible').name('Сетка');
display.add(viewer.axes, 'visible').name('Оси');
display.add({ frame: () => model && viewer.frame(model.root) }, 'frame').name('Показать модель целиком');

// Текстура грузится в стенде и передаётся в библиотеку готовой (п. 5 плана).
new TextureLoader()
  .loadAsync(`${import.meta.env.BASE_URL}textures/rezba_1.png`)
  .then((texture) => materials.setThreadTexture(texture))
  .catch(() => {
    textureWarning = 'Текстура резьбы не загружена: textures/rezba_1.png';
    if (lastBuild) rebuild(lastBuild.generatorId, lastBuild.params, false);
  });
