// Единственная точка импорта библиотеки для стенда и будущих потребителей.
export type { Connector, GeneratedModel, ModelGenerator, ValidationError, Vector3Data } from './contracts';
export { GeneratorParamsError } from './GeneratorParamsError';
export { GeneratorRegistry } from './generators/GeneratorRegistry';
export { SteelCouplingGenerator } from './generators/SteelCouplingGenerator';
export type { SteelCouplingParams } from './generators/SteelCouplingGenerator';
export { MaterialLibrary } from './materials/MaterialLibrary';
export type { MaterialKey } from './materials/MaterialLibrary';
export { ThreadSizes } from './sizes/ThreadSizes';
export type { PartDiameters, ThreadSide } from './sizes/ThreadSizes';
