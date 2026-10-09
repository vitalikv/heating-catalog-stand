import type { AluminiumRadiatorParams, AssemblyDefinition } from '../lib/index';

const radiator = (sections: number, height: number): AluminiumRadiatorParams => ({ sections, dimensions: { x: 0.08, y: height, z: 0.08 }, nominal: '1' });

/**
 * Сборки для проверки стыковки. Сначала совместимые стыки, потом заведомо
 * несовместимые (название начинается с «Ошибка») — стенд должен показать причину.
 */
export const STAND_ASSEMBLIES: AssemblyDefinition[] = [
  {
    label: 'Радиатор → переходник → ниппель → муфта',
    parts: [
      { name: 'радиатор', generatorId: 'radiator.aluminium', params: radiator(3, 0.5) },
      {
        name: 'переходник',
        generatorId: 'radiator.port-fitting',
        params: { kind: 'adapter', portNominal: '1', outletNominal: '1/2' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'top-right' },
      },
      {
        name: 'ниппель',
        generatorId: 'steel.nipple',
        params: { nominalLeft: '1/2', nominalRight: '1/2', length: 0.022 },
        attach: { connector: 'left', to: 'переходник', toConnector: 'outlet' },
      },
      {
        name: 'муфта',
        generatorId: 'steel.coupling',
        params: { nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 },
        attach: { connector: 'left', to: 'ниппель', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Радиатор: заглушка, воздухоотводчик, переходники',
    parts: [
      { name: 'радиатор', generatorId: 'radiator.aluminium', params: radiator(5, 0.35) },
      {
        name: 'воздухоотводчик',
        generatorId: 'radiator.port-fitting',
        params: { kind: 'vent', portNominal: '1' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'top-left' },
      },
      {
        name: 'заглушка',
        generatorId: 'radiator.port-fitting',
        params: { kind: 'plug', portNominal: '1' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'bottom-left' },
      },
      {
        name: 'переходник 3/4',
        generatorId: 'radiator.port-fitting',
        params: { kind: 'adapter', portNominal: '1', outletNominal: '3/4' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'top-right' },
      },
      {
        name: 'переходник 1/2',
        generatorId: 'radiator.port-fitting',
        params: { kind: 'adapter', portNominal: '1', outletNominal: '1/2' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'bottom-right' },
      },
    ],
  },
  {
    label: 'Переходная муфта 1×1/2 и ниппели',
    parts: [
      { name: 'муфта', generatorId: 'steel.coupling', params: { nominalLeft: '1', nominalRight: '1/2', length: 0.034 } },
      {
        name: 'ниппель 1',
        generatorId: 'steel.nipple',
        params: { nominalLeft: '1', nominalRight: '1', length: 0.034 },
        attach: { connector: 'right', to: 'муфта', toConnector: 'left' },
      },
      {
        name: 'ниппель 1/2',
        generatorId: 'steel.nipple',
        params: { nominalLeft: '1/2', nominalRight: '1/2', length: 0.022 },
        attach: { connector: 'left', to: 'муфта', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Тройник: ниппели, угол с доворотом, краны',
    parts: [
      { name: 'тройник', generatorId: 'steel.tee', params: { threadGender: 'internal', nominalLeft: '1/2', nominalBranch: '1/2', nominalRight: '1/2', length: 0.046, branchLength: 0.023 } },
      {
        name: 'кран н-н',
        generatorId: 'valve.ball',
        params: { ends: 'external', nominal: '1/2', length: 0.063, handleLength: 0.053 },
        attach: { connector: 'left', to: 'тройник', toConnector: 'top' },
      },
      {
        name: 'ниппель слева',
        generatorId: 'steel.nipple',
        params: { nominalLeft: '1/2', nominalRight: '1/2', length: 0.022 },
        attach: { connector: 'right', to: 'тройник', toConnector: 'left' },
      },
      {
        // Доворот на 90°: второй выход угла смотрит вдоль Z, а не вверх.
        name: 'угол',
        generatorId: 'steel.elbow-90',
        params: { threadGender: 'internal', nominal: '1/2', armLength: 0.023 },
        attach: { connector: 'right', to: 'ниппель слева', toConnector: 'left', angle: 90 },
      },
      {
        name: 'ниппель справа',
        generatorId: 'steel.nipple',
        params: { nominalLeft: '1/2', nominalRight: '1/2', length: 0.022 },
        attach: { connector: 'left', to: 'тройник', toConnector: 'right' },
      },
      {
        name: 'кран в-в',
        generatorId: 'valve.ball',
        params: { ends: 'internal', nominal: '1/2', length: 0.0475, handleLength: 0.053 },
        attach: { connector: 'left', to: 'ниппель справа', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Коллектор: краны на выходах, ниппель и муфта',
    parts: [
      { name: 'коллектор', generatorId: 'steel.manifold', params: { threadGender: 'external', nominal: '1', outletNominal: '1/2', outlets: 3, length: 0.132, branchLength: 0.036 } },
      // Без доворота ручки смотрели бы вдоль трубы (up выхода — +X) и упирались в соседние краны.
      ...[1, 2, 3].map((i) => ({
        name: `кран ${i}`,
        generatorId: 'valve.ball',
        params: { ends: 'internal', nominal: '1/2', length: 0.0475, handleLength: 0.053 },
        attach: { connector: 'left', to: 'коллектор', toConnector: `outlet-${i}`, angle: -90 },
      })),
      {
        name: 'ниппель',
        generatorId: 'steel.nipple',
        params: { nominalLeft: '1', nominalRight: '1', length: 0.034 },
        attach: { connector: 'right', to: 'коллектор', toConnector: 'left' },
      },
      {
        name: 'муфта',
        generatorId: 'steel.coupling',
        params: { nominalLeft: '1', nominalRight: '1', length: 0.035 },
        attach: { connector: 'left', to: 'коллектор', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Стальной радиатор: полусгон, кран, воздухоотводчик, заглушка',
    parts: [
      { name: 'радиатор', generatorId: 'radiator.steel', params: { dimensions: { x: 0.6, y: 0.5, z: 0.07 }, nominal: '1/2' } },
      {
        name: 'воздухоотводчик',
        generatorId: 'radiator.vent',
        params: { nominal: '1/2', kind: 'vent' },
        attach: { connector: 'left', to: 'радиатор', toConnector: 'top-left' },
      },
      {
        name: 'полусгон',
        generatorId: 'steel.half-union',
        params: { nutNominal: '3/4', pipeNominal: '1/2', length: 0.04 },
        attach: { connector: 'pipe', to: 'радиатор', toConnector: 'bottom-left' },
      },
      {
        name: 'заглушка',
        generatorId: 'steel.plug',
        params: { nominal: '1/2', length: 0.022 },
        attach: { connector: 'left', to: 'радиатор', toConnector: 'top-right' },
      },
      {
        name: 'кран с полусгоном',
        generatorId: 'valve.ball-union',
        params: { nominal: '1/2', unionNominal: '3/4', length: 0.055, unionLength: 0.026, handleLength: 0.053 },
        attach: { connector: 'right', to: 'радиатор', toConnector: 'bottom-right' },
      },
    ],
  },
  {
    label: 'ПП и металлопластик на резьбе стальной муфты',
    parts: [
      { name: 'муфта', generatorId: 'steel.coupling', params: { nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 } },
      {
        name: 'соединитель ПП',
        generatorId: 'pp.thread-adapter',
        params: { threadGender: 'external', pipeNominal: '20', threadNominal: '1/2', length: 0.036 },
        attach: { connector: 'right', to: 'муфта', toConnector: 'left' },
      },
      {
        name: 'соединитель МП',
        generatorId: 'mp.thread-adapter',
        params: { threadGender: 'external', pipeNominal: '16', threadNominal: '1/2', length: 0.048 },
        attach: { connector: 'right', to: 'муфта', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Труба ПП: угол, труба, муфта',
    parts: [
      { name: 'угол', generatorId: 'pp.elbow-90', params: { nominal: '20', armLength: 0.026 } },
      {
        name: 'труба',
        generatorId: 'pp.pipe',
        params: { nominal: '20', length: 0.3 },
        attach: { connector: 'start', to: 'угол', toConnector: 'right' },
      },
      {
        name: 'муфта',
        generatorId: 'pp.coupling',
        params: { nominalLeft: '20', nominalRight: '20', length: 0.032 },
        attach: { connector: 'left', to: 'труба', toConnector: 'end' },
      },
    ],
  },
  {
    label: 'Труба МП: угол, труба, соединитель',
    parts: [
      { name: 'угол', generatorId: 'mp.elbow', params: { nominal: '16', armLength: 0.044 } },
      {
        name: 'труба',
        generatorId: 'mp.pipe',
        params: { nominal: '16', length: 0.3 },
        attach: { connector: 'start', to: 'угол', toConnector: 'right' },
      },
      {
        name: 'соединитель',
        generatorId: 'mp.coupling',
        params: { nominalLeft: '16', nominalRight: '16', length: 0.06 },
        attach: { connector: 'left', to: 'труба', toConnector: 'end' },
      },
    ],
  },
  {
    // Проверка стыков; перенос crSborka_zr_nasos_1 как сборки — позже (план переноса, п. 6).
    label: 'Насос: гайки, полусгон',
    parts: [
      { name: 'насос', generatorId: 'equipment.pump', params: { nominal: '1 1/4' } },
      {
        name: 'гайка слева',
        generatorId: 'equipment.pump-nut',
        params: { pumpNominal: '1 1/4', pipeNominal: '1' },
        attach: { connector: 'pump', to: 'насос', toConnector: 'left' },
      },
      {
        name: 'гайка справа',
        generatorId: 'equipment.pump-nut',
        params: { pumpNominal: '1 1/4', pipeNominal: '1' },
        attach: { connector: 'pump', to: 'насос', toConnector: 'right' },
      },
      {
        name: 'полусгон',
        generatorId: 'steel.half-union',
        params: { nutNominal: '1 1/4', pipeNominal: '1', length: 0.052 },
        attach: { connector: 'pipe', to: 'гайка справа', toConnector: 'pipe' },
      },
    ],
  },
  {
    label: 'Котёл: фильтр, муфта, бак',
    parts: [
      { name: 'котёл', generatorId: 'equipment.boiler', params: { dimensions: { x: 0.4, y: 0.73, z: 0.3 }, nominal: '3/4', connection: 'bottom' } },
      {
        name: 'фильтр',
        generatorId: 'equipment.strainer',
        params: { nominal: '3/4', length: 0.065 },
        attach: { connector: 'left', to: 'котёл', toConnector: 'bottom-right' },
      },
      {
        name: 'муфта',
        generatorId: 'steel.coupling',
        params: { nominalLeft: '3/4', nominalRight: '3/4', length: 0.033 },
        attach: { connector: 'left', to: 'котёл', toConnector: 'bottom-left' },
      },
      {
        name: 'бак',
        generatorId: 'equipment.expansion-tank',
        params: { diameter: 0.245, height: 0.25, nominal: '3/4', volume: 6 },
        attach: { connector: 'bottom', to: 'муфта', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Группа безопасности на ниппеле',
    parts: [
      { name: 'ниппель', generatorId: 'steel.nipple', params: { nominalLeft: '1', nominalRight: '1', length: 0.034 } },
      {
        name: 'группа',
        generatorId: 'equipment.safety-group',
        params: { dimensions: { x: 0.18, y: 0.05, z: 0.05 }, nominal: '1' },
        attach: { connector: 'bottom', to: 'ниппель', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Ошибка: труба МП 20 в ПП-раструб 20',
    parts: [
      { name: 'муфта ПП', generatorId: 'pp.coupling', params: { nominalLeft: '20', nominalRight: '20', length: 0.032 } },
      {
        name: 'труба МП',
        generatorId: 'mp.pipe',
        params: { nominal: '20', length: 0.3 },
        attach: { connector: 'start', to: 'муфта ПП', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Ошибка: ниппель 1 прямо в радиатор',
    parts: [
      { name: 'радиатор', generatorId: 'radiator.aluminium', params: radiator(1, 0.2) },
      {
        name: 'ниппель',
        generatorId: 'steel.nipple',
        params: { nominalLeft: '1', nominalRight: '1', length: 0.034 },
        attach: { connector: 'left', to: 'радиатор', toConnector: 'top-right' },
      },
    ],
  },
  {
    label: 'Ошибка: муфта к муфте',
    parts: [
      { name: 'муфта 1', generatorId: 'steel.coupling', params: { nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 } },
      {
        name: 'муфта 2',
        generatorId: 'steel.coupling',
        params: { nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 },
        attach: { connector: 'left', to: 'муфта 1', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Ошибка: ПП-муфта на раструб ПП-угла',
    parts: [
      { name: 'угол', generatorId: 'pp.elbow-90', params: { nominal: '20', armLength: 0.026 } },
      {
        name: 'муфта',
        generatorId: 'pp.coupling',
        params: { nominalLeft: '20', nominalRight: '20', length: 0.032 },
        attach: { connector: 'left', to: 'угол', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Ошибка: металлопластик на ПП-раструб того же диаметра',
    parts: [
      { name: 'угол ПП', generatorId: 'pp.elbow-90', params: { nominal: '20', armLength: 0.026 } },
      {
        name: 'угол МП',
        generatorId: 'mp.elbow',
        params: { nominal: '20', armLength: 0.044 },
        attach: { connector: 'right', to: 'угол ПП', toConnector: 'top' },
      },
    ],
  },
  {
    label: 'Ошибка: ниппель 3/4 в муфту 1/2',
    parts: [
      { name: 'муфта', generatorId: 'steel.coupling', params: { nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 } },
      {
        name: 'ниппель',
        generatorId: 'steel.nipple',
        params: { nominalLeft: '3/4', nominalRight: '3/4', length: 0.022 },
        attach: { connector: 'left', to: 'муфта', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Новые модели: радиатор с угловым термоклапаном и обраткой',
    parts: [
      { name: 'радиатор', generatorId: 'radiator.steel', params: { dimensions: { x: 0.6, y: 0.5, z: 0.07 }, nominal: '1/2' } },
      { name: 'термоклапан', generatorId: 'valve.thermostatic-angle', params: { nominal: '1/2', armLength: 0.04, head: 'thermostatic' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'top-right' } },
      { name: 'обратка', generatorId: 'valve.lockshield', params: { nominal: '1/2', armLength: 0.035, configuration: 'angle' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'bottom-right' } },
    ],
  },
  {
    label: 'Новые модели: американка, обратный клапан и слив',
    parts: [
      { name: 'обратный клапан', generatorId: 'valve.check', params: { nominal: '1/2', length: 0.055, flow: 'left-to-right' } },
      { name: 'американка', generatorId: 'steel.union', params: { nominal: '1/2', armLength: 0.035, configuration: 'straight' },
        attach: { connector: 'outlet', to: 'обратный клапан', toConnector: 'left' } },
      { name: 'ниппель', generatorId: 'steel.nipple', params: { nominalLeft: '1/2', nominalRight: '1/2', length: 0.022 },
        attach: { connector: 'left', to: 'обратный клапан', toConnector: 'right' } },
      { name: 'тройник', generatorId: 'steel.tee', params: { threadGender: 'internal', nominalLeft: '1/2', nominalRight: '1/2', nominalBranch: '1/2', length: 0.046, branchLength: 0.023 },
        attach: { connector: 'left', to: 'ниппель', toConnector: 'right' } },
      { name: 'слив', generatorId: 'valve.drain', params: { nominal: '1/2', hoseNominal: '13', length: 0.06 },
        attach: { connector: 'inlet', to: 'тройник', toConnector: 'top' } },
    ],
  },
  {
    label: 'Новые модели: футорка и внутренняя заглушка',
    parts: [
      { name: 'муфта', generatorId: 'steel.coupling', params: { nominalLeft: '3/4', nominalRight: '3/4', length: 0.033 } },
      { name: 'футорка', generatorId: 'steel.bushing', params: { outerNominal: '3/4', innerNominal: '1/2', length: 0.025 },
        attach: { connector: 'left', to: 'муфта', toConnector: 'right' } },
      { name: 'ниппель', generatorId: 'steel.nipple', params: { nominalLeft: '1/2', nominalRight: '1/2', length: 0.022 },
        attach: { connector: 'left', to: 'футорка', toConnector: 'right' } },
      { name: 'заглушка', generatorId: 'steel.cap', params: { nominal: '1/2', length: 0.022 },
        attach: { connector: 'left', to: 'ниппель', toConnector: 'right' } },
    ],
  },
  {
    label: 'Ошибка: обычная резьба вместо евроконуса H-блока',
    parts: [
      { name: 'H-блок', generatorId: 'valve.radiator-h-block', params: { radiatorNominal: '3/4', pipeNominal: '3/4', spacing: 0.05, height: 0.06, configuration: 'angle' } },
      { name: 'муфта', generatorId: 'steel.coupling', params: { nominalLeft: '3/4', nominalRight: '3/4', length: 0.033 },
        attach: { connector: 'left', to: 'H-блок', toConnector: 'pipe-left' } },
    ],
  },
];
