import type GUI from 'lil-gui';
import type { Controller } from 'lil-gui';
import type { GeneratorPresets, StandParams } from './presets';

/** Вызывается при каждом изменении; reframe — сменилась модель, а не только параметр. */
export type PanelChangeHandler = (generatorId: string, params: StandParams, reframe: boolean) => void;

/**
 * Папка «Модель»: выбор генератора и набора, ручная правка параметров, сброс.
 * Длины показываются в миллиметрах, наружу отдаются в метрах.
 */
export class StandPanel {
  private readonly folder: GUI;
  private readonly state = { generator: '', preset: 0 };
  private presetController: Controller;
  private paramsFolder: GUI;
  /** Значения полей в единицах панели (мм для длин). */
  private ui: Record<string, string | number> = {};

  constructor(
    gui: GUI,
    private readonly catalog: GeneratorPresets[],
    titles: ReadonlyMap<string, string>,
    private readonly onChange: PanelChangeHandler,
  ) {
    if (catalog.length === 0) throw new Error('StandPanel: нет наборов параметров');
    this.state.generator = catalog[0].generatorId;

    this.folder = gui.addFolder('Модель');
    const generators = Object.fromEntries(catalog.map((entry) => [titles.get(entry.generatorId) ?? entry.generatorId, entry.generatorId]));
    this.folder.add(this.state, 'generator', generators).name('Генератор').onChange(() => this.selectGenerator());
    this.presetController = this.folder.add(this.state, 'preset', {}).name('Набор');
    this.folder.add({ reset: () => this.applyPreset(true) }, 'reset').name('Сбросить к набору');
    this.paramsFolder = this.folder.addFolder('Параметры');

    this.selectGenerator();
  }

  private get entry(): GeneratorPresets {
    return this.catalog.find((entry) => entry.generatorId === this.state.generator) ?? this.catalog[0];
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
    for (const field of this.entry.fields) {
      const value = preset.params[field.key];
      this.ui[field.key] = field.kind === 'length' ? Math.round(Number(value) * 1e6) / 1000 : value;
    }
    this.rebuildParamsFolder();
    this.emit(reframe);
  }

  private rebuildParamsFolder(): void {
    this.paramsFolder.destroy();
    this.paramsFolder = this.folder.addFolder('Параметры');

    for (const field of this.entry.fields) {
      const controller =
        field.kind === 'choice'
          ? this.paramsFolder.add(this.ui, field.key, [...field.options])
          : this.paramsFolder.add(this.ui, field.key, field.min, field.max, field.step);
      controller.name(field.label).onChange(() => this.emit(false));
    }
  }

  private emit(reframe: boolean): void {
    const params: StandParams = {};
    for (const field of this.entry.fields) {
      const value = this.ui[field.key];
      params[field.key] = field.kind === 'length' ? Number(value) / 1000 : value;
    }
    this.onChange(this.state.generator, params, reframe);
  }
}
