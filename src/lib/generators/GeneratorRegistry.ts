import type { ModelGenerator } from '../contracts';
import { AluminiumRadiatorGenerator } from './AluminiumRadiatorGenerator';
import { BallValveGenerator } from './BallValveGenerator';
import { BallValveUnionGenerator } from './BallValveUnionGenerator';
import { BoilerGenerator } from './BoilerGenerator';
import { CirculationPumpGenerator } from './CirculationPumpGenerator';
import { ExpansionTankGenerator } from './ExpansionTankGenerator';
import { MpCouplingGenerator } from './MpCouplingGenerator';
import { MpElbowGenerator } from './MpElbowGenerator';
import { MpTeeGenerator } from './MpTeeGenerator';
import { MpThreadAdapterGenerator } from './MpThreadAdapterGenerator';
import { MpThreadElbowGenerator } from './MpThreadElbowGenerator';
import { MpThreadTeeGenerator } from './MpThreadTeeGenerator';
import { PipeGenerator } from './PipeGenerator';
import { PpCouplingGenerator } from './PpCouplingGenerator';
import { PpCrossGenerator } from './PpCrossGenerator';
import { PpElbow45Generator } from './PpElbow45Generator';
import { PpElbowGenerator } from './PpElbowGenerator';
import { PpReducingTeeGenerator } from './PpReducingTeeGenerator';
import { PpTeeGenerator } from './PpTeeGenerator';
import { PpThreadAdapterGenerator } from './PpThreadAdapterGenerator';
import { PpThreadElbowGenerator } from './PpThreadElbowGenerator';
import { PpThreadTeeGenerator } from './PpThreadTeeGenerator';
import { PumpNutGenerator } from './PumpNutGenerator';
import { RadiatorPlugGenerator } from './RadiatorPlugGenerator';
import { RadiatorVentGenerator } from './RadiatorVentGenerator';
import { RegulatingValveGenerator } from './RegulatingValveGenerator';
import { SafetyGroupGenerator } from './SafetyGroupGenerator';
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
import { StrainerGenerator } from './StrainerGenerator';

/**
 * Явный список генераторов вместо window[funcName] из gl2.
 * ID генератора совпадает с именем функции в gl2: позиция каталога —
 * это ID генератора и набор параметров.
 */
export class GeneratorRegistry {
  private readonly generators: ReadonlyMap<string, ModelGenerator<unknown>>;

  constructor() {
    const list: ModelGenerator<unknown>[] = [
      new SteelCouplingGenerator(),
      new SteelNippleGenerator(),
      new SteelPlugGenerator(),
      new SteelHalfUnionGenerator(),
      new SteelElbowGenerator(),
      new SteelElbow45Generator(),
      new SteelTeeGenerator(),
      new SteelCrossGenerator(),
      new SteelCollectorGenerator(),
      new SteelValveCollectorGenerator(),
      new PpElbowGenerator(),
      new PpElbow45Generator(),
      new PpThreadElbowGenerator(),
      new PpCouplingGenerator(),
      new PpThreadAdapterGenerator(),
      new PpTeeGenerator(),
      new PpReducingTeeGenerator(),
      new PpThreadTeeGenerator(),
      new PpCrossGenerator(),
      new MpElbowGenerator(),
      new MpThreadElbowGenerator(),
      new MpCouplingGenerator(),
      new MpThreadAdapterGenerator(),
      new MpTeeGenerator(),
      new MpThreadTeeGenerator(),
      new AluminiumRadiatorGenerator(),
      new RadiatorPlugGenerator(),
      new RadiatorVentGenerator(),
      new SteelRadiatorGenerator(),
      new BallValveGenerator('n'),
      new BallValveGenerator('v'),
      new BallValveGenerator('v_n'),
      new BallValveUnionGenerator(),
      new RegulatingValveGenerator(),
      new PipeGenerator(),
      new CirculationPumpGenerator(),
      new PumpNutGenerator(),
      new StrainerGenerator(),
      new ExpansionTankGenerator(),
      new BoilerGenerator(),
      new SafetyGroupGenerator(),
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
