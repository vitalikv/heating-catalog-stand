import type { AssemblyDefinition, AssemblyPart } from '../Assembly';
import type { AssemblyRecipe } from './AssemblyRecipe';

const NIPPLE = { nominalLeft: '1', nominalRight: '1', length: 0.044 };
const TEE = { threadGender: 'internal', nominalLeft: '1', nominalBranch: '1/2', nominalRight: '1', length: 0.06, branchLength: 0.03 };
const BALL_VALVE = { ends: 'internal', nominal: '1', length: 0.0625, handleLength: 0.06 };

/**
 * Насосный модуль 105 по подающей линии VALTEC VT.VAR 10 (технический каталог 2017, с. 250), снизу вверх:
 * кран шаровой 1" → ниппель → гайка 1 1/2 × 1 → насос VRS 25-180 → гайка → ниппель → обратный клапан
 * VT.161 1" → ниппель → тройник с термоманометром → ниппель → тройник с воздухоотводчиком VT.502.NA →
 * ниппель → кран. Нижний кран повёрнут
 * на 90° вокруг Z: линия вертикальна, вход — «кран нижний».left, выход — «кран верхний».right.
 * Тройники довёрнуты на 90°: отводы смотрят вперёд (+Z), воздухоотводчик стоит колбой вверх,
 * циферблат — вперёд; мотор насоса вперёд, клеммная коробка сбоку (вниз паспорт VRS запрещает).
 */
function pumpModuleParts(): AssemblyPart[] {
  return [
    { name: 'кран нижний', generatorId: 'valve.ball', params: BALL_VALVE, placement: { at: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 90 } } },
    { name: 'ниппель 1', generatorId: 'steel.nipple', params: NIPPLE, attach: { connector: 'left', to: 'кран нижний', toConnector: 'right' } },
    { name: 'гайка нижняя', generatorId: 'equipment.pump-nut', params: { pumpNominal: '1 1/2', pipeNominal: '1' },
      attach: { connector: 'pipe', to: 'ниппель 1', toConnector: 'right' } },
    { name: 'насос', generatorId: 'equipment.pump', params: { nominal: '1 1/2', installLength: 0.18, housing: 'vrs', motor: 'small', terminalBox: 'top' },
      attach: { connector: 'left', to: 'гайка нижняя', toConnector: 'pump' } },
    { name: 'гайка верхняя', generatorId: 'equipment.pump-nut', params: { pumpNominal: '1 1/2', pipeNominal: '1' },
      attach: { connector: 'pump', to: 'насос', toConnector: 'right' } },
    { name: 'ниппель 2', generatorId: 'steel.nipple', params: NIPPLE, attach: { connector: 'left', to: 'гайка верхняя', toConnector: 'pipe' } },
    { name: 'обратный клапан', generatorId: 'valve.check', params: { nominal: '1', length: 0.058, flow: 'left-to-right' },
      attach: { connector: 'left', to: 'ниппель 2', toConnector: 'right' } },
    { name: 'ниппель 3', generatorId: 'steel.nipple', params: NIPPLE, attach: { connector: 'left', to: 'обратный клапан', toConnector: 'right' } },
    { name: 'тройник КИП', generatorId: 'steel.tee', params: TEE, attach: { connector: 'left', to: 'ниппель 3', toConnector: 'right', angle: 90 } },
    { name: 'термоманометр', generatorId: 'equipment.gauge', params: { kind: 'thermomanometer', diameter: 80, connection: 'back', nominal: '1/2', probe: 0.05 },
      attach: { connector: 'connection', to: 'тройник КИП', toConnector: 'top' } },
    { name: 'ниппель 4', generatorId: 'steel.nipple', params: NIPPLE, attach: { connector: 'left', to: 'тройник КИП', toConnector: 'right' } },
    { name: 'тройник воздуха', generatorId: 'steel.tee', params: TEE, attach: { connector: 'left', to: 'ниппель 4', toConnector: 'right', angle: 90 } },
    { name: 'воздухоотводчик', generatorId: 'equipment.air-vent', params: { execution: 'NA' },
      attach: { connector: 'inlet', to: 'тройник воздуха', toConnector: 'top' } },
    { name: 'ниппель 5', generatorId: 'steel.nipple', params: NIPPLE, attach: { connector: 'left', to: 'тройник воздуха', toConnector: 'right' } },
    { name: 'кран верхний', generatorId: 'valve.ball', params: BALL_VALVE, attach: { connector: 'left', to: 'ниппель 5', toConnector: 'right' } },
  ];
}

export const PUMP_MODULE: AssemblyRecipe = {
  id: 'assembly.pump-module',
  version: 1,
  title: 'Насосный модуль прямой 1"',
  build(): AssemblyDefinition {
    return {
      label: 'Насосный модуль прямой 1": краны, насос VRS, обратный клапан, термоманометр, воздухоотводчик',
      parts: pumpModuleParts(),
    };
  },
};
