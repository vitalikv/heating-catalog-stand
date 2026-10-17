import type { AssemblyDefinition } from '../Assembly';
import type { AssemblyRecipe } from './AssemblyRecipe';

/**
 * Подгонка модуля 106, м: байпас — ниппель между боковым ходом клапана и отводом тройника обратки
 * (межосевое линий 100 мм, как у VT.VAR 20); returnUp — ниппель обратки за муфтой над ниппелем 200 мм,
 * supplyDown — ниппель подачи под клапаном: верхние и нижние краны подачи и обратки — на одной высоте.
 */
const FIT = { bypass: 0.0502, returnUp: 0.0552, supplyDown: 0.1198 };

const nipple = (length: number) => ({ nominalLeft: '1', nominalRight: '1', length });
const TEE = { threadGender: 'internal', nominalLeft: '1', nominalBranch: '1/2', nominalRight: '1', length: 0.06, branchLength: 0.03 };
const BYPASS_TEE = { ...TEE, nominalBranch: '1' };
const BALL = { ends: 'internal', nominal: '1', length: 0.0625, handleLength: 0.06 };
const THERMOMETER = { kind: 'thermometer', diameter: 63, connection: 'back', nominal: '1/2', probe: 0.05 };

/**
 * Насосный модуль со смесительным клапаном 106 по схеме VALTEC VT.VAR 20 (технический каталог 2017, с. 255–256):
 * две вертикальные линии 1" через 100 мм. Подача (слева) снизу вверх: кран 13 → трёхходовой клапан VT.MIX03
 * (снизу — от котла, сбоку — байпас из обратки, вверх — смесь) → насос VRS 25/6-180 на гайках → тройник
 * с термометром → кран 8. Обратка (справа) сверху вниз: кран 9 → тройник с термометром → тройник байпаса →
 * обратный клапан (поток вниз) → кран 14. Литой корпус, балансировочный и перепускной клапаны VT.VAR 20
 * не повторяются: модуль собран из деталей каталога. Свободные границы — четыре крана.
 */
function pumpMixingModule(): AssemblyDefinition {
  return {
    label: 'Насосный модуль со смесительным клапаном 1": VT.MIX03, насос VRS, байпас, обратный клапан, термометры',
    parts: [
      // Нижний кран подачи повёрнут на 90° вокруг Z: левый конец вниз (к котлу), правый вверх.
      { name: 'кран 13', generatorId: 'valve.ball', params: BALL, placement: { at: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 90 } } },
      { name: 'ниппель клапана', generatorId: 'steel.nipple', params: nipple(FIT.supplyDown), attach: { connector: 'left', to: 'кран 13', toConnector: 'right' } },
      { name: 'смесительный клапан', generatorId: 'valve.mixing', params: { ways: 3, nominal: '1', control: 'handle' },
        // Разворот на 180°: боковой ход — к обратке (+X), рукоятка — вперёд.
        attach: { connector: 'right', to: 'ниппель клапана', toConnector: 'right', angle: 180 } },
      // Ниппель возвращает разворот клапана: мотор насоса и термометр — вперёд.
      { name: 'ниппель насоса', generatorId: 'steel.nipple', params: nipple(0.044), attach: { connector: 'left', to: 'смесительный клапан', toConnector: 'left', angle: 180 } },
      { name: 'гайка нижняя', generatorId: 'equipment.pump-nut', params: { pumpNominal: '1 1/2', pipeNominal: '1' },
        attach: { connector: 'pipe', to: 'ниппель насоса', toConnector: 'right' } },
      { name: 'насос', generatorId: 'equipment.pump', params: { nominal: '1 1/2', installLength: 0.18, housing: 'vrs', motor: 'small', terminalBox: 'top' },
        attach: { connector: 'left', to: 'гайка нижняя', toConnector: 'pump' } },
      { name: 'гайка верхняя', generatorId: 'equipment.pump-nut', params: { pumpNominal: '1 1/2', pipeNominal: '1' },
        attach: { connector: 'pump', to: 'насос', toConnector: 'right' } },
      { name: 'ниппель подачи', generatorId: 'steel.nipple', params: nipple(0.044), attach: { connector: 'left', to: 'гайка верхняя', toConnector: 'pipe' } },
      { name: 'тройник подачи', generatorId: 'steel.tee', params: TEE, attach: { connector: 'left', to: 'ниппель подачи', toConnector: 'right', angle: 90 } },
      { name: 'термометр подачи', generatorId: 'equipment.gauge', params: THERMOMETER, attach: { connector: 'connection', to: 'тройник подачи', toConnector: 'top' } },
      { name: 'ниппель крана 8', generatorId: 'steel.nipple', params: nipple(0.044), attach: { connector: 'left', to: 'тройник подачи', toConnector: 'right' } },
      { name: 'кран 8', generatorId: 'valve.ball', params: BALL, attach: { connector: 'left', to: 'ниппель крана 8', toConnector: 'right' } },
      // Байпас: боковой ход клапана → ниппель → отвод тройника обратки.
      { name: 'ниппель байпаса', generatorId: 'steel.nipple', params: nipple(FIT.bypass), attach: { connector: 'left', to: 'смесительный клапан', toConnector: 'top' } },
      { name: 'тройник байпаса', generatorId: 'steel.tee', params: BYPASS_TEE, attach: { connector: 'top', to: 'ниппель байпаса', toConnector: 'right' } },
      // Труба обратки — ниппель 200 мм, муфта и подгоночный ниппель.
      { name: 'ниппель обратки', generatorId: 'steel.nipple', params: nipple(0.2), attach: { connector: 'left', to: 'тройник байпаса', toConnector: 'left' } },
      { name: 'муфта обратки', generatorId: 'steel.coupling', params: { nominalLeft: '1', nominalRight: '1', length: 0.04 },
        attach: { connector: 'left', to: 'ниппель обратки', toConnector: 'right' } },
      { name: 'ниппель обратки 2', generatorId: 'steel.nipple', params: nipple(FIT.returnUp), attach: { connector: 'left', to: 'муфта обратки', toConnector: 'right' } },
      { name: 'тройник обратки', generatorId: 'steel.tee', params: TEE, attach: { connector: 'right', to: 'ниппель обратки 2', toConnector: 'right', angle: 90 } },
      { name: 'термометр обратки', generatorId: 'equipment.gauge', params: THERMOMETER, attach: { connector: 'connection', to: 'тройник обратки', toConnector: 'top' } },
      { name: 'ниппель крана 9', generatorId: 'steel.nipple', params: nipple(0.044), attach: { connector: 'right', to: 'тройник обратки', toConnector: 'left' } },
      { name: 'кран 9', generatorId: 'valve.ball', params: BALL, attach: { connector: 'right', to: 'ниппель крана 9', toConnector: 'left' } },
      { name: 'ниппель клапана обратки', generatorId: 'steel.nipple', params: nipple(0.044), attach: { connector: 'left', to: 'тройник байпаса', toConnector: 'right' } },
      { name: 'обратный клапан', generatorId: 'valve.check', params: { nominal: '1', length: 0.058, flow: 'left-to-right' },
        attach: { connector: 'left', to: 'ниппель клапана обратки', toConnector: 'right' } },
      { name: 'ниппель крана 14', generatorId: 'steel.nipple', params: nipple(0.044), attach: { connector: 'left', to: 'обратный клапан', toConnector: 'right' } },
      { name: 'кран 14', generatorId: 'valve.ball', params: BALL, attach: { connector: 'left', to: 'ниппель крана 14', toConnector: 'right' } },
    ],
  };
}

export const PUMP_MIXING_MODULE: AssemblyRecipe = {
  id: 'assembly.pump-mixing-module',
  version: 1,
  title: 'Насосный модуль со смесительным клапаном 1"',
  build: pumpMixingModule,
};
