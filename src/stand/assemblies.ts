import { ASSEMBLY_RECIPES } from '../lib/index';
import { MIXING_UNIT_FIT, mixingUnitParts } from '../lib/assembly/recipes/mixingUnit';
import { bottomHBlockParts } from '../lib/assembly/recipes/radiatorHBlock';
import { radiatorPipework } from '../lib/assembly/recipes/radiatorPipework';
import type { AluminiumRadiatorParams, AssemblyDefinition, AssemblyPart, Vector3Data } from '../lib/index';

/** Производственный рецепт библиотеки по ID: стенд показывает те же узлы, что идут в пакет. */
function recipe(id: string) {
  const found = ASSEMBLY_RECIPES.find((item) => item.id === id);
  if (!found) throw new Error(`Нет рецепта ${id}`);
  return found;
}

const PUMP_MODULE = recipe('assembly.pump-module');

const radiator = (sections: number, height: number): AluminiumRadiatorParams => ({ sections, dimensions: { x: 0.08, y: height, z: 0.08 }, nominal: '1' });

/**
 * Стальной радиатор с нижним подключением (версия 2): ниппели каталога 3/4 × 1/2 концом 1/2 в обе нижние резьбы,
 * H-блок ставится по одному разъёму, второй его порт замыкается на ниппель B (closures).
 * При совмещении up H-блок разворачивается на π вокруг вертикали, поэтому к ниппелю A у торца
 * идёт противоположный по названию порт: при паре справа — radiator-left.
 */
export function steelBottomHBlock(bottomSide: 'right' | 'left', shutoff: 'none' | 'ball' = 'none'): AssemblyDefinition {
  const radiatorPart: AssemblyPart = { name: 'радиатор', generatorId: 'radiator.steel',
    params: { dimensions: { x: 0.6, y: 0.5, z: 0.07 }, nominal: '1/2', connection: 'bottom', bottomSide } };
  return bottomHBlock('Стальной', radiatorPart, bottomSide, shutoff);
}

/**
 * Алюминиевый радиатор с нижним подключением (позиция 125, версия 2): та же схема, что у стального, —
 * ниппели 3/4 × 1/2 в нижние патрубки bottomNominal 1/2, H-блок, замыкание второго порта, евроконус → МП.
 * Боковые порты закрыты радиаторными воздухоотводчиком и заглушками своей системы radiator-thread.
 */
export function aluminiumBottomHBlock(bottomSide: 'right' | 'left', sections = 6): AssemblyDefinition {
  const radiatorPart: AssemblyPart = { name: 'радиатор', generatorId: 'radiator.aluminium',
    params: { ...radiator(sections, 0.5), connection: 'bottom', bottomSide, bottomNominal: '1/2' } };
  const vented = bottomSide === 'right' ? 'top-right' : 'top-left';
  const closed: AssemblyPart[] = (['bottom-left', 'top-left', 'top-right', 'bottom-right'] as const).map((port) => ({
    name: port === vented ? 'воздухоотводчик' : `заглушка ${port}`, generatorId: 'radiator.port-fitting',
    params: { kind: port === vented ? 'vent' : 'plug', portNominal: '1' },
    attach: { connector: 'radiator', to: 'радиатор', toConnector: port },
  }));
  const definition = bottomHBlock('Алюминиевый', radiatorPart, bottomSide, 'none');
  return { ...definition, parts: [...definition.parts, ...closed] };
}

/**
 * Алюминиевый радиатор с нижним боковым подключением (позиция 125, исполнение 'side'): новых портов нет —
 * в нижние радиаторные отверстия разных торцов переходники 1 → 1/2, угловые термоклапан и настроечный
 * клапан под евроконус, к ним МП 16; сверху воздухоотводчик и заглушка.
 */
export function aluminiumBottomSide(sections = 6): AssemblyDefinition {
  const adapter = { kind: 'adapter', portNominal: '1', outletNominal: '1/2' } as const;
  return {
    label: `Алюминиевый радиатор ${sections} секций, нижнее боковое подключение: переходники, угловые клапаны, евроконус → МП`,
    parts: [
      { name: 'радиатор', generatorId: 'radiator.aluminium', params: radiator(sections, 0.5) },
      { name: 'воздухоотводчик', generatorId: 'radiator.port-fitting', params: { kind: 'vent', portNominal: '1' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'top-left' } },
      { name: 'заглушка', generatorId: 'radiator.port-fitting', params: { kind: 'plug', portNominal: '1' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'top-right' } },
      { name: 'переходник подачи', generatorId: 'radiator.port-fitting', params: adapter,
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'bottom-left' } },
      { name: 'термоклапан', generatorId: 'valve.thermostatic-angle', params: { nominal: '1/2', armLength: 0.04, head: 'none', pipeEnd: 'eurocone' },
        attach: { connector: 'radiator', to: 'переходник подачи', toConnector: 'outlet' } },
      { name: 'термоголовка', generatorId: 'valve.thermostatic-head', params: { setting: '3' },
        attach: { connector: 'valve', to: 'термоклапан', toConnector: 'head' } },
      ...euroconePipe('термоклапан', 0.15),
      { name: 'переходник обратки', generatorId: 'radiator.port-fitting', params: adapter,
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'bottom-right' } },
      { name: 'обратка', generatorId: 'valve.lockshield', params: { nominal: '1/2', armLength: 0.035, configuration: 'angle', pipeEnd: 'eurocone' },
        attach: { connector: 'radiator', to: 'переходник обратки', toConnector: 'outlet' } },
      ...euroconePipe('обратка', 0.15),
    ],
  };
}

/** Обвязка радиатора библиотеки (`radiatorPipework`) — по одному примеру на подключение. */
function pipeworkSamples(): AssemblyDefinition[] {
  const steel = { generatorId: 'radiator.steel', params: { dimensions: { x: 1, y: 0.5, z: 0.07 }, nominal: '1/2' } } as const;
  const aluminium = { generatorId: 'radiator.aluminium', params: { ...radiator(8, 0.5) } } as const;
  const mp16 = { system: 'mp', nominal: '16' } as const;
  const base = { side: 'left', valves: 'angle', supply: 'thermostatic', return: 'lockshield', pipe: mp16 } as const;
  return [
    radiatorPipework(steel, { ...base, connection: 'side' }),
    radiatorPipework(steel, { ...base, connection: 'diagonal', side: 'right', valves: 'straight', pipe: { system: 'pp', nominal: '20' } }),
    radiatorPipework(aluminium, { ...base, connection: 'side', supply: 'ball', return: 'ball' }),
    radiatorPipework(steel, { ...base, connection: 'bottom', side: 'right' }),
    radiatorPipework(aluminium, { ...base, connection: 'injector' }),
  ].map(({ definition }) => ({ ...definition, label: `Обвязка: ${definition.label}` }));
}

/**
 * Нижняя пара радиатора: детали и замыкание — из производственного рецепта узла радиатора
 * (`bottomHBlockParts` библиотеки), на стенде к адаптерам добавлены отрезки МП.
 */
function bottomHBlock(kind: string, radiatorPart: AssemblyPart, bottomSide: 'right' | 'left', shutoff: 'none' | 'ball'): AssemblyDefinition {
  const { parts, closures } = bottomHBlockParts(radiatorPart, bottomSide, shutoff);
  return {
    label: `${kind} радиатор снизу (${bottomSide === 'right' ? 'справа' : 'слева'}): ниппели, H-блок${shutoff === 'ball' ? ' с кранами VT.345K' : ''}, евроконус → МП`,
    parts: [
      ...parts,
      ...(['left', 'right'] as const).map((side): AssemblyPart => ({ name: `труба ${side}`, generatorId: 'mp.pipe', params: { nominal: '16', length: 0.15 },
        attach: { connector: 'start', to: `адаптер ${side}`, toConnector: 'pipe' } })),
    ],
    closures,
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
 * Обратный коллектор тёплого пола (68) под приводы — рецепт библиотеки (сервоприводы 69, концевой
 * узел 70, ниппель магистрали) — и первый контур на МП-трубе.
 */
export function manifoldReturnNode(outlets = 4): AssemblyDefinition {
  const node = recipe('assembly.manifold-return').build(String(outlets));
  return {
    label: `Коллектор обратный 1" × ${outlets}: приводы, концевой узел, контур МП 16`,
    parts: [...node.parts, ...manifoldContour('коллектор', 1, 0.15)],
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

/** Узел 72 отдельно — производственный рецепт библиотеки. */
export function mixingUnit(): AssemblyDefinition {
  return recipe('assembly.mixing-unit').build();
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
  returnElbow: 0, drainTee: 180, tankTee: 180, makeUpElbow: 0, separator: 0, strainer: 0,
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
      // Подпитка рядом с расширительной линией (паспорт VT.515): тройник, угол, клапан горизонтально
      // над грязеуловителем — пробка фильтра вниз, настроечный винт вверх, циферблат вперёд.
      { name: 'ниппель подпитки', generatorId: 'steel.nipple', params: nipple(0.1), attach: { connector: 'left', to: 'тройник бака', toConnector: 'right' } },
      { name: 'тройник подпитки', generatorId: 'steel.tee', params: tee('1/2'), attach: { connector: 'left', to: 'ниппель подпитки', toConnector: 'right' } },
      { name: 'ниппель отвода подпитки', generatorId: 'steel.nipple', params: nipple(0.06, '1/2'),
        attach: { connector: 'left', to: 'тройник подпитки', toConnector: 'top' } },
      { name: 'угол подпитки', generatorId: 'steel.elbow-90', params: { threadGender: 'internal', nominal: '1/2', armLength: 0.023 },
        attach: { connector: 'top', to: 'ниппель отвода подпитки', toConnector: 'right', angle: angles.makeUpElbow } },
      { name: 'ниппель клапана подпитки', generatorId: 'steel.nipple', params: nipple(0.03, '1/2'),
        attach: { connector: 'left', to: 'угол подпитки', toConnector: 'right' } },
      { name: 'клапан подпитки', generatorId: 'valve.make-up', params: { nominal: '1/2' },
        attach: { connector: 'outlet', to: 'ниппель клапана подпитки', toConnector: 'right', angle: 180 } },
      { name: 'ниппель грязеуловителя', generatorId: 'steel.nipple', params: nipple(0.2), attach: { connector: 'left', to: 'тройник подпитки', toConnector: 'right' } },
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

/** Копия описания сборки с префиксом в именах деталей и ссылках на них (attach, relativeTo, closures). */
function prefixed(definition: AssemblyDefinition, prefix: string): AssemblyDefinition {
  const name = (value: string) => `${prefix}${value}`;
  return {
    label: definition.label,
    parts: definition.parts.map((part) => ({
      ...part,
      name: name(part.name),
      ...(part.attach ? { attach: { ...part.attach, to: name(part.attach.to) } } : {}),
      ...(part.placement ? { placement: { ...part.placement, ...(part.placement.relativeTo ? { relativeTo: name(part.placement.relativeTo) } : {}) } } : {}),
    })),
    closures: definition.closures?.map((closure) => ({ ...closure, part: name(closure.part), to: name(closure.to) })),
  };
}

/** Положение узла тёплого пола (подающей гребёнки) в обвязке 124 со смесительным контуром, м. */
export const FLOOR_NODE_OFFSET = { x: 1.9, y: 0.25, z: 0 };

/** Переход «обжим МП 26 × наружная резьба 1"» VALTEC VTm.301 (A = 51 мм) — к крану 1" В. */
const MP26_ADAPTER = { threadGender: 'external', pipeNominal: '26', threadNominal: '1', length: 0.051 };

/**
 * Обвязка котельной 124 с подключением смесительного контура тёплого пола: обвязка boilerRoom и узел 123
 * (детали с префиксом «ТП: », подающая гребёнка — явным положением FLOOR_NODE_OFFSET). Подача: верхний кран
 * насосного модуля → переход VTm.301 → труба МП 26 по траектории → переход → кран подачи котла узла 72.
 * Обратка: кран обратки котла узла 72 → переход → труба → переход → кран обратки системы котельной.
 * Трубы стоят явным положением, каждый их конец — замыкание на переход.
 */
export function boilerRoomWithFloor(supplyPath: readonly Vector3Data[] = BOILER_FLOOR_SUPPLY, returnPath: readonly Vector3Data[] = BOILER_FLOOR_RETURN): AssemblyDefinition {
  const room = boilerRoom();
  const floor = prefixed(floorHeatingNode(), 'ТП: ');
  floor.parts[0] = { ...floor.parts[0], placement: { at: FLOOR_NODE_OFFSET } };
  const adapter = (name: string, to: string): AssemblyPart => ({ name, generatorId: 'mp.compression-thread-adapter', params: MP26_ADAPTER,
    attach: { connector: 'right', to, toConnector: 'left' } });
  const pipe = (name: string, path: readonly Vector3Data[]): AssemblyPart => ({ name, generatorId: 'mp.pipe-path',
    params: { nominal: '26', bendRadius: 0.13, path }, placement: { at: { x: 0, y: 0, z: 0 } } });
  return {
    label: 'Обвязка котельной 124 со смесительным контуром тёплого пола: котёл, модуль 105, узел 72, гребёнки, трубы МП 26',
    parts: [
      ...room.parts,
      ...floor.parts,
      { name: 'переход подачи котельной', generatorId: 'mp.compression-thread-adapter', params: MP26_ADAPTER,
        attach: { connector: 'right', to: 'кран верхний', toConnector: 'right' } },
      adapter('переход подачи ТП', 'ТП: кран подачи котла'),
      adapter('переход обратки ТП', 'ТП: кран обратки котла'),
      adapter('переход обратки котельной', 'кран обратки системы'),
      pipe('труба подачи ТП', supplyPath),
      pipe('труба обратки ТП', returnPath),
    ],
    closures: [
      ...(floor.closures ?? []),
      { part: 'труба подачи ТП', connector: 'start', to: 'переход подачи котельной', toConnector: 'left' },
      { part: 'труба подачи ТП', connector: 'end', to: 'переход подачи ТП', toConnector: 'left' },
      { part: 'труба обратки ТП', connector: 'start', to: 'переход обратки ТП', toConnector: 'left' },
      { part: 'труба обратки ТП', connector: 'end', to: 'переход обратки котельной', toConnector: 'left' },
    ],
  };
}

/**
 * Трубы МП 26 обвязки со смесительным контуром, м, в координатах котла. Концы — места посадки в
 * переходах VTm.301 (ввод 19,2 мм). Подача: от насосного модуля вверх до 0,55 м, вправо, вниз со сдвигом
 * к оси узла 72, вправо в переход. Обратка: от узла 72 влево, вниз под обвязку до −0,85 м с уходом к стене
 * (под горизонталью подачи оси расходятся на 58 мм при сумме радиусов 26 мм), вперёд
 * (z 0,35 — перед котельной), влево, наискось к оси крана обратки, вправо в переход.
 */
const BOILER_FLOOR_SUPPLY: readonly Vector3Data[] = [
  { x: 0.64216, y: 0.09787, z: -0.09 }, { x: 0.64216, y: 0.55, z: -0.09 }, { x: 1.0, y: 0.55, z: -0.09 },
  { x: 1.0, y: 0.25, z: 0 }, { x: 1.32936, y: 0.25, z: 0 },
];
const BOILER_FLOOR_RETURN: readonly Vector3Data[] = [
  { x: 1.33736, y: 0.45002, z: -0.03198 }, { x: 1.15, y: 0.45002, z: -0.03198 }, { x: 1.15, y: -0.85, z: -0.2 },
  { x: 1.15, y: -0.85, z: 0.35 }, { x: -1.35, y: -0.85, z: 0.35 }, { x: -1.35, y: -0.62208, z: -0.09 }, { x: -1.11645, y: -0.62208, z: -0.09 },
];

/** Насосный модуль 105 — производственный рецепт библиотеки (ASSEMBLY_RECIPES). */
export function pumpModule(): AssemblyDefinition {
  return PUMP_MODULE.build();
}

/** Насосный модуль со смесительным клапаном 106 — производственный рецепт библиотеки. */
export function pumpMixingModule(): AssemblyDefinition {
  return recipe('assembly.pump-mixing-module').build();
}

/** Вход холодной воды в бойлер (позиции 111, 112) — производственный рецепт библиотеки. */
export function boilerColdInlet(): AssemblyDefinition {
  return recipe('assembly.boiler-cold-inlet').build();
}

/** Детали модуля 105 из рецепта; start — как ставится нижний кран вместо положения из рецепта. */
export function pumpModuleParts(start: Pick<AssemblyPart, 'attach' | 'placement'>): AssemblyPart[] {
  const [first, ...rest] = PUMP_MODULE.build().parts;
  return [{ name: first.name, generatorId: first.generatorId, params: first.params, ...start }, ...rest];
}

/**
 * Сборки для проверки стыковки. Сначала совместимые стыки, потом заведомо
 * несовместимые (название начинается с «Ошибка») — стенд должен показать причину.
 */
/** Стальной радиатор 600 × 500 с нижней резьбой 1/2 справа — основа сборок радиаторной арматуры (часть 24). */
const RADIATOR_PART: AssemblyPart = { name: 'радиатор', generatorId: 'radiator.steel', params: { dimensions: { x: 0.6, y: 0.5, z: 0.07 }, nominal: '1/2' } };

/** Адаптер евроконуса и отрезок МП 16 на входе клапана — звено части 22 (позиция 131). */
function euroconePipe(valve: string, pipeLength: number): AssemblyPart[] {
  return [
    { name: `адаптер ${valve}`, generatorId: 'mp.eurocone-adapter', params: { pipeNominal: '16', euroconeNominal: '3/4', length: 0.026 },
      attach: { connector: 'eurocone', to: valve, toConnector: 'inlet' } },
    { name: `труба ${valve}`, generatorId: 'mp.pipe', params: { nominal: '16', length: pipeLength },
      attach: { connector: 'start', to: `адаптер ${valve}`, toConnector: 'pipe' } },
  ];
}

/**
 * Прямой термоклапан VT.032.NER с термоголовкой VT.5000 сверху и прямой настроечный VT.020.NER снизу (позиции 45, 97, 131):
 * оба клапана подключены к МП 16 через адаптеры евроконуса.
 */
export function radiatorStraightValves(): AssemblyDefinition {
  return {
    label: 'Радиатор: прямой термоклапан 1/2 × 3/4 ЕК, термоголовка, обратка 3/4 ЕК, МП 16',
    parts: [
      RADIATOR_PART,
      { name: 'термоклапан', generatorId: 'valve.thermostatic-straight',
        params: { nominal: '1/2', inletLength: 0.027, radiatorLength: 0.055, head: 'none', pipeEnd: 'eurocone' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'top-right' } },
      { name: 'термоголовка', generatorId: 'valve.thermostatic-head', params: { setting: '3' },
        attach: { connector: 'valve', to: 'термоклапан', toConnector: 'head' } },
      ...euroconePipe('термоклапан', 0.15),
      { name: 'обратка', generatorId: 'valve.lockshield', params: { nominal: '1/2', armLength: 0.035, configuration: 'straight', pipeEnd: 'eurocone' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'bottom-right' } },
      ...euroconePipe('обратка', 0.15),
    ],
  };
}

/** Осевой термоклапан VT.179 с сервоприводом VT.TE 3040 и угловая обратка (позиции 98, 69): трубы подходят снизу. */
export function radiatorAxialValve(): AssemblyDefinition {
  return {
    label: 'Радиатор: осевой термоклапан 1/2 с сервоприводом, угловая обратка',
    parts: [
      RADIATOR_PART,
      { name: 'термоклапан', generatorId: 'valve.thermostatic-axial', params: { nominal: '1/2', inletLength: 0.026, radiatorLength: 0.0535, head: 'none' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'top-right' } },
      { name: 'сервопривод', generatorId: 'valve.thermoelectric-actuator', params: { state: 'closed' },
        attach: { connector: 'valve', to: 'термоклапан', toConnector: 'head' } },
      { name: 'обратка', generatorId: 'valve.lockshield', params: { nominal: '1/2', armLength: 0.035, configuration: 'angle' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'bottom-right' } },
    ],
  };
}

/**
 * Однотрубный узел с байпасом (позиция 66) на инжекторном клапане VT.022 (позиция 101): алюминиевый радиатор,
 * одноточечное подключение снизу справа через футорку 1 × 1/2, зонд уходит в нижний коллектор. Подача и
 * обратка стояка — МП 16 через адаптеры евроконуса; остальные порты закрыты воздухоотводчиком и заглушками.
 */
export function radiatorOnePipeInjector(handle: 'top' | 'axial' = 'top'): AssemblyDefinition {
  const sections = 8;
  return {
    label: `Однотрубный узел: радиатор ${sections} секций, инжекторный клапан ${handle === 'top' ? 'VT.022' : 'VT.025'}, МП 16`,
    parts: [
      { name: 'радиатор', generatorId: 'radiator.aluminium', params: radiator(sections, 0.5) },
      { name: 'воздухоотводчик', generatorId: 'radiator.port-fitting', params: { kind: 'vent', portNominal: '1' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'top-left' } },
      ...(['top-right', 'bottom-left'] as const).map((port) => ({
        name: `заглушка ${port}`, generatorId: 'radiator.port-fitting' as const, params: { kind: 'plug' as const, portNominal: '1' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: port },
      })),
      { name: 'футорка', generatorId: 'radiator.port-fitting', params: { kind: 'adapter', portNominal: '1', outletNominal: '1/2' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'bottom-right' } },
      // Зонд короче радиатора на две секции: доходит до дальней части нижнего коллектора.
      { name: 'инжектор', generatorId: 'valve.injector', params: { handle, probeLength: (sections - 2) * 0.08 },
        attach: { connector: 'radiator', to: 'футорка', toConnector: 'outlet' } },
      ...(['supply', 'return'] as const).flatMap((port) => [
        { name: `адаптер ${port}`, generatorId: 'mp.eurocone-adapter' as const, params: { pipeNominal: '16', euroconeNominal: '3/4', length: 0.026 },
          attach: { connector: 'eurocone', to: 'инжектор', toConnector: port } },
        { name: `труба ${port}`, generatorId: 'mp.pipe' as const, params: { nominal: '16', length: 0.15 },
          attach: { connector: 'start', to: `адаптер ${port}`, toConnector: 'pipe' } },
      ]),
    ],
  };
}

/** Кран двойной регулировки VT.004 (позиция 99) на подаче через ниппель 1/2, угловая обратка. */
export function radiatorDoubleRegulation(): AssemblyDefinition {
  return {
    label: 'Радиатор: кран двойной регулировки VT.004 на ниппеле, угловая обратка',
    parts: [
      RADIATOR_PART,
      { name: 'ниппель', generatorId: 'steel.nipple', params: { nominalLeft: '1/2', nominalRight: '1/2', length: 0.022 },
        attach: { connector: 'left', to: 'радиатор', toConnector: 'top-right' } },
      { name: 'КРДП', generatorId: 'valve.double-regulation', params: { nominal: '1/2', length: 0.052, height: 0.082 },
        attach: { connector: 'left', to: 'ниппель', toConnector: 'right' } },
      { name: 'обратка', generatorId: 'valve.lockshield', params: { nominal: '1/2', armLength: 0.035, configuration: 'angle' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'bottom-right' } },
    ],
  };
}

/**
 * Резьбовые детали части 04a на одной линии 1/2: сгон VTr.653 с контргайкой VTr.656 у начала длинной резьбы
 * и муфтой на конце, эксцентрик VTr.670 из муфты; с другой стороны — американки В–В (VTr.340) и Н–Н (VTr.728)
 * и удлинитель VTr.197.
 */
export function threadedLine(): AssemblyDefinition {
  return {
    label: 'Резьба 1/2: сгон с контргайкой и муфтой, эксцентрик, американки В–В и Н–Н, удлинитель',
    parts: [
      { name: 'сгон', generatorId: 'steel.running-nipple', params: { nominal: '1/2', length: 0.1, longThread: 0.04, shortThread: 0.01 } },
      { name: 'контргайка', generatorId: 'steel.locknut', params: { nominal: '1/2' },
        attach: { connector: 'thread', to: 'сгон', toConnector: 'locknut' } },
      { name: 'муфта', generatorId: 'steel.coupling', params: { nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 },
        attach: { connector: 'left', to: 'сгон', toConnector: 'right' } },
      { name: 'эксцентрик', generatorId: 'steel.eccentric', params: { nominalLeft: '1/2', nominalRight: '3/4', offset: 0.009, length: 0.043, cup: 'none' },
        attach: { connector: 'left', to: 'муфта', toConnector: 'right' } },
      { name: 'американка В–В', generatorId: 'steel.union', params: { nominal: '1/2', armLength: 0.017, configuration: 'straight', ends: 'internal' },
        attach: { connector: 'outlet', to: 'сгон', toConnector: 'left' } },
      { name: 'американка Н–Н', generatorId: 'steel.union', params: { nominal: '1/2', armLength: 0.024, configuration: 'straight', ends: 'external' },
        attach: { connector: 'outlet', to: 'американка В–В', toConnector: 'inlet' } },
      { name: 'удлинитель', generatorId: 'steel.extension', params: { nominal: '1/2', length: 0.03 },
        attach: { connector: 'left', to: 'американка Н–Н', toConnector: 'inlet' } },
    ],
  };
}

/**
 * Латунная резьба (часть 23a): на магистраль коллектора 1" — сдвоенный ниппель VT.0606 (88) и угловой кран
 * с полусгоном VT.228 (95), за ним муфта и кран VT.226 наружной резьбой (133); на выход 1 — угольник
 * под евроконус VTr.092.NE (87), адаптер и МП 16.
 */
export function brassThreadNode(): AssemblyDefinition {
  return {
    label: 'Коллектор 1": сдвоенный ниппель, угловой кран VT.228, угольник под евроконус, кран VT.226',
    parts: [
      { name: 'коллектор', generatorId: 'manifold.brass',
        params: { nominal: '1', outlets: 3, outletEnd: 'eurocone', outletNominal: '1/2', mainEnd: 'internal', endPorts: 'none', inserts: 'none' } },
      { name: 'сдвоенный ниппель', generatorId: 'steel.nipple', params: { nominalLeft: '1', nominalRight: '1', length: 0.036, kind: 'double' },
        attach: { connector: 'right', to: 'коллектор', toConnector: 'main' } },
      { name: 'кран угловой', generatorId: 'valve.ball-union',
        params: { nominal: '1', unionNominal: '1 1/4', length: 0.0892, unionLength: 0.037, handleLength: 0.06, configuration: 'angle', inletLength: 0.042 },
        attach: { connector: 'left', to: 'сдвоенный ниппель', toConnector: 'left' } },
      { name: 'муфта', generatorId: 'steel.coupling', params: { nominalLeft: '1', nominalRight: '1', length: 0.04 },
        attach: { connector: 'left', to: 'кран угловой', toConnector: 'right' } },
      { name: 'кран VT.226', generatorId: 'valve.ball-union',
        params: { nominal: '1', unionNominal: '1 1/4', length: 0.075, unionLength: 0.037, handleLength: 0.06, valveEnd: 'external' },
        attach: { connector: 'left', to: 'муфта', toConnector: 'right' } },
      { name: 'угольник', generatorId: 'steel.eurocone-elbow', params: { nominal: '3/4', armLength: 0.028 },
        attach: { connector: 'inlet', to: 'коллектор', toConnector: 'out-1', angle: 90 } },
      { name: 'адаптер', generatorId: 'mp.eurocone-adapter', params: { pipeNominal: '16', euroconeNominal: '3/4', length: 0.026 },
        attach: { connector: 'eurocone', to: 'угольник', toConnector: 'outlet' } },
      { name: 'труба', generatorId: 'mp.pipe', params: { nominal: '16', length: 0.15 },
        attach: { connector: 'start', to: 'адаптер', toConnector: 'pipe' } },
    ],
  };
}

/**
 * КИП на линии 1/2 (часть 23b): в тройнике — демпферная трубка OR.1809 (92), кран VT.806 (91) и манометр;
 * дальше по ниппелям — косой тройник VTr.136 (89) с гильзой OR.551 (90), кран VT.808 с термометром в ручке (93)
 * и кран VT.247 с гнездом датчика (94).
 */
export function instrumentLine(): AssemblyDefinition {
  const nipple = { nominalLeft: '1/2', nominalRight: '1/2', length: 0.022 };
  return {
    label: 'КИП 1/2: демпферная трубка, кран VT.806 с манометром, косой тройник с гильзой, краны VT.808 и VT.247',
    parts: [
      { name: 'тройник', generatorId: 'steel.tee',
        params: { threadGender: 'internal', nominalLeft: '1/2', nominalRight: '1/2', nominalBranch: '1/2', length: 0.046, branchLength: 0.023 } },
      { name: 'трубка', generatorId: 'equipment.siphon-tube', params: { nominal: '1/2', length: 0.167, loopDiameter: 0.062 },
        attach: { connector: 'process', to: 'тройник', toConnector: 'top' } },
      { name: 'кран VT.806', generatorId: 'valve.gauge-tap', params: { inlet: 'external', gaugeNominal: '1/4', length: 0.073, handleLength: 0.036 },
        attach: { connector: 'inlet', to: 'трубка', toConnector: 'gauge' } },
      { name: 'манометр', generatorId: 'equipment.gauge', params: { kind: 'manometer', diameter: 63, connection: 'bottom', nominal: '1/4', probe: 0.05 },
        attach: { connector: 'connection', to: 'кран VT.806', toConnector: 'gauge' } },
      { name: 'ниппель 1', generatorId: 'steel.nipple', params: nipple, attach: { connector: 'left', to: 'тройник', toConnector: 'right' } },
      { name: 'косой тройник', generatorId: 'steel.y-tee', params: { nominal: '1/2', branchNominal: '1/2', length: 0.06, branchLength: 0.045 },
        // Отвод с гильзой — вбок, в сторону от демпферной трубки и ручки VT.808.
        attach: { connector: 'left', to: 'ниппель 1', toConnector: 'right', angle: 90 } },
      { name: 'гильза', generatorId: 'equipment.thermowell', params: { nominal: '1/2', length: 0.06, socket: 10.5 },
        attach: { connector: 'process', to: 'косой тройник', toConnector: 'branch' } },
      // Ниппель 2 возвращает краны в вертикаль после поворота косого тройника.
      { name: 'ниппель 2', generatorId: 'steel.nipple', params: nipple, attach: { connector: 'left', to: 'косой тройник', toConnector: 'right', angle: -90 } },
      // Ручка VT.808 развёрнута назад, над косым тройником; рычаг VT.247 — к свободному концу линии.
      { name: 'кран VT.808', generatorId: 'valve.ball', params: { ends: 'internal', nominal: '1/2', length: 0.0475, handleLength: 0.045, handle: 'thermometer' },
        attach: { connector: 'right', to: 'ниппель 2', toConnector: 'right' } },
      { name: 'ниппель 3', generatorId: 'steel.nipple', params: nipple, attach: { connector: 'left', to: 'кран VT.808', toConnector: 'left' } },
      { name: 'кран VT.247', generatorId: 'valve.ball',
        params: { ends: 'internal', nominal: '1/2', length: 0.047, handleLength: 0.0905, handle: 'lever', sensorPort: 'M10x1' },
        attach: { connector: 'left', to: 'ниппель 3', toConnector: 'right' } },
    ],
  };
}

/** Манометр на футорке VTr.581 1/2 × 1/4 (позиция 16) в тройнике 1/2 и штуцер VTr.654 под шланг на ниппеле (позиция 17). */
export function gaugeAndHoseTee(): AssemblyDefinition {
  return {
    label: 'Тройник 1/2: манометр на футорке 1/2 × 1/4, штуцер под шланг 14',
    parts: [
      { name: 'тройник', generatorId: 'steel.tee',
        params: { threadGender: 'internal', nominalLeft: '1/2', nominalRight: '1/2', nominalBranch: '1/2', length: 0.046, branchLength: 0.023 } },
      { name: 'футорка', generatorId: 'steel.bushing', params: { outerNominal: '1/2', innerNominal: '1/4', length: 0.014 },
        attach: { connector: 'left', to: 'тройник', toConnector: 'top' } },
      { name: 'манометр', generatorId: 'equipment.gauge', params: { kind: 'manometer', diameter: 63, connection: 'bottom', nominal: '1/4', probe: 0.05 },
        attach: { connector: 'connection', to: 'футорка', toConnector: 'right' } },
      { name: 'ниппель', generatorId: 'steel.nipple', params: { nominalLeft: '1/2', nominalRight: '1/2', length: 0.022 },
        attach: { connector: 'left', to: 'тройник', toConnector: 'right' } },
      { name: 'штуцер', generatorId: 'steel.hose-adapter', params: { nominal: '1/2', hoseNominal: '14', length: 0.044 },
        attach: { connector: 'thread', to: 'ниппель', toConnector: 'right' } },
    ],
  };
}

/**
 * ПП-линия 20 мм (часть 05a): заглушка VTp.790 на конце трубы, кран VTp.743, муфта разъёмная VTp.763,
 * угольник с накидной гайкой VTp.758 к ниппелю 1/2.
 */
export function ppLine(): AssemblyDefinition {
  const pipe = (length: number) => ({ nominal: '20', length });
  return {
    label: 'ПП 20: заглушка, кран, муфта разъёмная, угольник с гайкой',
    parts: [
      { name: 'труба A', generatorId: 'pp.pipe', params: pipe(0.1) },
      { name: 'заглушка', generatorId: 'pp.cap', params: { nominal: '20', length: 0.0215 },
        attach: { connector: 'socket', to: 'труба A', toConnector: 'start' } },
      { name: 'кран ПП', generatorId: 'pp.ball-valve',
        params: { pipeNominal: '20', ends: 'socket', threadNominal: '1/2', length: 0.07, height: 0.034, handleLength: 0.056 },
        attach: { connector: 'left', to: 'труба A', toConnector: 'end' } },
      { name: 'труба B', generatorId: 'pp.pipe', params: pipe(0.08), attach: { connector: 'start', to: 'кран ПП', toConnector: 'right' } },
      { name: 'муфта разъёмная', generatorId: 'pp.union', params: { pipeNominal: '20', end: 'socket', threadNominal: '1/2', length: 0.042 },
        attach: { connector: 'left', to: 'труба B', toConnector: 'end' } },
      { name: 'труба C', generatorId: 'pp.pipe', params: pipe(0.08), attach: { connector: 'start', to: 'муфта разъёмная', toConnector: 'right' } },
      { name: 'угольник', generatorId: 'pp.nut-elbow', params: { pipeNominal: '20', threadNominal: '1/2', socketArm: 0.0265, nutArm: 0.048 },
        attach: { connector: 'socket', to: 'труба C', toConnector: 'end' } },
      { name: 'ниппель', generatorId: 'steel.nipple', params: { nominalLeft: '1/2', nominalRight: '1/2', length: 0.022 },
        attach: { connector: 'left', to: 'угольник', toConnector: 'nut' } },
    ],
  };
}

/** Латунные краны для ПП (позиция 32) на трубе 20: VTp.745 и VTp.742; за VTp.742 — ниппель 1/2 и соединитель VTp.762 обратно на ПП. */
export function ppBrassValves(): AssemblyDefinition {
  return {
    label: 'ПП 20: латунные краны с американками VTp.745 и VTp.742, ниппель 1/2',
    parts: [
      { name: 'труба', generatorId: 'pp.pipe', params: { nominal: '20', length: 0.1 } },
      { name: 'кран VTp.745', generatorId: 'pp.ball-valve',
        params: { pipeNominal: '20', ends: 'union', threadNominal: '1/2', length: 0.065, height: 0.036, handleLength: 0.091 },
        attach: { connector: 'left', to: 'труба', toConnector: 'end' } },
      { name: 'кран VTp.742', generatorId: 'pp.ball-valve',
        params: { pipeNominal: '20', ends: 'union-internal', threadNominal: '1/2', length: 0.065, height: 0.036, handleLength: 0.091 },
        attach: { connector: 'left', to: 'труба', toConnector: 'start' } },
      { name: 'ниппель', generatorId: 'steel.nipple', params: { nominalLeft: '1/2', nominalRight: '1/2', length: 0.022 },
        attach: { connector: 'left', to: 'кран VTp.742', toConnector: 'right' } },
      { name: 'соединитель', generatorId: 'pp.union', params: { pipeNominal: '20', end: 'internal', threadNominal: '1/2', length: 0.035 },
        attach: { connector: 'right', to: 'ниппель', toConnector: 'right' } },
    ],
  };
}

/**
 * Двойная водорозетка на планке (позиция 36) по VALTEC VTm.224: пластина 117 и две пресс-водорозетки 35 (16 × 1/2)
 * на межцентровом расстоянии; ушки водорозеток лежат на лицевой стороне пластины. К каждой — труба МП 16 снизу.
 * У VTm.224 своя форма угольников с болтом M8 — здесь водорозетки VTm.254, условно.
 */
export function doubleWallOutlet(spacing: '75' | '112.5' | '150' = '150'): AssemblyDefinition {
  const outlet = { pipeNominal: '16', pipeEnd: 'press', threadNominal: '1/2', threadGender: 'internal', pipeArm: 0.047, height: 0.04 } as const;
  // Плоскость ушек водорозетки 16 × 1/2(в) — y = −base: тело / 2 + 2 мм, тело — 1,2 наружного диаметра резьбы 1/2 (в).
  // Совпадение с моделью проверяет tests/mpWallOutlet.test.ts.
  const base = 0.01478;
  return {
    label: `Двойная водорозетка на планке VTm.224, ${spacing.replace('.', ',')} мм, МП 16`,
    parts: [
      { name: 'пластина', generatorId: 'mp.outlet-plate', params: { spacing } },
      // Центры водорозеток — симметрично середине пластины, как отверстия mp.outlet-plate.
      ...[-1, 1].map((side) => side * Number(spacing) / 2000).flatMap((x, i) => [
        // Резьба выхода — от стены (+Y), трубный конец — вниз (−Z пластины): поворот −90° вокруг Y.
        { name: `водорозетка ${i + 1}`, generatorId: 'mp.wall-outlet' as const, params: outlet,
          placement: { relativeTo: 'пластина', at: { x, y: base, z: 0 }, rotation: { x: 0, y: 90, z: 0 } } },
        { name: `труба ${i + 1}`, generatorId: 'mp.pipe' as const, params: { nominal: '16', length: 0.15 },
          attach: { connector: 'start', to: `водорозетка ${i + 1}`, toConnector: 'pipe' } },
      ]),
    ],
  };
}

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
  pumpMixingModule(),
  boilerColdInlet(),
  mixingUnit(),
  floorHeatingNode(),
  boilerRoom(),
  boilerRoomWithFloor(),
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
  radiatorStraightValves(),
  radiatorAxialValve(),
  radiatorDoubleRegulation(),
  radiatorOnePipeInjector(),
  threadedLine(),
  gaugeAndHoseTee(),
  brassThreadNode(),
  instrumentLine(),
  ppLine(),
  ppBrassValves(),
  doubleWallOutlet(),
  steelBottomHBlock('right'),
  steelBottomHBlock('right', 'ball'),
  aluminiumBottomHBlock('right'),
  aluminiumBottomSide(),
  ...pipeworkSamples(),
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
