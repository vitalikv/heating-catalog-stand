import type { ModelGenerator } from '../contracts';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { PpElbowGenerator } from './PpElbowGenerator';
import { SteelCouplingGenerator } from './SteelCouplingGenerator';

/**
 * Явный список генераторов вместо window[funcName] из gl2.
 * ID генератора совпадает с именем функции в gl2: позиция каталога —
 * это ID генератора и набор параметров.
 */
export class GeneratorRegistry {
  private readonly generators: ReadonlyMap<string, ModelGenerator<unknown>>;

  constructor(materials: MaterialLibrary) {
    const list: ModelGenerator<unknown>[] = [new SteelCouplingGenerator(materials), new PpElbowGenerator(materials)];
    this.generators = new Map(list.map((generator) => [generator.id, generator]));
  }

  get(id: string): ModelGenerator<unknown> | undefined {
    return this.generators.get(id);
  }

  list(): ModelGenerator<unknown>[] {
    return [...this.generators.values()];
  }
}
