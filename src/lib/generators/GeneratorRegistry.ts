import type { ModelGenerator } from '../contracts';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { AluminiumRadiatorGenerator } from './AluminiumRadiatorGenerator';
import { BallValveGenerator } from './BallValveGenerator';
import { BallValveUnionGenerator } from './BallValveUnionGenerator';
import { MpCouplingGenerator } from './MpCouplingGenerator';
import { MpElbowGenerator } from './MpElbowGenerator';
import { MpTeeGenerator } from './MpTeeGenerator';
import { MpThreadAdapterGenerator } from './MpThreadAdapterGenerator';
import { MpThreadElbowGenerator } from './MpThreadElbowGenerator';
import { MpThreadTeeGenerator } from './MpThreadTeeGenerator';
import { PpCouplingGenerator } from './PpCouplingGenerator';
import { PpCrossGenerator } from './PpCrossGenerator';
import { PpElbow45Generator } from './PpElbow45Generator';
import { PpElbowGenerator } from './PpElbowGenerator';
import { PpReducingTeeGenerator } from './PpReducingTeeGenerator';
import { PpTeeGenerator } from './PpTeeGenerator';
import { PpThreadAdapterGenerator } from './PpThreadAdapterGenerator';
import { PpThreadElbowGenerator } from './PpThreadElbowGenerator';
import { PpThreadTeeGenerator } from './PpThreadTeeGenerator';
import { RadiatorPlugGenerator } from './RadiatorPlugGenerator';
import { RadiatorVentGenerator } from './RadiatorVentGenerator';
import { RegulatingValveGenerator } from './RegulatingValveGenerator';
import { SteelCollectorGenerator } from './SteelCollectorGenerator';
import { SteelCouplingGenerator } from './SteelCouplingGenerator';
import { SteelCrossGenerator } from './SteelCrossGenerator';
import { SteelElbow45Generator } from './SteelElbow45Generator';
import { SteelElbowGenerator } from './SteelElbowGenerator';
import { SteelHalfUnionGenerator } from './SteelHalfUnionGenerator';
import { SteelNippleGenerator } from './SteelNippleGenerator';
import { SteelPlugGenerator } from './SteelPlugGenerator';
import { SteelRadiatorGenerator } from './SteelRadiatorGenerator';
import { SteelTeeGenerator } from './SteelTeeGenerator';
import { SteelValveCollectorGenerator } from './SteelValveCollectorGenerator';

/**
 * Явный список генераторов вместо window[funcName] из gl2.
 * ID генератора совпадает с именем функции в gl2: позиция каталога —
 * это ID генератора и набор параметров.
 */
export class GeneratorRegistry {
  private readonly generators: ReadonlyMap<string, ModelGenerator<unknown>>;

  constructor(materials: MaterialLibrary) {
    const list: ModelGenerator<unknown>[] = [
      new SteelCouplingGenerator(materials),
      new SteelNippleGenerator(materials),
      new SteelPlugGenerator(materials),
      new SteelHalfUnionGenerator(materials),
      new SteelElbowGenerator(materials),
      new SteelElbow45Generator(materials),
      new SteelTeeGenerator(materials),
      new SteelCrossGenerator(materials),
      new SteelCollectorGenerator(materials),
      new SteelValveCollectorGenerator(materials),
      new PpElbowGenerator(materials),
      new PpElbow45Generator(materials),
      new PpThreadElbowGenerator(materials),
      new PpCouplingGenerator(materials),
      new PpThreadAdapterGenerator(materials),
      new PpTeeGenerator(materials),
      new PpReducingTeeGenerator(materials),
      new PpThreadTeeGenerator(materials),
      new PpCrossGenerator(materials),
      new MpElbowGenerator(materials),
      new MpThreadElbowGenerator(materials),
      new MpCouplingGenerator(materials),
      new MpThreadAdapterGenerator(materials),
      new MpTeeGenerator(materials),
      new MpThreadTeeGenerator(materials),
      new AluminiumRadiatorGenerator(materials),
      new RadiatorPlugGenerator(materials),
      new RadiatorVentGenerator(materials),
      new SteelRadiatorGenerator(materials),
      new BallValveGenerator(materials, 'n'),
      new BallValveGenerator(materials, 'v'),
      new BallValveGenerator(materials, 'v_n'),
      new BallValveUnionGenerator(materials),
      new RegulatingValveGenerator(materials),
    ];
    this.generators = new Map(list.map((generator) => [generator.id, generator]));
  }

  get(id: string): ModelGenerator<unknown> | undefined {
    return this.generators.get(id);
  }

  list(): ModelGenerator<unknown>[] {
    return [...this.generators.values()];
  }
}
