import type { ModelGenerator } from '../core/contracts';
import { AluminiumRadiatorGenerator } from './radiator/AluminiumRadiatorGenerator';
import { BallValveGenerator } from './valve/BallValveGenerator';
import { BallValveUnionGenerator } from './valve/BallValveUnionGenerator';
import { BoilerGenerator } from './equipment/BoilerGenerator';
import { CirculationPumpGenerator } from './equipment/CirculationPumpGenerator';
import { ExpansionTankGenerator } from './equipment/ExpansionTankGenerator';
import { MpCouplingGenerator } from './mp/MpCouplingGenerator';
import { MpElbowGenerator } from './mp/MpElbowGenerator';
import { MpPipeGenerator } from './mp/MpPipeGenerator';
import { MpTeeGenerator } from './mp/MpTeeGenerator';
import { MpThreadAdapterGenerator } from './mp/MpThreadAdapterGenerator';
import { MpThreadElbowGenerator } from './mp/MpThreadElbowGenerator';
import { MpThreadTeeGenerator } from './mp/MpThreadTeeGenerator';
import { PpCouplingGenerator } from './pp/PpCouplingGenerator';
import { PpCrossGenerator } from './pp/PpCrossGenerator';
import { PpElbow45Generator } from './pp/PpElbow45Generator';
import { PpElbowGenerator } from './pp/PpElbowGenerator';
import { PpPipeGenerator } from './pp/PpPipeGenerator';
import { PpReducingTeeGenerator } from './pp/PpReducingTeeGenerator';
import { PpTeeGenerator } from './pp/PpTeeGenerator';
import { PpThreadAdapterGenerator } from './pp/PpThreadAdapterGenerator';
import { PpThreadElbowGenerator } from './pp/PpThreadElbowGenerator';
import { PpThreadTeeGenerator } from './pp/PpThreadTeeGenerator';
import { PumpNutGenerator } from './equipment/PumpNutGenerator';
import { RadiatorPortFittingGenerator } from './radiator/RadiatorPortFittingGenerator';
import { RadiatorVentGenerator } from './radiator/RadiatorVentGenerator';
import { RegulatingValveGenerator } from './valve/RegulatingValveGenerator';
import { SafetyGroupGenerator } from './equipment/SafetyGroupGenerator';
import { SteelManifoldGenerator } from './steel/SteelManifoldGenerator';
import { SteelCouplingGenerator } from './steel/SteelCouplingGenerator';
import { SteelCrossGenerator } from './steel/SteelCrossGenerator';
import { SteelElbow45Generator } from './steel/SteelElbow45Generator';
import { SteelElbowGenerator } from './steel/SteelElbowGenerator';
import { SteelHalfUnionGenerator } from './steel/SteelHalfUnionGenerator';
import { SteelNippleGenerator } from './steel/SteelNippleGenerator';
import { SteelPlugGenerator } from './steel/SteelPlugGenerator';
import { SteelRadiatorGenerator } from './radiator/SteelRadiatorGenerator';
import { SteelTeeGenerator } from './steel/SteelTeeGenerator';
import { SteelValveManifoldGenerator } from './steel/SteelValveManifoldGenerator';
import { StrainerGenerator } from './equipment/StrainerGenerator';
import { SteelBushingGenerator } from './steel/SteelBushingGenerator';
import { SteelCapGenerator } from './steel/SteelCapGenerator';
import { SteelUnionGenerator } from './steel/SteelUnionGenerator';
import { AngleThermostaticValveGenerator } from './valve/AngleThermostaticValveGenerator';
import { CheckValveGenerator } from './valve/CheckValveGenerator';
import { DrainValveGenerator } from './valve/DrainValveGenerator';
import { LockshieldValveGenerator } from './valve/LockshieldValveGenerator';
import { RadiatorHBlockGenerator } from './valve/RadiatorHBlockGenerator';

/** Все генераторы библиотеки; порядок — порядок списка на стенде. */
function createGenerators() {
  return [
  new SteelCouplingGenerator(),
  new SteelNippleGenerator(),
  new SteelPlugGenerator(),
  new SteelHalfUnionGenerator(),
  new SteelElbowGenerator(),
  new SteelElbow45Generator(),
  new SteelTeeGenerator(),
  new SteelCrossGenerator(),
  new SteelManifoldGenerator(),
  new SteelValveManifoldGenerator(),
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
  new RadiatorPortFittingGenerator(),
  new RadiatorVentGenerator(),
  new SteelRadiatorGenerator(),
  new BallValveGenerator(),
  new BallValveUnionGenerator(),
  new RegulatingValveGenerator(),
  new PpPipeGenerator(),
  new MpPipeGenerator(),
  new CirculationPumpGenerator(),
  new PumpNutGenerator(),
  new StrainerGenerator(),
  new ExpansionTankGenerator(),
  new BoilerGenerator(),
  new SafetyGroupGenerator(),
  new CheckValveGenerator(),
  new AngleThermostaticValveGenerator(),
  new LockshieldValveGenerator(),
  new RadiatorHBlockGenerator(),
  new SteelUnionGenerator(),
  new SteelBushingGenerator(),
  new SteelCapGenerator(),
  new DrainValveGenerator(),
  ] as const;
}

type AnyGenerator = ReturnType<typeof createGenerators>[number];

/** ID генераторов библиотеки. */
export type GeneratorId = AnyGenerator['id'];

/** Тип параметров по ID генератора: 'steel.coupling' → SteelCouplingParams. */
export type GeneratorParamsMap = { [G in AnyGenerator as G['id']]: G['defaults'] };

/** Явный список генераторов вместо window[funcName] из gl2. */
export class GeneratorRegistry {
  private readonly generators: ReadonlyMap<string, ModelGenerator<unknown>>;

  constructor() {
    this.generators = new Map(createGenerators().map((generator) => [generator.id, generator as ModelGenerator<unknown>]));
  }

  /** Генератор библиотеки с типом его параметров. */
  get<K extends GeneratorId>(id: K): ModelGenerator<GeneratorParamsMap[K]>;
  /** Генератор по ID из данных проекта; undefined — такого генератора нет. */
  get(id: string): ModelGenerator<unknown> | undefined;
  get(id: string): ModelGenerator<unknown> | undefined {
    return this.generators.get(id);
  }

  list(): ModelGenerator<unknown>[] {
    return [...this.generators.values()];
  }
}
