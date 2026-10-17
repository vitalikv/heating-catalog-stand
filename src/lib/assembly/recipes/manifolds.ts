import type { AssemblyDefinition, AssemblyPart } from '../Assembly';
import type { AssemblyRecipe, AssemblyRecipeVariant } from './AssemblyRecipe';

/** Гребёнка блока VTc.596EMNX 1": магистраль — внутренняя резьба, выходы — евроконус 3/4, вверху воздух, внизу слив. */
const MANIFOLD = { nominal: '1', outletEnd: 'eurocone', outletNominal: '1/2', mainEnd: 'internal', endPorts: 'vent-drain' } as const;

/** Выходов у гребёнок 1": 3–12 (каталог VALTEC 2017, с. 184; каталог библиотеки — то же). */
const OUTLETS: readonly AssemblyRecipeVariant[] = Array.from({ length: 10 }, (_, i) => ({ key: String(i + 3), label: `1" × ${i + 3}` }));

function outletsOf(variant: string | undefined): number {
  const found = variant === undefined ? OUTLETS[0] : OUTLETS.find((item) => item.key === variant);
  if (!found) throw new Error(`Нет исполнения коллектора: ${variant}`);
  return Number(found.key);
}

/**
 * Концевой узел 70: отсекающий клапан VT.539 и автоматический воздухоотводчик VT.502.NH (как в комплекте
 * блоков VALTEC), слив, пробка торца; ниппель магистрали — к нему подводят трубу.
 */
function manifoldEnds(): AssemblyPart[] {
  return [
    { name: 'отсекающий клапан', generatorId: 'valve.vent-shutoff', params: {}, attach: { connector: 'inlet', to: 'коллектор', toConnector: 'vent' } },
    { name: 'воздухоотводчик', generatorId: 'equipment.air-vent', params: { execution: 'NH' },
      attach: { connector: 'inlet', to: 'отсекающий клапан', toConnector: 'vent' } },
    { name: 'слив', generatorId: 'valve.drain', params: { nominal: '1/2', hoseNominal: '16', length: 0.06 },
      attach: { connector: 'inlet', to: 'коллектор', toConnector: 'drain' } },
    { name: 'пробка', generatorId: 'steel.plug', params: { nominal: '1', length: 0.03 }, attach: { connector: 'left', to: 'коллектор', toConnector: 'end' } },
    { name: 'ниппель магистрали', generatorId: 'steel.nipple', params: { nominalLeft: '1', nominalRight: '1', length: 0.044 },
      attach: { connector: 'right', to: 'коллектор', toConnector: 'main' } },
  ];
}

/** Подающая гребёнка 67 в сборе: расходомеры на выходах и концевой узел. Свободны выходы и ниппель магистрали. */
function supply(variant?: string): AssemblyDefinition {
  const outlets = outletsOf(variant);
  return {
    label: `Коллектор подающий 1" × ${outlets}: расходомеры, воздухоотводчик, слив`,
    parts: [
      { name: 'коллектор', generatorId: 'manifold.brass', params: { ...MANIFOLD, outlets, inserts: 'flowmeter', head: 'handle' } },
      ...manifoldEnds(),
    ],
  };
}

/** Обратная гребёнка 68 в сборе: термоклапаны под сервоприводы 69 на всех выходах и концевой узел. */
function returnUnderActuators(variant?: string): AssemblyDefinition {
  const outlets = outletsOf(variant);
  return {
    label: `Коллектор обратный 1" × ${outlets}: сервоприводы, воздухоотводчик, слив`,
    parts: [
      { name: 'коллектор', generatorId: 'manifold.brass', params: { ...MANIFOLD, outlets, inserts: 'thermostatic', head: 'none' } },
      ...Array.from({ length: outlets }, (_, i): AssemblyPart => ({ name: `привод ${i + 1}`, generatorId: 'valve.thermoelectric-actuator',
        params: { state: 'closed' }, attach: { connector: 'valve', to: 'коллектор', toConnector: `head-${i + 1}` } })),
      ...manifoldEnds(),
    ],
  };
}

export const MANIFOLD_SUPPLY: AssemblyRecipe = {
  id: 'assembly.manifold-supply',
  version: 1,
  title: 'Коллектор подающий с расходомерами в сборе',
  variants: OUTLETS,
  build: supply,
};

export const MANIFOLD_RETURN: AssemblyRecipe = {
  id: 'assembly.manifold-return',
  version: 1,
  title: 'Коллектор обратный под сервоприводы в сборе',
  variants: OUTLETS,
  build: returnUnderActuators,
};
