import type GUI from 'lil-gui';
import type { Controller } from 'lil-gui';
import { ParamSchema } from '../lib/index';
import type { ModelGenerator, ParamSpec } from '../lib/index';
import type { GeneratorPresets, StandParams } from './presets';

/** Вызывается при каждом изменении; reframe — сменилась модель, а не только параметр. */
export type PanelChangeHandler = (generatorId: string, params: StandParams, reframe: boolean) => void;

/** Генератор и его наборы на стенде. */
interface PanelEntry {
  generator: ModelGenerator<unknown>;
  presets: GeneratorPresets['presets'];
}

/**
 * Папка «Модель»: выбор генератора и набора, ручная правка параметров, сброс.
 * Поля строятся по paramSpecs генератора. Длины показываются в миллиметрах,
 * наружу отдаются в метрах.
 */
export class StandPanel {
  private readonly folder: GUI;
  private readonly entries: PanelEntry[];
  private readonly state = { generator: '', preset: 0 };
  private presetController: Controller;
  private paramsFolder: GUI;
  /** Значения полей в единицах панели (мм для длин), по ключу ParamSpec.key. */
  private ui: Record<string, string | number> = {};
  private controls = new Map<ParamSpec, Controller>();

  constructor(
    gui: GUI,
    generators: readonly ModelGenerator<unknown>[],
    catalog: readonly GeneratorPresets[],
    private readonly onChange: PanelChangeHandler,
  ) {
    // На стенде только генераторы, для которых есть наборы.
    this.entries = generators.flatMap((generator) => {
      const presets = catalog.find((entry) => entry.generatorId === generator.id)?.presets ?? [];
      return presets.length > 0 ? [{ generator, presets }] : [];
    });
    if (this.entries.length === 0) throw new Error('StandPanel: нет генераторов с наборами параметров');
    this.state.generator = this.entries[0].generator.id;

    this.folder = gui.addFolder('Модель');
    const options = Object.fromEntries(this.entries.map(({ generator }) => [generator.title, generator.id]));
    this.folder.add(this.state, 'generator', options).name('Генератор').onChange(() => this.selectGenerator());
    this.presetController = this.folder.add(this.state, 'preset', {}).name('Набор');
    this.folder.add({ reset: () => this.applyPreset(true) }, 'reset').name('Сбросить к набору');
    this.paramsFolder = this.folder.addFolder('Параметры');

    this.selectGenerator();
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
    const preset = this.entry.presets[this.state.preset];
    this.ui = {};
    for (const spec of this.entry.generator.paramSpecs) {
      const value = ParamSchema.get(preset.params, spec.key);
      if (spec.kind === 'length') this.ui[spec.key] = toMm(Number(value));
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
      this.controls.set(spec, this.addControl(spec).onChange(() => this.emit(false)));
    }
  }

  private addControl(spec: ParamSpec): Controller {
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

  private emit(reframe: boolean): void {
    // Параметры вне схемы (например, size.z радиатора) берутся из набора.
    const params = structuredClone(this.entry.presets[this.state.preset].params);
    for (const spec of this.entry.generator.paramSpecs) {
      const value = this.ui[spec.key];
      ParamSchema.set(params, spec.key, spec.kind === 'length' ? Number(value) / 1000 : value);
    }
    // Поля с условием when: неактивные скрыты и остаются как в наборе.
    const preset = this.entry.presets[this.state.preset].params;
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
