import type GUI from 'lil-gui';
import type { Controller } from 'lil-gui';
import { ParamSchema } from '../lib/index';
import type { CatalogEntry, CatalogItem, ModelGenerator, ParamSpec, Vector3Data } from '../lib/index';

/** Параметры на панели: правятся по ключам ParamSpec. */
export type StandParams = Record<string, unknown>;

/** Вызывается при каждом изменении; reframe — сменилась модель, а не только параметр. */
export type PanelChangeHandler = (generatorId: string, params: StandParams, reframe: boolean) => void;

/** Генератор и его наборы (позиции каталога) на стенде. */
interface PanelEntry {
  generator: ModelGenerator<unknown>;
  presets: CatalogItem[];
}

const GROUP_LABELS: Readonly<Record<string, string>> = {
  steel: 'Стальные детали',
  pp: 'Полипропилен',
  mp: 'Металлопластик',
  radiator: 'Радиаторы и комплектующие',
  valve: 'Арматура',
  equipment: 'Оборудование',
  manifold: 'Коллекторы',
};

function groupId(entry: PanelEntry): string {
  return entry.generator.id.split('.')[0];
}

/**
 * Папка «Каталог»: выбор группы, объекта и набора, ручная правка параметров, сброс.
 * Поля строятся по paramSpecs генератора. Длины показываются в миллиметрах,
 * наружу отдаются в метрах.
 */
export class StandPanel {
  private readonly folder: GUI;
  private readonly entries: PanelEntry[];
  private readonly state = { group: '', generator: '', preset: 0 };
  private generatorController: Controller;
  private presetController: Controller;
  private paramsFolder: GUI;
  /** Значения полей в единицах панели (мм для длин), по ключу ParamSpec.key. */
  private ui: Record<string, string | number> = {};
  /** Точки путей (ParamSpec kind 'path') в мм, по ключу. */
  private paths: Record<string, Vector3Data[]> = {};
  private controls = new Map<ParamSpec, { show(visible: boolean): unknown }>();

  constructor(
    gui: GUI,
    generators: readonly ModelGenerator<unknown>[],
    catalog: readonly CatalogEntry[],
    private readonly onChange: PanelChangeHandler,
  ) {
    // На стенде только генераторы, для которых есть наборы.
    this.entries = generators.flatMap((generator) => {
      const presets: CatalogItem[] = catalog.find((entry) => entry.generatorId === generator.id)?.items ?? [];
      return presets.length > 0 ? [{ generator, presets }] : [];
    });
    if (this.entries.length === 0) throw new Error('StandPanel: нет генераторов с наборами параметров');
    this.state.generator = this.entries[0].generator.id;
    this.state.group = groupId(this.entries[0]);

    this.folder = gui.addFolder('Каталог');
    const groups = [...new Set(this.entries.map(groupId))];
    const groupOptions = Object.fromEntries([
      ['Все группы', ''],
      ...groups.map((id) => [GROUP_LABELS[id] ?? id, id]),
    ]);
    this.folder.add(this.state, 'group', groupOptions).name('Группа').onChange(() => this.selectGroup());
    this.generatorController = this.folder.add(this.state, 'generator', {}).name('Объект');
    this.presetController = this.folder.add(this.state, 'preset', {}).name('Набор');
    this.folder.add({ reset: () => this.applyPreset(true) }, 'reset').name('Сбросить к набору');
    this.paramsFolder = this.folder.addFolder('Параметры');

    this.selectGroup();
  }

  /** Скрывает папку на время режима сборки. */
  setVisible(visible: boolean): void {
    this.folder.show(visible);
  }

  /** Повторно отдаёт текущие параметры (возврат из режима сборки). */
  refresh(): void {
    this.emit(true);
  }

  private get entry(): PanelEntry {
    return this.entries.find((entry) => entry.generator.id === this.state.generator) ?? this.entries[0];
  }

  private selectGroup(): void {
    const entries = this.entries.filter((entry) => !this.state.group || groupId(entry) === this.state.group);
    // При переходе в «Все группы» сохраняем выбранный объект и его параметры.
    const keepSelection = entries.some((entry) => entry.generator.id === this.state.generator);
    if (!keepSelection) this.state.generator = entries[0].generator.id;
    const options = Object.fromEntries(entries.map(({ generator }) => [generator.title, generator.id]));
    this.generatorController = this.generatorController
      .options(options)
      .name('Объект')
      .onChange(() => this.selectGenerator());
    if (!keepSelection || this.controls.size === 0) this.selectGenerator();
  }

  private selectGenerator(): void {
    const options = Object.fromEntries(this.entry.presets.map((preset, index) => [preset.label, index]));
    this.state.preset = 0;
    this.presetController = this.presetController
      .options(options)
      .name('Набор')
      .onChange(() => this.applyPreset(true));
    this.applyPreset(true);
  }

  private applyPreset(reframe: boolean): void {
    const preset = this.presetParams();
    this.ui = {};
    this.paths = {};
    for (const spec of this.entry.generator.paramSpecs) {
      const value = ParamSchema.get(preset, spec.key);
      if (spec.kind === 'path') this.paths[spec.key] = (value as Vector3Data[]).map(({ x, y, z }) => ({ x: toMm(x), y: toMm(y), z: toMm(z) }));
      else if (spec.kind === 'length') this.ui[spec.key] = toMm(Number(value));
      // Неактивный в наборе выбор (выход у заглушки) — первый вариант, чтобы его можно было включить.
      else if (spec.kind === 'choice') this.ui[spec.key] = spec.options.find((option) => option === value) ?? spec.options[0];
      else this.ui[spec.key] = value as number;
    }
    this.rebuildParamsFolder();
    this.emit(reframe);
  }

  private rebuildParamsFolder(): void {
    this.paramsFolder.destroy();
    this.paramsFolder = this.folder.addFolder('Параметры');

    this.controls = new Map();
    for (const spec of this.entry.generator.paramSpecs) {
      if (spec.kind === 'path') this.controls.set(spec, this.addPath(spec));
      else this.controls.set(spec, this.addControl(spec).onChange(() => this.emit(false)));
    }
  }

  /** Путь: папка с полями x, y, z каждой точки, мм, и кнопками добавления и удаления точки. */
  private addPath(spec: Extract<ParamSpec, { kind: 'path' }>): GUI {
    const folder = this.paramsFolder.addFolder(`${spec.label}, мм`);
    const points = this.paths[spec.key];
    points.forEach((point, i) => {
      for (const axis of ['x', 'y', 'z'] as const) {
        folder.add(point, axis).name(`${i + 1}: ${axis}`).onChange(() => this.emit(false));
      }
    });
    const edit = (change: () => void) => () => {
      change();
      this.rebuildParamsFolder();
      this.emit(false);
    };
    if (points.length < spec.maxPoints) {
      // Новая точка — продолжение последнего отрезка на 100 мм.
      folder.add({ add: edit(() => {
        const [a, b] = [points[points.length - 2], points[points.length - 1]];
        const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 1;
        const scale = 100 / length;
        points.push({ x: b.x + (b.x - a.x) * scale, y: b.y + (b.y - a.y) * scale, z: b.z + (b.z - a.z) * scale });
      }) }, 'add').name('Добавить точку');
    }
    if (points.length > spec.minPoints) folder.add({ remove: edit(() => points.pop()) }, 'remove').name('Удалить последнюю');
    return folder;
  }

  private addControl(spec: Exclude<ParamSpec, { kind: 'path' }>): Controller {
    switch (spec.kind) {
      case 'choice': {
        const options = Object.fromEntries(spec.options.map((option) => [spec.optionLabels?.[option] ?? String(option), option]));
        return this.paramsFolder.add(this.ui, spec.key, options).name(spec.label);
      }
      case 'integer':
        return this.paramsFolder.add(this.ui, spec.key, spec.min, spec.max, 1).name(spec.label);
      case 'length':
        return this.paramsFolder.add(this.ui, spec.key, toMm(spec.min), toMm(spec.max), toMm(spec.step)).name(`${spec.label}, мм`);
    }
  }

  /** Параметры текущего набора; ключи, добавленные в новой версии генератора, — из defaults. */
  private presetParams(): unknown {
    const { generator, presets } = this.entry;
    return ParamSchema.withAddedDefaults(generator.paramSpecs, presets[this.state.preset].params, generator.defaults);
  }

  private emit(reframe: boolean): void {
    // Параметры вне схемы (например, size.z радиатора) берутся из набора.
    // Параметры каталога типизированы по генератору; панель правит их как запись по ключам.
    const params = structuredClone(this.presetParams()) as StandParams;
    for (const spec of this.entry.generator.paramSpecs) {
      if (spec.kind === 'path') {
        ParamSchema.set(params, spec.key, this.paths[spec.key].map(({ x, y, z }) => ({ x: Number(x) / 1000, y: Number(y) / 1000, z: Number(z) / 1000 })));
        continue;
      }
      const value = this.ui[spec.key];
      ParamSchema.set(params, spec.key, spec.kind === 'length' ? Number(value) / 1000 : value);
    }
    // Поля с условием when: неактивные скрыты и остаются как в наборе.
    const preset = this.presetParams();
    for (const [spec, control] of this.controls) {
      const active = ParamSchema.isActive(spec, params);
      control.show(active);
      if (!active) ParamSchema.set(params, spec.key, ParamSchema.get(preset, spec.key));
    }
    this.onChange(this.state.generator, params, reframe);
  }
}

/** Метры → миллиметры без хвостов float: 0.033 → 33. */
function toMm(meters: number): number {
  return Math.round(meters * 1e6) / 1000;
}
