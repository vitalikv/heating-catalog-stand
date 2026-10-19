import type { AssemblyClosureDefinition, AssemblyDefinition, AssemblyPart } from '../Assembly';
import type { AssemblyRecipe, AssemblyRecipeVariant } from './AssemblyRecipe';

type BottomSide = 'right' | 'left';
type Shutoff = 'none' | 'ball';

/**
 * Нижняя пара радиатора с H-блоком (часть 24): ниппели каталога 3/4 × 1/2 концом 1/2 в обе нижние резьбы,
 * H-блок ставится по ниппелю A, второй его порт замыкается на ниппель B (closures). При совмещении up
 * H-блок разворачивается на π вокруг вертикали, поэтому к ниппелю A у торца идёт противоположный по
 * названию порт: при паре справа — radiator-left. На выходах H-блока — адаптеры евроконуса под МП 16.
 * Отрезков трубы в узле нет: трубу к адаптерам прокладывают.
 */
export function bottomHBlockParts(
  radiator: AssemblyPart,
  bottomSide: BottomSide,
  shutoff: Shutoff,
): { parts: AssemblyPart[]; closures: AssemblyClosureDefinition[] } {
  const nipple = { nominalLeft: '3/4', nominalRight: '1/2', length: 0.026 };
  // С кранами — VALTEC VT.345K (позиция 100): высота A = 49 мм.
  const hBlock = shutoff === 'ball' ? { height: 0.049, shutoff } : { height: 0.06 };
  return {
    parts: [
      radiator,
      { name: 'ниппель A', generatorId: 'steel.nipple', params: nipple, attach: { connector: 'right', to: radiator.name, toConnector: 'below-outer' } },
      { name: 'ниппель B', generatorId: 'steel.nipple', params: nipple, attach: { connector: 'right', to: radiator.name, toConnector: 'below-inner' } },
      { name: 'H-блок', generatorId: 'valve.radiator-h-block',
        params: { radiatorNominal: '3/4', pipeNominal: '3/4', spacing: 0.05, configuration: 'straight', ...hBlock },
        attach: { connector: bottomSide === 'right' ? 'radiator-left' : 'radiator-right', to: 'ниппель A', toConnector: 'left' } },
      // Звено «евроконус → МП-труба» (часть 22): обжимной адаптер на каждом выходе.
      ...(['left', 'right'] as const).map((side): AssemblyPart => ({
        name: `адаптер ${side}`, generatorId: 'mp.eurocone-adapter', params: { pipeNominal: '16', euroconeNominal: '3/4', length: 0.026 },
        attach: { connector: 'eurocone', to: 'H-блок', toConnector: `pipe-${side}` },
      })),
    ],
    closures: [{ part: 'H-блок', connector: bottomSide === 'right' ? 'radiator-right' : 'radiator-left', to: 'ниппель B', toConnector: 'left' }],
  };
}

const VARIANTS: readonly (AssemblyRecipeVariant & { side: BottomSide; shutoff: Shutoff })[] = [
  { key: 'right', label: 'справа', side: 'right', shutoff: 'none' },
  { key: 'right-ball', label: 'справа, с кранами', side: 'right', shutoff: 'ball' },
  { key: 'left', label: 'слева', side: 'left', shutoff: 'none' },
  { key: 'left-ball', label: 'слева, с кранами', side: 'left', shutoff: 'ball' },
];

/**
 * Стальной радиатор 600 × 500 с нижним подключением и H-блоком: свободны адаптеры евроконуса
 * (МП 16) и боковые резьбы радиатора. Исполнения — сторона нижней пары и краны H-блока.
 */
function radiatorHBlock(variant?: string): AssemblyDefinition {
  const found = variant === undefined ? VARIANTS[0] : VARIANTS.find((item) => item.key === variant);
  if (!found) throw new Error(`Нет исполнения узла радиатора: ${variant}`);
  const radiator: AssemblyPart = { name: 'радиатор', generatorId: 'radiator.steel',
    params: { dimensions: { x: 0.6, y: 0.5, z: 0.07 }, nominal: '1/2', connection: 'bottom', bottomSide: found.side } };
  const { parts, closures } = bottomHBlockParts(radiator, found.side, found.shutoff);
  return {
    label: `Стальной радиатор снизу (${found.label}): ниппели, H-блок${found.shutoff === 'ball' ? ' с кранами VT.345K' : ''}, евроконус → МП 16`,
    parts,
    closures,
  };
}

export const RADIATOR_H_BLOCK: AssemblyRecipe = {
  id: 'assembly.radiator-h-block',
  version: 1,
  title: 'Радиатор стальной с H-блоком',
  variants: VARIANTS.map(({ key, label }) => ({ key, label })),
  build: radiatorHBlock,
};
