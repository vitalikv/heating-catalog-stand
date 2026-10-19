import type { AssemblyDefinition } from '../Assembly';
import type { AssemblyRecipe } from './AssemblyRecipe';

/**
 * Вход холодной воды в бойлер (позиции 111, 112): кран 3/4 → тройник с гасителем гидроударов VT.CAR20 на отводе
 * 1/2 → группа безопасности VT.461 (вход холодной воды прямо в тройник) → ниппель к патрубку бойлера.
 * Свободные границы: кран (водопровод), ниппель (бойлер), слив 1 1/4 группы (дренаж через воронку).
 */
function boilerColdInlet(): AssemblyDefinition {
  return {
    label: 'Вход в бойлер 3/4: кран, гаситель гидроударов VT.CAR20, группа безопасности VT.461',
    parts: [
      { name: 'тройник', generatorId: 'steel.tee',
        params: { threadGender: 'internal', nominalLeft: '3/4', nominalBranch: '1/2', nominalRight: '3/4', length: 0.052, branchLength: 0.026 } },
      { name: 'гаситель', generatorId: 'equipment.water-hammer-arrester', params: { model: 'CAR20' },
        attach: { connector: 'inlet', to: 'тройник', toConnector: 'top' } },
      { name: 'группа безопасности', generatorId: 'equipment.boiler-safety-group', params: { setting: 7 },
        attach: { connector: 'cold', to: 'тройник', toConnector: 'right' } },
      { name: 'ниппель бойлера', generatorId: 'steel.nipple', params: { nominalLeft: '3/4', nominalRight: '3/4', length: 0.026 },
        attach: { connector: 'left', to: 'группа безопасности', toConnector: 'boiler' } },
      { name: 'кран', generatorId: 'valve.ball', params: { ends: 'external', nominal: '3/4', length: 0.07, handleLength: 0.053 },
        attach: { connector: 'right', to: 'тройник', toConnector: 'left' } },
    ],
  };
}

export const BOILER_COLD_INLET: AssemblyRecipe = {
  id: 'assembly.boiler-cold-inlet',
  version: 1,
  title: 'Вход холодной воды в бойлер с группой безопасности',
  build: boilerColdInlet,
};
