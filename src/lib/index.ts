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
export type { StrainerEnds, StrainerParams } from './generators/equipment/StrainerGenerator';
export type { StraightStrainerParams } from './generators/equipment/StraightStrainerGenerator';
export type { FlushFilterParams } from './generators/equipment/FlushFilterGenerator';
export type { GaugeKind, GaugeParams } from './generators/equipment/GaugeGenerator';
export type { SeparatorKind, SeparatorParams } from './generators/equipment/SeparatorGenerator';
export type { AirVentExecution, AirVentParams } from './generators/equipment/AirVentGenerator';
export type { MpCouplingParams } from './generators/mp/MpCouplingGenerator';
export type { MpElbowParams } from './generators/mp/MpElbowGenerator';
export type { MpPipeParams } from './generators/mp/MpPipeGenerator';
export type { MpPipePathParams } from './generators/mp/MpPipePathGenerator';
export type { MpTeeParams } from './generators/mp/MpTeeGenerator';
export type { MpThreadAdapterParams } from './generators/mp/MpThreadAdapterGenerator';
export type { MpThreadElbowParams } from './generators/mp/MpThreadElbowGenerator';
export type { MpThreadTeeParams } from './generators/mp/MpThreadTeeGenerator';
export type { MpCompressionCouplingParams } from './generators/mp/MpCompressionCouplingGenerator';
export type { MpCompressionElbowParams } from './generators/mp/MpCompressionElbowGenerator';
export type { MpCompressionTeeParams } from './generators/mp/MpCompressionTeeGenerator';
export type { MpCompressionThreadAdapterParams } from './generators/mp/MpCompressionThreadAdapterGenerator';
export type { MpEuroconeAdapterParams } from './generators/mp/MpEuroconeAdapterGenerator';
export type { BrassManifoldParams } from './generators/manifold/BrassManifoldGenerator';
export type { ManifoldInsertKind } from './generators/manifold/ManifoldInserts';
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
export type { StraightThermostaticValveParams } from './generators/valve/StraightThermostaticValveGenerator';
export type { AxialThermostaticValveParams } from './generators/valve/AxialThermostaticValveGenerator';
export type { ThermostaticHeadParams, ThermostaticHeadSetting } from './generators/valve/ThermostaticHeadGenerator';
export type { DoubleRegulationValveParams } from './generators/valve/DoubleRegulationValveGenerator';
export type { InjectorValveParams } from './generators/valve/InjectorValveGenerator';
export type { RadiatorPipeEnd, RadiatorValveForm, RadiatorValveHead } from './generators/valve/RadiatorValveParts';
export type { CheckValveParams } from './generators/valve/CheckValveGenerator';
export type { DrainValveParams } from './generators/valve/DrainValveGenerator';
export type { LockshieldValveParams } from './generators/valve/LockshieldValveGenerator';
export type { RadiatorHBlockParams } from './generators/valve/RadiatorHBlockGenerator';
export type { MixingValveParams } from './generators/valve/MixingValveGenerator';
export type { MakeUpValveParams } from './generators/valve/MakeUpValveGenerator';
export type { VentShutoffValveParams } from './generators/valve/VentShutoffValveGenerator';
export type { ThermoelectricActuatorParams } from './generators/valve/ThermoelectricActuatorGenerator';

// Материалы и объект сцены.
export { MaterialLibrary } from './materials/MaterialLibrary';
export { createModelObject } from './scene/ModelObject';

// Стыковка и сборки.
export { Assembly } from './assembly/Assembly';
export type {
  AssemblyClosure, AssemblyClosureDefinition, AssemblyDefinition, AssemblyJoint, AssemblyPart, AssemblyPartModel, AssemblyPlacement,
} from './assembly/Assembly';
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
