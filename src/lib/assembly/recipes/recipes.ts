import type { AssemblyRecipe } from './AssemblyRecipe';
import { BOILER_COLD_INLET } from './boilerColdInlet';
import { MANIFOLD_RETURN, MANIFOLD_SUPPLY } from './manifolds';
import { MIXING_UNIT } from './mixingUnit';
import { PUMP_MIXING_MODULE } from './pumpMixingModule';
import { PUMP_MODULE } from './pumpModule';
import { RADIATOR_H_BLOCK } from './radiatorHBlock';

/** Производственные рецепты; диагностические сборки — только на стенде (src/stand/assemblies.ts). */
export const ASSEMBLY_RECIPES: readonly AssemblyRecipe[] = [
  PUMP_MODULE, PUMP_MIXING_MODULE, MANIFOLD_SUPPLY, MANIFOLD_RETURN, RADIATOR_H_BLOCK, MIXING_UNIT, BOILER_COLD_INLET,
];
