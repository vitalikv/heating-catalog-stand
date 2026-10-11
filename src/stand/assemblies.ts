import type { AluminiumRadiatorParams, AssemblyDefinition, AssemblyPart } from '../lib/index';

const radiator = (sections: number, height: number): AluminiumRadiatorParams => ({ sections, dimensions: { x: 0.08, y: height, z: 0.08 }, nominal: '1' });

/**
 * Стальной радиатор с нижним подключением (версия 2): ниппели каталога 3/4 × 1/2 концом 1/2 в обе нижние резьбы,
 * H-блок ставится по одному разъёму, второй его порт замыкается на ниппель B (closures).
 * При совмещении up H-блок разворачивается на π вокруг вертикали, поэтому к ниппелю A у торца
 * идёт противоположный по названию порт: при паре справа — radiator-left.
 */
export function steelBottomHBlock(bottomSide: 'right' | 'left'): AssemblyDefinition {
  const nipple = { nominalLeft: '3/4', nominalRight: '1/2', length: 0.026 };
  return {
    label: `Стальной радиатор снизу (${bottomSide === 'right' ? 'справа' : 'слева'}): ниппели, H-блок, евроконус → МП`,
    parts: [
      { name: 'радиатор', generatorId: 'radiator.steel',
        params: { dimensions: { x: 0.6, y: 0.5, z: 0.07 }, nominal: '1/2', connection: 'bottom', bottomSide } },
      { name: 'ниппель A', generatorId: 'steel.nipple', params: nipple, attach: { connector: 'right', to: 'радиатор', toConnector: 'below-outer' } },
      { name: 'ниппель B', generatorId: 'steel.nipple', params: nipple, attach: { connector: 'right', to: 'радиатор', toConnector: 'below-inner' } },
      { name: 'H-блок', generatorId: 'valve.radiator-h-block',
        params: { radiatorNominal: '3/4', pipeNominal: '3/4', spacing: 0.05, height: 0.06, configuration: 'straight' },
        attach: { connector: bottomSide === 'right' ? 'radiator-left' : 'radiator-right', to: 'ниппель A', toConnector: 'left' } },
      // Звено «евроконус → МП-труба» (часть 22): обжимной адаптер и отрезок трубы на каждом выходе.
      ...(['left', 'right'] as const).flatMap((side) => [
        { name: `адаптер ${side}`, generatorId: 'mp.eurocone-adapter', params: { pipeNominal: '16', euroconeNominal: '3/4', length: 0.026 },
          attach: { connector: 'eurocone', to: 'H-блок', toConnector: `pipe-${side}` } },
        { name: `труба ${side}`, generatorId: 'mp.pipe', params: { nominal: '16', length: 0.15 },
          attach: { connector: 'start', to: `адаптер ${side}`, toConnector: 'pipe' } },
      ]),
    ],
    closures: [{ part: 'H-блок', connector: bottomSide === 'right' ? 'radiator-right' : 'radiator-left', to: 'ниппель B', toConnector: 'left' }],
  };
}

const MANIFOLD_1 = { nominal: '1', outletEnd: 'eurocone', outletNominal: '1/2', mainEnd: 'internal', endPorts: 'vent-drain' } as const;

/**
 * Концевой узел 70 на коллекторе collector: отсекающий клапан VT.539 и автоматический
 * воздухоотводчик VT.502.NH (как в комплекте блоков VALTEC), слив, пробка; ниппель магистрали.
 */
function manifoldEnds(collector: string, suffix = ''): AssemblyPart[] {
  return [
    { name: `отсекающий клапан${suffix}`, generatorId: 'valve.vent-shutoff', params: {},
      attach: { connector: 'inlet', to: collector, toConnector: 'vent' } },
    { name: `воздухоотводчик${suffix}`, generatorId: 'equipment.air-vent', params: { execution: 'NH' },
      attach: { connector: 'inlet', to: `отсекающий клапан${suffix}`, toConnector: 'vent' } },
    { name: `слив${suffix}`, generatorId: 'valve.drain', params: { nominal: '1/2', hoseNominal: '16', length: 0.06 },
      attach: { connector: 'inlet', to: collector, toConnector: 'drain' } },
    { name: `пробка${suffix}`, generatorId: 'steel.plug', params: { nominal: '1', length: 0.03 },
      attach: { connector: 'left', to: collector, toConnector: 'end' } },
    { name: `ниппель магистрали${suffix}`, generatorId: 'steel.nipple', params: { nominalLeft: '1', nominalRight: '1', length: 0.044 },
      attach: { connector: 'right', to: collector, toConnector: 'main' } },
  ];
}

/** Контур МП 16 на выходе outlet: адаптер евроконуса и отрезок трубы. */
function manifoldContour(collector: string, outlet: number, pipeLength: number, suffix = ''): AssemblyPart[] {
  return [
    { name: `адаптер${suffix}`, generatorId: 'mp.eurocone-adapter', params: { pipeNominal: '16', euroconeNominal: '3/4', length: 0.026 },
      attach: { connector: 'eurocone', to: collector, toConnector: `out-${outlet}` } },
    { name: `труба${suffix}`, generatorId: 'mp.pipe', params: { nominal: '16', length: pipeLength },
      attach: { connector: 'start', to: `адаптер${suffix}`, toConnector: 'pipe' } },
  ];
}

/** Сервоприводы 69 на всех посадочных местах коллектора. */
function manifoldActuators(collector: string, outlets: number): AssemblyPart[] {
  return Array.from({ length: outlets }, (_, i) => ({ name: `привод ${i + 1}`, generatorId: 'valve.thermoelectric-actuator',
    params: { state: 'closed' }, attach: { connector: 'valve', to: collector, toConnector: `head-${i + 1}` } }));
}

/**
 * Обратный коллектор тёплого пола (68) под приводы: сервоприводы 69 на всех выходах, концевой
 * узел 70, ниппель магистрали и первый контур на МП-трубе.
 */
export function manifoldReturnNode(outlets = 4): AssemblyDefinition {
  return {
    label: `Коллектор обратный 1" × ${outlets}: приводы, концевой узел, контур МП 16`,
    parts: [
      { name: 'коллектор', generatorId: 'manifold.brass', params: { ...MANIFOLD_1, outlets, inserts: 'thermostatic', head: 'none' } },
      ...manifoldActuators('коллектор', outlets),
      ...manifoldEnds('коллектор'),
      ...manifoldContour('коллектор', 1, 0.15),
    ],
  };
}

/**
 * Разнос осей пары гребёнок, м: обратная выше подающей на 200 мм и на 32 мм ближе к стене (−Z) —
 * VALTEC VTc.IV130 (каталог 2017, с. 202) и общие размеры R, S блока VTc.596EMNX.
 */
export const MANIFOLD_PAIR_OFFSET = { x: 0, y: 0.2, z: -0.032 };

/**
 * Пара гребёнок тёплого пола 67/68: подающая с расходомерами стоит в начале координат, обратная
 * под приводы — явным положением относительно неё (между гребёнками нет разъёмов, часть 16).
 * Контур 1 подключён к обеим гребёнкам; труба обратки проходит за подающей гребёнкой.
 */
export function manifoldPair(outlets = 4): AssemblyDefinition {
  return {
    label: `Пара коллекторов 1" × ${outlets}: расходомеры, приводы, концевые узлы, контур 1`,
    parts: [
      { name: 'подающий', generatorId: 'manifold.brass', params: { ...MANIFOLD_1, outlets, inserts: 'flowmeter', head: 'handle' } },
      { name: 'обратный', generatorId: 'manifold.brass', params: { ...MANIFOLD_1, outlets, inserts: 'thermostatic', head: 'none' },
        placement: { at: MANIFOLD_PAIR_OFFSET, relativeTo: 'подающий' } },
      ...manifoldActuators('обратный', outlets),
      ...manifoldEnds('подающий', ' подачи'),
      ...manifoldEnds('обратный', ' обратки'),
      ...manifoldContour('подающий', 1, 0.15, ' подачи'),
      ...manifoldContour('обратный', 1, 0.35, ' обратки'),
    ],
  };
}

/**
 * Замена фильтра в обвязке котла (часть 29): котёл → муфта → ниппель вниз → угол → ниппель →
 * фильтр на горизонтальном участке колбой вниз (монтаж по паспорту VALTEC). Длинный ниппель
 * опускает фильтр, чтобы манометр промывного фильтра не упирался в котёл.
 */
export function boilerFilter(generatorId: 'equipment.strainer-straight' | 'equipment.flush-filter' | 'equipment.separator', params: unknown, name: string): AssemblyDefinition {
  return {
    label: `Котёл: ${name} на горизонтальном участке`,
    parts: [
      { name: 'котёл', generatorId: 'equipment.boiler', params: { dimensions: { x: 0.4, y: 0.73, z: 0.3 }, nominal: '3/4', connection: 'bottom' } },
      { name: 'муфта', generatorId: 'steel.coupling', params: { nominalLeft: '3/4', nominalRight: '3/4', length: 0.033 },
        attach: { connector: 'left', to: 'котёл', toConnector: 'bottom-right' } },
      { name: 'ниппель вниз', generatorId: 'steel.nipple', params: { nominalLeft: '3/4', nominalRight: '3/4', length: 0.12 },
        attach: { connector: 'left', to: 'муфта', toConnector: 'right' } },
      { name: 'угол', generatorId: 'steel.elbow-90', params: { threadGender: 'internal', nominal: '3/4', armLength: 0.03 },
        attach: { connector: 'top', to: 'ниппель вниз', toConnector: 'right' } },
      { name: 'ниппель', generatorId: 'steel.nipple', params: { nominalLeft: '3/4', nominalRight: '3/4', length: 0.04 },
        attach: { connector: 'left', to: 'угол', toConnector: 'right' } },
      { name: 'фильтр', generatorId, params, attach: { connector: 'left', to: 'ниппель', toConnector: 'right' } },
    ],
  };
}

/** Подбираемые длины узла 72, м: вертикальный и диагональный ниппели байпаса, муфта обратки. */
export const MIXING_UNIT_FIT = { bypass: 0.0537, jog: 0.0247, returnCoupling: 0.0512 };

/**
 * Насосно-смесительный узел 72 по схеме VALTEC для VT.MIX03 (технический каталог 2017, с. 371,
 * пример 4): подача котла → кран → трёхходовой клапан (left — горячий, right — смешанный) →
 * ниппель → гайка → насос VRS 25/6-180 → гайка → anchor (подающая гребёнка или её ниппель).
 * Ход top клапана — байпас вверх, к тройнику обратной линии: ниппель, два угла 45° (сдвиг к стене
 * на 32 мм, как у обратной гребёнки на VTc.IV130), ниппель. Тройник: left — кран к котлу,
 * right — ниппель и муфта к обратной гребёнке (свободная граница T21 «муфта обратки».right).
 * fit — длины, подобранные под замыкание на обратной гребёнке пары (сборка 123).
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

/** Узел 72 отдельно: ниппель T11 в начале координат вместо подающей гребёнки. */
export function mixingUnit(): AssemblyDefinition {
  return {
    label: 'Насосно-смесительный узел 1": клапан VT.MIX03, насос VRS, байпас, краны котла',
    parts: [
      { name: 'ниппель T11', generatorId: 'steel.nipple', params: { nominalLeft: '1', nominalRight: '1', length: 0.044 } },
      ...mixingUnitParts({ to: 'ниппель T11', toConnector: 'left' }),
    ],
  };
}

/**
 * Петля контура 1 в координатах пары гребёнок, м: от места посадки в адаптере подающей гребёнки
 * (ввод 11,18 мм) вниз до пола, по полу вперёд, вбок и назад, вверх к адаптеру обратной гребёнки
 * (на 32 мм ближе к стене). Условная петля: проверяет замыкание, не раскладку по помещению.
 */
const FLOOR_LOOP: readonly { x: number; y: number; z: number }[] = [
  { x: -0.1, y: -0.04266, z: 0 }, { x: -0.1, y: -0.45, z: 0 }, { x: -0.1, y: -0.45, z: 0.5 }, { x: 0.3, y: -0.45, z: 0.5 },
  { x: 0.3, y: -0.45, z: -0.032 }, { x: -0.1, y: -0.45, z: -0.032 }, { x: -0.1, y: 0.15734, z: -0.032 },
];

/**
 * Полный узел тёплого пола 123: пара гребёнок 67/68 с приводами, концевыми узлами и адаптерами 63
 * на выходах контура 1, насосно-смесительный узел 72 на магистрали подающей гребёнки.
 * Замыкания вне дерева attach: обратная линия узла 72 — на ниппель магистрали обратной гребёнки;
 * петля контура (труба МП по траектории, явное положение) — обоими концами на адаптеры.
 */
export function floorHeatingNode(outlets = 4, fit = MIXING_UNIT_FIT): AssemblyDefinition {
  const pair = manifoldPair(outlets).parts.filter((part) => part.generatorId !== 'mp.pipe');
  return {
    label: `Узел тёплого пола 1" × ${outlets}: пара гребёнок, смесительный узел, петля контура 1`,
    parts: [
      ...pair,
      { name: 'петля контура 1', generatorId: 'mp.pipe-path', params: { nominal: '16', bendRadius: 0.08, path: FLOOR_LOOP },
        placement: { at: { x: 0, y: 0, z: 0 }, relativeTo: 'подающий' } },
      ...mixingUnitParts({ to: 'ниппель магистрали подачи', toConnector: 'left' }, fit),
    ],
    closures: [
      { part: 'муфта обратки', connector: 'right', to: 'ниппель магистрали обратки', toConnector: 'left' },
      { part: 'петля контура 1', connector: 'start', to: 'адаптер подачи', toConnector: 'pipe' },
      { part: 'петля контура 1', connector: 'end', to: 'адаптер обратки', toConnector: 'pipe' },
    ],
  };
}

/** Доворот стыков обвязки 124, градусы: подобран так, что отводы тройников смотрят вверх или вниз, приборы — вперёд. */
const BOILER_ROOM_ANGLES = {
  supplyElbow: 180, safetyTee: 0, gaugeTee: 0, riserElbow: 0, module: 0,
  returnElbow: 0, drainTee: 180, tankTee: 180, separator: 0, strainer: 0,
};

/**
 * Типовая обвязка котельной 124: котёл с нижним подключением 1", внешний насос и внешняя группа
 * безопасности. Подача (вправо): муфта, ниппель вниз, угол, тройник с группой безопасности 1",
 * тройник с термоманометром, угол вверх и прямой насосный модуль 105; его верхний кран — выход в систему.
 * Обратка (влево): тройник со сливным краном заполнения/слива (отвод вниз), тройник с расширительным
 * баком через сервисный кран 3/4, магнитный грязеуловитель, косой фильтр, кран — вход из системы.
 * Свободные границы: «кран верхний».right (подача), «кран обратки системы».left (обратка),
 * штуцер сливного крана, слив грязеуловителя, выпуски воздухоотводчика и группы безопасности.
 */
export function boilerRoom(angles = BOILER_ROOM_ANGLES): AssemblyDefinition {
  const nipple = (length: number, nominal = '1') => ({ nominalLeft: nominal, nominalRight: nominal, length });
  const tee = (branch: string) => ({ threadGender: 'internal', nominalLeft: '1', nominalBranch: branch, nominalRight: '1', length: 0.06, branchLength: 0.03 });
  const elbow = { threadGender: 'internal', nominal: '1', armLength: 0.035 };
  const ball = (nominal: string, length: number, handleLength: number) => ({ ends: 'internal', nominal, length, handleLength });
  return {
    label: 'Обвязка котельной 124: котёл 1", насосный модуль, группа безопасности, бак, грязеуловитель, фильтр, слив',
    parts: [
      { name: 'котёл', generatorId: 'equipment.boiler', params: { dimensions: { x: 0.4, y: 0.73, z: 0.3 }, nominal: '1', connection: 'bottom' } },
      // Подача.
      { name: 'муфта подачи', generatorId: 'steel.coupling', params: { nominalLeft: '1', nominalRight: '1', length: 0.04 },
        attach: { connector: 'left', to: 'котёл', toConnector: 'bottom-right' } },
      { name: 'ниппель подачи вниз', generatorId: 'steel.nipple', params: nipple(0.18), attach: { connector: 'left', to: 'муфта подачи', toConnector: 'right' } },
      { name: 'угол подачи', generatorId: 'steel.elbow-90', params: elbow,
        attach: { connector: 'top', to: 'ниппель подачи вниз', toConnector: 'right', angle: angles.supplyElbow } },
      { name: 'ниппель подачи', generatorId: 'steel.nipple', params: nipple(0.2), attach: { connector: 'left', to: 'угол подачи', toConnector: 'right' } },
      { name: 'тройник безопасности', generatorId: 'steel.tee', params: tee('1'),
        attach: { connector: 'left', to: 'ниппель подачи', toConnector: 'right', angle: angles.safetyTee } },
      { name: 'ниппель группы', generatorId: 'steel.nipple', params: nipple(0.044), attach: { connector: 'left', to: 'тройник безопасности', toConnector: 'top' } },
      { name: 'группа безопасности', generatorId: 'equipment.safety-group', params: { dimensions: { x: 0.18, y: 0.05, z: 0.05 }, nominal: '1' },
        attach: { connector: 'bottom', to: 'ниппель группы', toConnector: 'right' } },
      { name: 'ниппель КИП', generatorId: 'steel.nipple', params: nipple(0.12), attach: { connector: 'left', to: 'тройник безопасности', toConnector: 'right' } },
      { name: 'тройник КИП подачи', generatorId: 'steel.tee', params: tee('1/2'),
        attach: { connector: 'left', to: 'ниппель КИП', toConnector: 'right', angle: angles.gaugeTee } },
      { name: 'термоманометр подачи', generatorId: 'equipment.gauge', params: { kind: 'thermomanometer', diameter: 80, connection: 'bottom', nominal: '1/2', probe: 0.05 },
        attach: { connector: 'connection', to: 'тройник КИП подачи', toConnector: 'top', angle: 180 } },
      { name: 'ниппель к стояку', generatorId: 'steel.nipple', params: nipple(0.1), attach: { connector: 'left', to: 'тройник КИП подачи', toConnector: 'right' } },
      { name: 'угол стояка', generatorId: 'steel.elbow-90', params: elbow,
        attach: { connector: 'right', to: 'ниппель к стояку', toConnector: 'right', angle: angles.riserElbow } },
      { name: 'ниппель стояка', generatorId: 'steel.nipple', params: nipple(0.044), attach: { connector: 'left', to: 'угол стояка', toConnector: 'top' } },
      ...pumpModuleParts({ attach: { connector: 'left', to: 'ниппель стояка', toConnector: 'right', angle: angles.module } }),
      // Обратка.
      { name: 'муфта обратки', generatorId: 'steel.coupling', params: { nominalLeft: '1', nominalRight: '1', length: 0.04 },
        attach: { connector: 'left', to: 'котёл', toConnector: 'bottom-left' } },
      { name: 'ниппель обратки вниз', generatorId: 'steel.nipple', params: nipple(0.18), attach: { connector: 'left', to: 'муфта обратки', toConnector: 'right' } },
      { name: 'угол обратки', generatorId: 'steel.elbow-90', params: elbow,
        attach: { connector: 'top', to: 'ниппель обратки вниз', toConnector: 'right', angle: angles.returnElbow } },
      { name: 'ниппель обратки', generatorId: 'steel.nipple', params: nipple(0.15), attach: { connector: 'left', to: 'угол обратки', toConnector: 'right' } },
      { name: 'тройник слива', generatorId: 'steel.tee', params: tee('1/2'),
        attach: { connector: 'left', to: 'ниппель обратки', toConnector: 'right', angle: angles.drainTee } },
      { name: 'кран заполнения/слива', generatorId: 'valve.drain', params: { nominal: '1/2', hoseNominal: '16', length: 0.06 },
        attach: { connector: 'inlet', to: 'тройник слива', toConnector: 'top' } },
      { name: 'ниппель бака', generatorId: 'steel.nipple', params: nipple(0.12), attach: { connector: 'left', to: 'тройник слива', toConnector: 'right' } },
      // Бак — дальше от котла, чтобы не заходить под его дно.
      { name: 'тройник бака', generatorId: 'steel.tee', params: tee('3/4'),
        attach: { connector: 'left', to: 'ниппель бака', toConnector: 'right', angle: angles.tankTee } },
      { name: 'ниппель отвода бака', generatorId: 'steel.nipple', params: nipple(0.044, '3/4'), attach: { connector: 'left', to: 'тройник бака', toConnector: 'top' } },
      { name: 'сервисный кран бака', generatorId: 'valve.ball', params: ball('3/4', 0.0555, 0.053),
        attach: { connector: 'left', to: 'ниппель отвода бака', toConnector: 'right' } },
      { name: 'бак', generatorId: 'equipment.expansion-tank', params: { diameter: 0.245, height: 0.25, nominal: '3/4', volume: 6 },
        attach: { connector: 'bottom', to: 'сервисный кран бака', toConnector: 'right' } },
      { name: 'ниппель грязеуловителя', generatorId: 'steel.nipple', params: nipple(0.044), attach: { connector: 'left', to: 'тройник бака', toConnector: 'right' } },
      { name: 'грязеуловитель', generatorId: 'equipment.separator', params: { kind: 'magnetic', nominal: '1', ends: 'internal' },
        attach: { connector: 'right', to: 'ниппель грязеуловителя', toConnector: 'right', angle: angles.separator } },
      { name: 'ниппель фильтра', generatorId: 'steel.nipple', params: nipple(0.044), attach: { connector: 'right', to: 'грязеуловитель', toConnector: 'left' } },
      { name: 'фильтр', generatorId: 'equipment.strainer', params: { nominal: '1', length: 0.077 },
        attach: { connector: 'right', to: 'ниппель фильтра', toConnector: 'left', angle: angles.strainer } },
      { name: 'ниппель крана обратки', generatorId: 'steel.nipple', params: nipple(0.044), attach: { connector: 'right', to: 'фильтр', toConnector: 'left' } },
      { name: 'кран обратки системы', generatorId: 'valve.ball', params: ball('1', 0.0625, 0.06),
        attach: { connector: 'right', to: 'ниппель крана обратки', toConnector: 'left' } },
    ],
  };
}

/**
 * Прямой насосный модуль 105 по образцу подающей линии VALTEC VT.VAR 10 (технический каталог 2017,
 * с. 250), вертикально снизу вверх: кран шаровой 1" → ниппель → гайка 1 1/2 × 1 → насос VRS 25/6-180 →
 * гайка → ниппель → обратный клапан VT.161 1" → ниппель → тройник 1 × 1/2 × 1 → ниппель → кран.
 * В отвод тройника — угловой автоматический воздухоотводчик VT.502.NA; термоманометр — на втором тройнике.
 * Тройники довёрнуты на 90°: отводы смотрят вперёд (+Z), воздухоотводчик стоит колбой вверх,
 * циферблат — вперёд; мотор насоса вперёд, клеммная коробка сбоку (вниз паспорт VRS запрещает).
 */
export function pumpModule(): AssemblyDefinition {
  return {
    label: 'Насосный модуль прямой 1": краны, насос VRS, обратный клапан, термоманометр, воздухоотводчик',
    // Нижний кран повёрнут на 90° вокруг Z: левый конец смотрит вниз, правый — вверх.
    parts: pumpModuleParts({ placement: { at: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 90 } } }),
  };
}

/** Детали модуля 105; start — как ставится нижний кран (явное положение или attach его левого конца). */
export function pumpModuleParts(start: Pick<AssemblyPart, 'attach' | 'placement'>): AssemblyPart[] {
  const nipple = { nominalLeft: '1', nominalRight: '1', length: 0.044 };
  const tee = { threadGender: 'internal', nominalLeft: '1', nominalBranch: '1/2', nominalRight: '1', length: 0.06, branchLength: 0.03 };
  return [
    { name: 'кран нижний', generatorId: 'valve.ball', params: { ends: 'internal', nominal: '1', length: 0.0625, handleLength: 0.06 }, ...start },
    { name: 'ниппель 1', generatorId: 'steel.nipple', params: nipple, attach: { connector: 'left', to: 'кран нижний', toConnector: 'right' } },
    { name: 'гайка нижняя', generatorId: 'equipment.pump-nut', params: { pumpNominal: '1 1/2', pipeNominal: '1' },
      attach: { connector: 'pipe', to: 'ниппель 1', toConnector: 'right' } },
    { name: 'насос', generatorId: 'equipment.pump', params: { nominal: '1 1/2', installLength: 0.18, housing: 'vrs', motor: 'small', terminalBox: 'top' },
      attach: { connector: 'left', to: 'гайка нижняя', toConnector: 'pump' } },
    { name: 'гайка верхняя', generatorId: 'equipment.pump-nut', params: { pumpNominal: '1 1/2', pipeNominal: '1' },
      attach: { connector: 'pump', to: 'насос', toConnector: 'right' } },
    { name: 'ниппель 2', generatorId: 'steel.nipple', params: nipple, attach: { connector: 'left', to: 'гайка верхняя', toConnector: 'pipe' } },
    { name: 'обратный клапан', generatorId: 'valve.check', params: { nominal: '1', length: 0.058, flow: 'left-to-right' },
      attach: { connector: 'left', to: 'ниппель 2', toConnector: 'right' } },
    { name: 'ниппель 3', generatorId: 'steel.nipple', params: nipple, attach: { connector: 'left', to: 'обратный клапан', toConnector: 'right' } },
    { name: 'тройник КИП', generatorId: 'steel.tee', params: tee, attach: { connector: 'left', to: 'ниппель 3', toConnector: 'right', angle: 90 } },
    { name: 'термоманометр', generatorId: 'equipment.gauge', params: { kind: 'thermomanometer', diameter: 80, connection: 'back', nominal: '1/2', probe: 0.05 },
      attach: { connector: 'connection', to: 'тройник КИП', toConnector: 'top' } },
    { name: 'ниппель 4', generatorId: 'steel.nipple', params: nipple, attach: { connector: 'left', to: 'тройник КИП', toConnector: 'right' } },
    { name: 'тройник воздуха', generatorId: 'steel.tee', params: tee, attach: { connector: 'left', to: 'ниппель 4', toConnector: 'right', angle: 90 } },
    { name: 'воздухоотводчик', generatorId: 'equipment.air-vent', params: { execution: 'NA' },
      attach: { connector: 'inlet', to: 'тройник воздуха', toConnector: 'top' } },
    { name: 'ниппель 5', generatorId: 'steel.nipple', params: nipple, attach: { connector: 'left', to: 'тройник воздуха', toConnector: 'right' } },
    { name: 'кран верхний', generatorId: 'valve.ball', params: { ends: 'internal', nominal: '1', length: 0.0625, handleLength: 0.06 },
      attach: { connector: 'left', to: 'ниппель 5', toConnector: 'right' } },
  ];
}

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
    // Часть 28: насос VRS по монтажной длине 180 мм, гайки G1 1/2 × 1 и ниппели к трубе.
    label: 'Насос VRS 25/6-180: гайки 1 1/2 × 1, ниппели',
    parts: [
      { name: 'насос', generatorId: 'equipment.pump',
        params: { nominal: '1 1/2', installLength: 0.18, housing: 'vrs', motor: 'small', terminalBox: 'left' } },
      ...(['left', 'right'] as const).flatMap((side) => [
        { name: `гайка ${side}`, generatorId: 'equipment.pump-nut', params: { pumpNominal: '1 1/2', pipeNominal: '1' },
          attach: { connector: 'pump', to: 'насос', toConnector: side } },
        { name: `ниппель ${side}`, generatorId: 'steel.nipple', params: { nominalLeft: '1', nominalRight: '1', length: 0.044 },
          attach: { connector: 'left', to: `гайка ${side}`, toConnector: 'pipe' } },
      ]),
    ],
  },
  {
    // Часть 13: смесительный клапан VT.MIX03 1" — ниппели на ходах, справа гайка и насос VRS 25/6-180.
    label: 'Клапан 3-ходовой 1: ниппели, гайка 1 1/2 × 1, насос VRS',
    parts: [
      { name: 'клапан', generatorId: 'valve.mixing', params: { ways: 3, nominal: '1', control: 'handle' } },
      ...(['left', 'top', 'right'] as const).map((side) => ({
        name: `ниппель ${side}`, generatorId: 'steel.nipple', params: { nominalLeft: '1', nominalRight: '1', length: 0.044 },
        attach: { connector: 'left', to: 'клапан', toConnector: side },
      })),
      { name: 'гайка', generatorId: 'equipment.pump-nut', params: { pumpNominal: '1 1/2', pipeNominal: '1' },
        attach: { connector: 'pipe', to: 'ниппель right', toConnector: 'right' } },
      { name: 'насос', generatorId: 'equipment.pump',
        params: { nominal: '1 1/2', installLength: 0.18, housing: 'vrs', motor: 'small', terminalBox: 'top' },
        attach: { connector: 'left', to: 'гайка', toConnector: 'pump' } },
    ],
  },
  boilerFilter('equipment.strainer-straight', { nominal: '3/4', ends: 'internal', length: 0.068, height: 0.058, bottom: 'cap' }, 'прямой фильтр 3/4'),
  boilerFilter('equipment.flush-filter', { nominal: '3/4', gauge: 'manometer' }, 'промывной фильтр 3/4 с манометром'),
  pumpModule(),
  mixingUnit(),
  floorHeatingNode(),
  boilerRoom(),
  boilerFilter('equipment.separator', { kind: 'combined', nominal: '3/4', ends: 'union' }, 'грязе- и воздухоотделитель 3/4'),
  {
    // Часть 18: приборы на трубе 3/4 — термоманометр и термометр прямо в отводы 1/2, манометр через футорку 1/2 × 1/4.
    // Радиальный прибор на выходе вверх — угол стыка 180°: up выхода вниз по соглашению −X, без доворота циферблат смотрел бы назад.
    label: 'Приборы на тройниках 3/4: термоманометр, манометр, термометр',
    parts: [
      ...[1, 2, 3].flatMap((i) => [
        ...(i > 1 ? [{ name: `ниппель ${i}`, generatorId: 'steel.nipple', params: { nominalLeft: '3/4', nominalRight: '3/4', length: 0.04 },
          attach: { connector: 'left', to: `тройник ${i - 1}`, toConnector: 'right' } }] : []),
        { name: `тройник ${i}`, generatorId: 'steel.tee',
          params: { threadGender: 'internal', nominalLeft: '3/4', nominalBranch: '1/2', nominalRight: '3/4', length: 0.052, branchLength: 0.026 },
          ...(i > 1 ? { attach: { connector: 'left', to: `ниппель ${i}`, toConnector: 'right' } } : {}) },
      ]),
      { name: 'термоманометр', generatorId: 'equipment.gauge', params: { kind: 'thermomanometer', diameter: 80, connection: 'bottom', nominal: '1/2', probe: 0.05 },
        attach: { connector: 'connection', to: 'тройник 1', toConnector: 'top', angle: 180 } },
      { name: 'футорка', generatorId: 'steel.bushing', params: { outerNominal: '1/2', innerNominal: '1/4', length: 0.022 },
        attach: { connector: 'left', to: 'тройник 2', toConnector: 'top' } },
      { name: 'манометр', generatorId: 'equipment.gauge', params: { kind: 'manometer', diameter: 63, connection: 'bottom', nominal: '1/4', probe: 0.05 },
        attach: { connector: 'connection', to: 'футорка', toConnector: 'right', angle: 180 } },
      { name: 'термометр', generatorId: 'equipment.gauge', params: { kind: 'thermometer', diameter: 63, connection: 'back', nominal: '1/2', probe: 0.05 },
        attach: { connector: 'connection', to: 'тройник 3', toConnector: 'top' } },
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
  steelBottomHBlock('right'),
  manifoldReturnNode(),
  manifoldPair(),
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
