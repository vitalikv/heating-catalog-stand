import type { AssemblyRecipe } from './AssemblyRecipe';
import { MANIFOLD_RETURN, MANIFOLD_SUPPLY } from './manifolds';
import { PUMP_MIXING_MODULE } from './pumpMixingModule';
import { PUMP_MODULE } from './pumpModule';

/** Производственные рецепты; диагностические сборки — только на стенде (src/stand/assemblies.ts). */
export const ASSEMBLY_RECIPES: readonly AssemblyRecipe[] = [PUMP_MODULE, PUMP_MIXING_MODULE, MANIFOLD_SUPPLY, MANIFOLD_RETURN];
