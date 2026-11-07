import { RUNNING_NIPPLE_1_THREADS } from '../../catalog/extensions';
import type { AssemblyClosureDefinition, AssemblyDefinition, AssemblyPart } from '../Assembly';
import type { AssemblyRecipe } from './AssemblyRecipe';

/** Контур котельной: прямой (насос без смешения) или смесительный (трёхходовой клапан, тёплый пол). */
export type HydraulicContour = 'direct' | 'mixing';

export interface HydraulicModuleOptions {
  /** Контуры слева направо: 2–4. */
  contours: readonly HydraulicContour[];
  /** Резьба патрубков гидрострелки к котлу (внутренняя): '1' (по умолчанию) или '1 1/4'. */
  nominal?: '1' | '1 1/4';
  /** Гидрострелка справа (по умолчанию: узел — слева от котла) или слева (узел — справа от котла). */
  side?: 'right' | 'left';
}

/** Разъём детали узла: имя детали в описании и ID разъёма её модели. */
export interface HydraulicModulePort {
  part: string;
  connector: string;
}

export interface HydraulicModule {
  /** Узел: первая деталь — гидрострелка с коллектором («гидрострелка»), на её выходах — насосные группы. */
  definition: AssemblyDefinition;
  /** Свободные патрубки гидрострелки к котлу (внутренняя резьба): к ним идут трубы от обвязки котла. */
  boiler: { supply: HydraulicModulePort; return: HydraulicModulePort };
  /** Контуры слева направо: свободные верхние краны групп (внутренняя резьба 1") — к ним идут трубы контура. */
  contours: { kind: HydraulicContour; supply: HydraulicModulePort; return: HydraulicModulePort }[];
}

const SEPARATOR = 'гидрострелка';
// Детали групп — позиции каталога 1", как у насосных модулей 105 и 106.
const BALL = { ends: 'internal', nominal: '1', length: 0.0625, handleLength: 0.06 };
const nipple = (length: number) => ({ nominalLeft: '1', nominalRight: '1', length });
const SHORT = 0.044;
const TEE = { threadGender: 'internal', nominalLeft: '1', nominalBranch: '1/2', nominalRight: '1', length: 0.06, branchLength: 0.03 };
const BYPASS_TEE = { ...TEE, nominalBranch: '1' };
const THERMOMETER = { kind: 'thermometer', diameter: 63, connection: 'back', nominal: '1/2', probe: 0.05 };
const PUMP = { nominal: '1 1/2', installLength: 0.18, housing: 'vrs', motor: 'small', terminalBox: 'top' };
const PUMP_NUT = { pumpNominal: '1 1/2', pipeNominal: '1' };
const CHECK = { nominal: '1', length: 0.058 };
const DRAIN = { nominal: '1/2', hoseNominal: '16', length: 0.06 };
/** Обратка прямой группы на высоту насоса — сгон 1" × 200 (позиция каталога), а не цепочка ниппелей. */
const RETURN_PIPE = { nominal: '1', length: 0.2, ...RUNNING_NIPPLE_1_THREADS };

/**
 * Подгонка, м. directReturn — ниппель под обратным клапаном прямой группы: со сгоном 200 мм верхние
 * краны подачи и обратки на одной высоте. Смесительная — как модуль 106: supplyDown — ниппель под клапаном, bypass — ниппель байпаса,
 * returnUp — ниппель обратки над муфтой; её нижний кран обратки садится на выход коллектора замыканием.
 */
export const HYDRAULIC_FIT = { directReturn: 0.0401, supplyDown: 0.1198, bypass: 0.0502, returnUp: 0.0552 };

/**
 * Котельная: гидрострелка с коллектором на 2–4 контура (`equipment.hydraulic-manifold`), воздухоотводчик
 * сверху и кран слива снизу, на выходах коллектора — насосные группы 1", две вертикальные линии через
 * 100 мм (подача слева, обратка справа):
 *
 * - прямая: подача снизу вверх — кран, ниппель, насос VRS на гайках, ниппель, тройник с термометром,
 *   ниппель, кран; обратка — кран, ниппель, обратный клапан (поток вниз), ниппель на высоту насоса,
 *   тройник с термометром, ниппель, кран. Линии ничем не связаны, кроме коллектора;
 * - смесительная — как модуль 106 (VT.VAR 20): трёхходовой клапан на подаче, байпас из обратки.
 *
 * Нижние краны повёрнуты на 180° от совпадения up с выходом: как кран 13 модуля 106 — мотор насоса и
 * термометры вперёд, от стены. Свободны патрубки гидрострелки к котлу и верхние краны групп; к ним
 * трубы прокладывает потребитель.
 */
export function hydraulicModule(options: HydraulicModuleOptions): HydraulicModule {
  const { contours } = options;
  if (contours.length < 2 || contours.length > 4) {
    throw new Error(`Гидрострелка с коллектором: контуров 2–4, а задано ${contours.length}`);
  }
  const parts: AssemblyPart[] = [
    { name: SEPARATOR, generatorId: 'equipment.hydraulic-manifold', params: { contours: contours.length, nominal: options.nominal ?? '1', side: options.side ?? 'right' } },
    { name: 'воздухоотводчик', generatorId: 'equipment.air-vent', params: { execution: 'NV' }, attach: { connector: 'inlet', to: SEPARATOR, toConnector: 'vent' } },
    { name: 'кран слива', generatorId: 'valve.drain', params: DRAIN, attach: { connector: 'inlet', to: SEPARATOR, toConnector: 'drain' } },
  ];
  const closures: AssemblyClosureDefinition[] = [];
  const ends: HydraulicModule['contours'] = [];
  contours.forEach((kind, index) => {
    const n = index + 1;
    const group = kind === 'direct' ? directGroup(n) : mixingGroup(n);
    parts.push(...group.parts);
    closures.push(...group.closures);
    ends.push({ kind, supply: group.supply, return: group.return });
  });
  return {
    definition: { label: label(contours), parts, ...(closures.length > 0 ? { closures } : {}) },
    boiler: { supply: { part: SEPARATOR, connector: 'boiler-supply' }, return: { part: SEPARATOR, connector: 'boiler-return' } },
    contours: ends,
  };
}

/** Детали группы контура `n`, её замыкания и свободные концы верхних кранов. */
interface Group {
  parts: AssemblyPart[];
  closures: AssemblyClosureDefinition[];
  supply: HydraulicModulePort;
  return: HydraulicModulePort;
}

/** Ставит деталь к правому разъёму предыдущей детали линии: `parts` — цепочка снизу вверх. */
function line(parts: { name: string; generatorId: string; params: unknown; connector?: string; toConnector?: string; angle?: number; to?: string }[]): AssemblyPart[] {
  return parts.map((part, index) => {
    const previous = parts[index - 1];
    const to = part.to ?? previous?.name;
    if (!to) throw new Error(`Линия группы: у ${part.name} нет предыдущей детали`);
    return {
      name: part.name, generatorId: part.generatorId, params: part.params,
      attach: { connector: part.connector ?? 'left', to, toConnector: part.toConnector ?? 'right', ...(part.angle === undefined ? {} : { angle: part.angle }) },
    };
  });
}

function directGroup(n: number): Group {
  const supply = line([
    { name: `кран подачи нижний ${n}`, generatorId: 'valve.ball', params: BALL, to: SEPARATOR, toConnector: `supply-${n}`, angle: 180 },
    { name: `ниппель насоса ${n}`, generatorId: 'steel.nipple', params: nipple(SHORT) },
    { name: `гайка насоса нижняя ${n}`, generatorId: 'equipment.pump-nut', params: PUMP_NUT, connector: 'pipe' },
    { name: `насос ${n}`, generatorId: 'equipment.pump', params: PUMP, toConnector: 'pump' },
    { name: `гайка насоса верхняя ${n}`, generatorId: 'equipment.pump-nut', params: PUMP_NUT, connector: 'pump' },
    { name: `ниппель подачи ${n}`, generatorId: 'steel.nipple', params: nipple(SHORT), toConnector: 'pipe' },
    { name: `тройник подачи ${n}`, generatorId: 'steel.tee', params: TEE, angle: 90 },
    { name: `ниппель крана подачи ${n}`, generatorId: 'steel.nipple', params: nipple(SHORT) },
    { name: `кран подачи ${n}`, generatorId: 'valve.ball', params: BALL },
  ]);
  const back = line([
    { name: `кран обратки нижний ${n}`, generatorId: 'valve.ball', params: BALL, to: SEPARATOR, toConnector: `return-${n}`, angle: 180 },
    { name: `ниппель клапана ${n}`, generatorId: 'steel.nipple', params: nipple(HYDRAULIC_FIT.directReturn) },
    // Поток в обратке — сверху вниз: от правого (верхнего) конца клапана к левому.
    { name: `обратный клапан ${n}`, generatorId: 'valve.check', params: { ...CHECK, flow: 'right-to-left' } },
    { name: `сгон обратки ${n}`, generatorId: 'steel.running-nipple', params: RETURN_PIPE },
    { name: `тройник обратки ${n}`, generatorId: 'steel.tee', params: TEE, angle: 90 },
    { name: `ниппель крана обратки ${n}`, generatorId: 'steel.nipple', params: nipple(SHORT) },
    { name: `кран обратки ${n}`, generatorId: 'valve.ball', params: BALL },
  ]);
  const gauges: AssemblyPart[] = (['подачи', 'обратки'] as const).map((role) => ({
    name: `термометр ${role} ${n}`, generatorId: 'equipment.gauge', params: THERMOMETER,
    attach: { connector: 'connection', to: `тройник ${role} ${n}`, toConnector: 'top' },
  }));
  return {
    parts: [...supply, ...back, ...gauges], closures: [],
    supply: { part: `кран подачи ${n}`, connector: 'right' }, return: { part: `кран обратки ${n}`, connector: 'right' },
  };
}

/**
 * Смесительная группа — детали и стыки модуля 106 (`pumpMixingModule`), нижний кран подачи — на выходе
 * коллектора; нижний кран обратки встаёт по стыкам группы и садится на выход замыканием.
 */
function mixingGroup(n: number): Group {
  const name = (base: string) => `${base} ${n}`;
  const attach = (connector: string, to: string, toConnector: string, angle?: number) =>
    ({ connector, to: name(to), toConnector, ...(angle === undefined ? {} : { angle }) });
  const parts: AssemblyPart[] = [
    { name: name('кран подачи нижний'), generatorId: 'valve.ball', params: BALL,
      attach: { connector: 'left', to: SEPARATOR, toConnector: `supply-${n}`, angle: 180 } },
    { name: name('ниппель клапана'), generatorId: 'steel.nipple', params: nipple(HYDRAULIC_FIT.supplyDown), attach: attach('left', 'кран подачи нижний', 'right') },
    { name: name('смесительный клапан'), generatorId: 'valve.mixing', params: { ways: 3, nominal: '1', control: 'handle' },
      attach: attach('right', 'ниппель клапана', 'right', 180) },
    { name: name('ниппель насоса'), generatorId: 'steel.nipple', params: nipple(SHORT), attach: attach('left', 'смесительный клапан', 'left', 180) },
    { name: name('гайка насоса нижняя'), generatorId: 'equipment.pump-nut', params: PUMP_NUT, attach: attach('pipe', 'ниппель насоса', 'right') },
    { name: name('насос'), generatorId: 'equipment.pump', params: PUMP, attach: attach('left', 'гайка насоса нижняя', 'pump') },
    { name: name('гайка насоса верхняя'), generatorId: 'equipment.pump-nut', params: PUMP_NUT, attach: attach('pump', 'насос', 'right') },
    { name: name('ниппель подачи'), generatorId: 'steel.nipple', params: nipple(SHORT), attach: attach('left', 'гайка насоса верхняя', 'pipe') },
    { name: name('тройник подачи'), generatorId: 'steel.tee', params: TEE, attach: attach('left', 'ниппель подачи', 'right', 90) },
    { name: name('термометр подачи'), generatorId: 'equipment.gauge', params: THERMOMETER, attach: attach('connection', 'тройник подачи', 'top') },
    { name: name('ниппель крана подачи'), generatorId: 'steel.nipple', params: nipple(SHORT), attach: attach('left', 'тройник подачи', 'right') },
    { name: name('кран подачи'), generatorId: 'valve.ball', params: BALL, attach: attach('left', 'ниппель крана подачи', 'right') },
    // Байпас: боковой ход клапана → ниппель → отвод тройника обратки.
    { name: name('ниппель байпаса'), generatorId: 'steel.nipple', params: nipple(HYDRAULIC_FIT.bypass), attach: attach('left', 'смесительный клапан', 'top') },
    { name: name('тройник байпаса'), generatorId: 'steel.tee', params: BYPASS_TEE, attach: attach('top', 'ниппель байпаса', 'right') },
    // Обратка вверх от байпаса: ниппель 200 мм, муфта, подгоночный ниппель, тройник с термометром, кран.
    { name: name('ниппель обратки'), generatorId: 'steel.nipple', params: nipple(0.2), attach: attach('left', 'тройник байпаса', 'left') },
    { name: name('муфта обратки'), generatorId: 'steel.coupling', params: { nominalLeft: '1', nominalRight: '1', length: 0.04 },
      attach: attach('left', 'ниппель обратки', 'right') },
    { name: name('ниппель обратки верхний'), generatorId: 'steel.nipple', params: nipple(HYDRAULIC_FIT.returnUp), attach: attach('left', 'муфта обратки', 'right') },
    { name: name('тройник обратки'), generatorId: 'steel.tee', params: TEE, attach: attach('right', 'ниппель обратки верхний', 'right', 90) },
    { name: name('термометр обратки'), generatorId: 'equipment.gauge', params: THERMOMETER, attach: attach('connection', 'тройник обратки', 'top') },
    { name: name('ниппель крана обратки'), generatorId: 'steel.nipple', params: nipple(SHORT), attach: attach('right', 'тройник обратки', 'left') },
    { name: name('кран обратки'), generatorId: 'valve.ball', params: BALL, attach: attach('right', 'ниппель крана обратки', 'left') },
    // Обратка вниз от байпаса: обратный клапан (поток вниз) и нижний кран — на выход коллектора.
    { name: name('ниппель клапана обратки'), generatorId: 'steel.nipple', params: nipple(SHORT), attach: attach('left', 'тройник байпаса', 'right') },
    { name: name('обратный клапан'), generatorId: 'valve.check', params: { ...CHECK, flow: 'left-to-right' }, attach: attach('left', 'ниппель клапана обратки', 'right') },
    { name: name('ниппель крана обратки нижнего'), generatorId: 'steel.nipple', params: nipple(SHORT), attach: attach('left', 'обратный клапан', 'right') },
    { name: name('кран обратки нижний'), generatorId: 'valve.ball', params: BALL, attach: attach('left', 'ниппель крана обратки нижнего', 'right') },
  ];
  return {
    parts,
    closures: [{ part: name('кран обратки нижний'), connector: 'right', to: SEPARATOR, toConnector: `return-${n}` }],
    // Верхний кран обратки стоит к ниппелю правым концом — свободен левый, как у крана 9 модуля 106.
    supply: { part: name('кран подачи'), connector: 'right' },
    return: { part: name('кран обратки'), connector: 'left' },
  };
}

/** «Гидрострелка с коллектором на 3 контура: 2 прямых и смесительный, насосы VRS». */
function label(contours: readonly HydraulicContour[]): string {
  const direct = contours.filter((kind) => kind === 'direct').length;
  const mixing = contours.length - direct;
  const parts = [
    ...(direct > 0 ? [`${direct} ${direct === 1 ? 'прямой' : 'прямых'}`] : []),
    ...(mixing > 0 ? [`${mixing === 1 ? 'смесительный' : `${mixing} смесительных`}`] : []),
  ];
  return `Гидрострелка с коллектором на ${contours.length} контура: ${parts.join(' и ')}, насосы VRS, термометры`;
}

/** Исполнения узла каталога: прямые контуры и, по желанию, один смесительный справа. */
const MODULE_VARIANTS: readonly { key: string; label: string; contours: HydraulicContour[] }[] = [
  { key: 'direct-2', label: '2 прямых контура', contours: ['direct', 'direct'] },
  { key: 'direct-3', label: '3 прямых контура', contours: ['direct', 'direct', 'direct'] },
  { key: 'direct-4', label: '4 прямых контура', contours: ['direct', 'direct', 'direct', 'direct'] },
  { key: 'direct-1-mixing', label: 'прямой и смесительный', contours: ['direct', 'mixing'] },
  { key: 'direct-2-mixing', label: '2 прямых и смесительный', contours: ['direct', 'direct', 'mixing'] },
  { key: 'direct-3-mixing', label: '3 прямых и смесительный', contours: ['direct', 'direct', 'direct', 'mixing'] },
];

/**
 * Гидрострелка с коллектором и насосными группами (позиция 107): узел каталога по
 * `hydraulicModule`, патрубки к котлу 1". Свободны патрубки к котлу и верхние краны групп.
 */
export const HYDRAULIC_MODULE: AssemblyRecipe = {
  id: 'assembly.hydraulic-module',
  version: 1,
  title: 'Гидрострелка с коллектором и насосными группами',
  variants: MODULE_VARIANTS.map(({ key, label: text }) => ({ key, label: text })),
  build(variant?: string): AssemblyDefinition {
    const found = variant === undefined ? MODULE_VARIANTS[0] : MODULE_VARIANTS.find((item) => item.key === variant);
    if (!found) throw new Error(`Нет исполнения гидрострелки с коллектором: ${variant}`);
    return hydraulicModule({ contours: found.contours }).definition;
  },
};
