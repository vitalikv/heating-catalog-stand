import type { ModelGenerator } from '../core/contracts';
import { AluminiumRadiatorGenerator } from './radiator/AluminiumRadiatorGenerator';
import { BallValveGenerator } from './valve/BallValveGenerator';
import { BallValveUnionGenerator } from './valve/BallValveUnionGenerator';
import { BoilerGenerator } from './equipment/BoilerGenerator';
import { CirculationPumpGenerator } from './equipment/CirculationPumpGenerator';
import { ExpansionTankGenerator } from './equipment/ExpansionTankGenerator';
import { MpCouplingGenerator } from './mp/MpCouplingGenerator';
import { MpElbowGenerator } from './mp/MpElbowGenerator';
import { MpTeeGenerator } from './mp/MpTeeGenerator';
import { MpThreadAdapterGenerator } from './mp/MpThreadAdapterGenerator';
import { MpThreadElbowGenerator } from './mp/MpThreadElbowGenerator';
import { MpThreadTeeGenerator } from './mp/MpThreadTeeGenerator';
import { PipeGenerator } from './PipeGenerator';
import { PpCouplingGenerator } from './pp/PpCouplingGenerator';
import { PpCrossGenerator } from './pp/PpCrossGenerator';
import { PpElbow45Generator } from './pp/PpElbow45Generator';
import { PpElbowGenerator } from './pp/PpElbowGenerator';
import { PpReducingTeeGenerator } from './pp/PpReducingTeeGenerator';
import { PpTeeGenerator } from './pp/PpTeeGenerator';
import { PpThreadAdapterGenerator } from './pp/PpThreadAdapterGenerator';
import { PpThreadElbowGenerator } from './pp/PpThreadElbowGenerator';
import { PpThreadTeeGenerator } from './pp/PpThreadTeeGenerator';
import { PumpNutGenerator } from './equipment/PumpNutGenerator';
import { RadiatorPlugGenerator } from './radiator/RadiatorPlugGenerator';
import { RadiatorVentGenerator } from './radiator/RadiatorVentGenerator';
import { RegulatingValveGenerator } from './valve/RegulatingValveGenerator';
import { SafetyGroupGenerator } from './equipment/SafetyGroupGenerator';
import { SteelCollectorGenerator } from './steel/SteelCollectorGenerator';
import { SteelCouplingGenerator } from './steel/SteelCouplingGenerator';
import { SteelCrossGenerator } from './steel/SteelCrossGenerator';
import { SteelElbow45Generator } from './steel/SteelElbow45Generator';
import { SteelElbowGenerator } from './steel/SteelElbowGenerator';
import { SteelHalfUnionGenerator } from './steel/SteelHalfUnionGenerator';
import { SteelNippleGenerator } from './steel/SteelNippleGenerator';
import { SteelPlugGenerator } from './steel/SteelPlugGenerator';
import { SteelRadiatorGenerator } from './radiator/SteelRadiatorGenerator';
import { SteelTeeGenerator } from './steel/SteelTeeGenerator';
import { SteelValveCollectorGenerator } from './steel/SteelValveCollectorGenerator';
import { StrainerGenerator } from './equipment/StrainerGenerator';

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
