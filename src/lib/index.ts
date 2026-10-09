// Публичный API библиотеки — единственная точка импорта для стенда и будущих потребителей.
// Классы генераторов, MeshModel, ConnectorFrame и общие части семейств сюда не входят:
// генераторы берутся из GeneratorRegistry, тесты импортируют внутренние модули напрямую.

// Контракт.
export type {
  BoundsData,
  Connector,
  ConnectorJoint,
  GeneratedModel,
  MaterialKey,
  ModelGenerator,
  ParamSpec,
  ParamSpecBase,
  ThreadGender,
  ValidationError,
  Vector3Data,
} from './core/contracts';
export { GeneratorParamsError } from './core/GeneratorParamsError';

// Реестр и типы параметров генераторов.
export { GeneratorRegistry } from './generators/GeneratorRegistry';
export type { GeneratorId, GeneratorParamsMap } from './generators/GeneratorRegistry';
export type { BoilerConnection, BoilerParams } from './generators/equipment/BoilerGenerator';
export type { CirculationPumpParams } from './generators/equipment/CirculationPumpGenerator';
export type { ExpansionTankParams } from './generators/equipment/ExpansionTankGenerator';
export type { PumpNutParams } from './generators/equipment/PumpNutGenerator';
export type { SafetyGroupParams } from './generators/equipment/SafetyGroupGenerator';
export type { StrainerParams } from './generators/equipment/StrainerGenerator';
export type { MpCouplingParams } from './generators/mp/MpCouplingGenerator';
export type { MpElbowParams } from './generators/mp/MpElbowGenerator';
export type { MpPipeParams } from './generators/mp/MpPipeGenerator';
export type { MpTeeParams } from './generators/mp/MpTeeGenerator';
export type { MpThreadAdapterParams } from './generators/mp/MpThreadAdapterGenerator';
export type { MpThreadElbowParams } from './generators/mp/MpThreadElbowGenerator';
export type { MpThreadTeeParams } from './generators/mp/MpThreadTeeGenerator';
export type { PpCouplingParams } from './generators/pp/PpCouplingGenerator';
export type { PpCrossParams } from './generators/pp/PpCrossGenerator';
export type { PpElbowParams } from './generators/pp/PpElbowGenerator';
export type { PpPipeParams } from './generators/pp/PpPipeGenerator';
export type { PpReducingTeeParams } from './generators/pp/PpReducingTeeGenerator';
export type { PpTeeParams } from './generators/pp/PpTeeGenerator';
export type { PpThreadAdapterParams } from './generators/pp/PpThreadAdapterGenerator';
export type { PpThreadElbowParams } from './generators/pp/PpThreadElbowGenerator';
export type { AluminiumRadiatorParams } from './generators/radiator/AluminiumRadiatorGenerator';
export type { RadiatorPortFittingKind, RadiatorPortFittingParams } from './generators/radiator/RadiatorPortFittingGenerator';
export type { RadiatorVentKind, RadiatorVentParams } from './generators/radiator/RadiatorVentGenerator';
export type { SteelRadiatorParams } from './generators/radiator/SteelRadiatorGenerator';
export type { SteelCouplingParams } from './generators/steel/SteelCouplingGenerator';
export type { SteelCrossParams } from './generators/steel/SteelCrossGenerator';
export type { SteelElbow45Params } from './generators/steel/SteelElbow45Generator';
export type { SteelElbowParams } from './generators/steel/SteelElbowGenerator';
export type { SteelHalfUnionParams } from './generators/steel/SteelHalfUnionGenerator';
export type { SteelManifoldParams } from './generators/steel/SteelManifoldGenerator';
export type { SteelNippleParams } from './generators/steel/SteelNippleGenerator';
export type { SteelPlugParams } from './generators/steel/SteelPlugGenerator';
export type { SteelTeeParams } from './generators/steel/SteelTeeGenerator';
export type { SteelValveManifoldParams, ValveColor } from './generators/steel/SteelValveManifoldGenerator';
export type { BallValveEnds, BallValveParams } from './generators/valve/BallValveGenerator';
export type { BallValveUnionParams } from './generators/valve/BallValveUnionGenerator';
export type { RegulatingValveHead, RegulatingValveParams } from './generators/valve/RegulatingValveGenerator';
export type { SteelBushingParams } from './generators/steel/SteelBushingGenerator';
export type { SteelCapParams } from './generators/steel/SteelCapGenerator';
export type { SteelUnionParams } from './generators/steel/SteelUnionGenerator';
export type { AngleThermostaticValveParams } from './generators/valve/AngleThermostaticValveGenerator';
export type { CheckValveParams } from './generators/valve/CheckValveGenerator';
export type { DrainValveParams } from './generators/valve/DrainValveGenerator';
export type { LockshieldValveParams } from './generators/valve/LockshieldValveGenerator';
export type { RadiatorHBlockParams } from './generators/valve/RadiatorHBlockGenerator';

// Материалы и объект сцены.
export { MaterialLibrary } from './materials/MaterialLibrary';
export { createModelObject } from './scene/ModelObject';

// Стыковка и сборки.
export { Assembly } from './assembly/Assembly';
export type { AssemblyDefinition, AssemblyJoint, AssemblyPart, AssemblyPartModel } from './assembly/Assembly';
export { ConnectorMating } from './assembly/ConnectorMating';
export type { MatingCheck } from './assembly/ConnectorMating';

// Схема параметров и таблицы размеров.
export { ParamSchema } from './params/ParamSchema';
export { MpPipeSizes } from './sizes/MpPipeSizes';
export { PpPipeSizes } from './sizes/PpPipeSizes';
export { ThreadSizes } from './sizes/ThreadSizes';
export type { PartDiameters } from './sizes/ThreadSizes';

// Каталог.
export { CATALOG } from './catalog/catalog';
export type { CatalogEntry, CatalogItem } from './catalog/entry';
