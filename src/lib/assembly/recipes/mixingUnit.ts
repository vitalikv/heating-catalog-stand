import type { AssemblyDefinition, AssemblyPart } from '../Assembly';
import type { AssemblyRecipe } from './AssemblyRecipe';

/** Подбираемые длины узла 72, м: вертикальный и диагональный ниппели байпаса, муфта обратки. */
export const MIXING_UNIT_FIT = { bypass: 0.0537, jog: 0.0247, returnCoupling: 0.0512 };

/**
 * Насосно-смесительный узел 72 по схеме VALTEC для VT.MIX03 (технический каталог 2017, с. 371,
 * пример 4): подача котла → кран → трёхходовой клапан (left — горячий, right — смешанный) →
 * ниппель → гайка → насос VRS 25/6-180 → гайка → anchor (подающая гребёнка или её ниппель).
 * Ход top клапана — байпас вверх, к тройнику обратной линии: ниппель, два угла 45° (сдвиг к стене
 * на 32 мм, как у обратной гребёнки на VTc.IV130), ниппель. Тройник: left — кран к котлу,
 * right — ниппель и муфта к обратной гребёнке (свободная граница «муфта обратки».right).
 * fit — длины, подобранные под замыкание на обратной гребёнке пары (сборка 123 стенда).
 */
export function mixingUnitParts(anchor: { to: string; toConnector: string }, fit = MIXING_UNIT_FIT): AssemblyPart[] {
  const nipple = (length: number) => ({ nominalLeft: '1', nominalRight: '1', length });
  const tee = { threadGender: 'internal', nominalLeft: '1', nominalBranch: '1', nominalRight: '1', length: 0.06, branchLength: 0.03 };
  const elbow = { nominal: '1', armLength: 0.016 };
  const ball = { ends: 'internal', nominal: '1', length: 0.0625, handleLength: 0.06 };
  return [
    { name: 'гайка подачи', generatorId: 'equipment.pump-nut', params: { pumpNominal: '1 1/2', pipeNominal: '1' },
      attach: { connector: 'pipe', to: anchor.to, toConnector: anchor.toConnector } },
    { name: 'насос узла', generatorId: 'equipment.pump', params: { nominal: '1 1/2', installLength: 0.18, housing: 'vrs', motor: 'small', terminalBox: 'left' },
      attach: { connector: 'right', to: 'гайка подачи', toConnector: 'pump' } },
    { name: 'гайка клапана', generatorId: 'equipment.pump-nut', params: { pumpNominal: '1 1/2', pipeNominal: '1' },
      attach: { connector: 'pump', to: 'насос узла', toConnector: 'left' } },
    { name: 'ниппель клапана', generatorId: 'steel.nipple', params: nipple(0.044), attach: { connector: 'right', to: 'гайка клапана', toConnector: 'pipe' } },
    { name: 'смесительный клапан', generatorId: 'valve.mixing', params: { ways: 3, nominal: '1', control: 'handle' },
      attach: { connector: 'right', to: 'ниппель клапана', toConnector: 'left' } },
    { name: 'ниппель подачи котла', generatorId: 'steel.nipple', params: nipple(0.044), attach: { connector: 'right', to: 'смесительный клапан', toConnector: 'left' } },
    { name: 'кран подачи котла', generatorId: 'valve.ball', params: ball, attach: { connector: 'right', to: 'ниппель подачи котла', toConnector: 'left' } },
    // Байпас: вверх от клапана, сдвиг к стене двумя углами 45°, вверх в отвод тройника.
    { name: 'ниппель байпаса', generatorId: 'steel.nipple', params: nipple(0.044), attach: { connector: 'left', to: 'смесительный клапан', toConnector: 'top' } },
    { name: 'угол байпаса 1', generatorId: 'steel.elbow-45', params: elbow, attach: { connector: 'right', to: 'ниппель байпаса', toConnector: 'right', angle: 90 } },
    { name: 'ниппель сдвига', generatorId: 'steel.nipple', params: nipple(fit.jog), attach: { connector: 'left', to: 'угол байпаса 1', toConnector: 'left' } },
    { name: 'угол байпаса 2', generatorId: 'steel.elbow-45', params: elbow, attach: { connector: 'left', to: 'ниппель сдвига', toConnector: 'right', angle: 180 } },
    { name: 'ниппель к тройнику', generatorId: 'steel.nipple', params: nipple(fit.bypass), attach: { connector: 'left', to: 'угол байпаса 2', toConnector: 'right' } },
    { name: 'тройник обратки', generatorId: 'steel.tee', params: tee, attach: { connector: 'top', to: 'ниппель к тройнику', toConnector: 'right', angle: 90 } },
    { name: 'ниппель обратки котла', generatorId: 'steel.nipple', params: nipple(0.044), attach: { connector: 'right', to: 'тройник обратки', toConnector: 'left' } },
    { name: 'кран обратки котла', generatorId: 'valve.ball', params: ball, attach: { connector: 'right', to: 'ниппель обратки котла', toConnector: 'left' } },
    { name: 'ниппель обратки', generatorId: 'steel.nipple', params: nipple(0.2), attach: { connector: 'left', to: 'тройник обратки', toConnector: 'right' } },
    { name: 'муфта обратки', generatorId: 'steel.coupling', params: { nominalLeft: '1', nominalRight: '1', length: fit.returnCoupling },
      attach: { connector: 'left', to: 'ниппель обратки', toConnector: 'right' } },
  ];
}

/**
 * Узел 72 отдельно: ниппель подачи в начале координат вместо подающей гребёнки. Свободны ниппель
 * подачи (к магистрали гребёнки), краны подачи и обратки котла и муфта обратки (к обратной гребёнке).
 */
function mixingUnit(): AssemblyDefinition {
  return {
    label: 'Насосно-смесительный узел 1": клапан VT.MIX03, насос VRS, байпас, краны котла',
    parts: [
      { name: 'ниппель подачи', generatorId: 'steel.nipple', params: { nominalLeft: '1', nominalRight: '1', length: 0.044 } },
      ...mixingUnitParts({ to: 'ниппель подачи', toConnector: 'left' }),
    ],
  };
}

export const MIXING_UNIT: AssemblyRecipe = {
  id: 'assembly.mixing-unit',
  version: 1,
  title: 'Насосно-смесительный узел тёплого пола',
  build: mixingUnit,
};
