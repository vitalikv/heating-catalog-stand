import type { AssemblyDefinition, AssemblyPart } from '../Assembly';
import type { AssemblyRecipe, AssemblyRecipeVariant } from './AssemblyRecipe';

/** Котёл, к которому собирается обвязка: генератор и его параметры (габарит, патрубки). */
export interface BoilerPipeworkBoiler {
  generatorId: 'equipment.boiler';
  params: Record<string, unknown>;
}

/**
 * Что уже есть в самом котле. Настенный газовый котёл обычно несёт насос, расширительный бак
 * и группу безопасности; у котла без них обвязка ставит недостающее сама.
 */
export interface BoilerPipeworkBuiltIn {
  pump: boolean;
  expansionTank: boolean;
  safetyGroup: boolean;
}

export interface BoilerPipeworkOptions {
  builtIn: BoilerPipeworkBuiltIn;
  /** Объём расширительного бака, л, если его нет в котле: позиции каталога 6–24. По умолчанию 8. */
  tankVolume?: number;
}

/** Разъём детали узла: имя детали в описании и ID разъёма её модели. */
export interface BoilerPipeworkPort {
  part: string;
  connector: string;
}

export interface BoilerPipework {
  /** Узел: первая деталь — котёл («котёл»), к его патрубкам по стыкам — обвязка. */
  definition: AssemblyDefinition;
  /** Свободные концы подачи и обратки — наружная резьба 3/4, как у патрубков котла: к ним идёт магистраль. */
  supply: BoilerPipeworkPort;
  return: BoilerPipeworkPort;
}

type Gender = 'internal' | 'external';

interface End {
  part: string;
  connector: string;
  gender: Gender;
}

interface Port {
  connector: string;
  gender: Gender;
}

const BOILER = 'котёл';
const NOMINAL = '3/4';
/** Баки каталога: объём, л → диаметр и высота, м. */
const TANKS: Readonly<Record<number, { diameter: number; height: number }>> = {
  6: { diameter: 0.245, height: 0.25 },
  8: { diameter: 0.245, height: 0.28 },
  10: { diameter: 0.245, height: 0.33 },
  12: { diameter: 0.285, height: 0.325 },
  18: { diameter: 0.285, height: 0.395 },
  24: { diameter: 0.325, height: 0.42 },
};
const DEFAULT_TANK = 8;

// Детали — позиции каталога (резьба 3/4, кроме слива и группы безопасности).
const UNION = { nominal: NOMINAL, armLength: 0.02, configuration: 'straight', ends: 'internal' };
const VALVE_EXTERNAL = { ends: 'external', nominal: NOMINAL, length: 0.07, handleLength: 0.053 };
const NIPPLE = { nominalLeft: NOMINAL, nominalRight: NOMINAL, length: 0.022 };
const COUPLING = { nominalLeft: NOMINAL, nominalRight: NOMINAL, length: 0.033 };
const TEE = { threadGender: 'internal', nominalLeft: NOMINAL, nominalBranch: NOMINAL, nominalRight: NOMINAL, length: 0.058, branchLength: 0.027 };
const DRAIN_TEE = { threadGender: 'internal', nominalLeft: NOMINAL, nominalBranch: '1/2', nominalRight: NOMINAL, length: 0.056, branchLength: 0.027 };
const EXTENSION = { nominal: NOMINAL, length: 0.051 };
const ELBOW = { threadGender: 'internal', nominal: NOMINAL, armLength: 0.029 };
const STRAINER = { nominal: NOMINAL, length: 0.065 };
const DRAIN = { nominal: '1/2', hoseNominal: '16', length: 0.06 };
const SAFETY_GROUP = { dimensions: { x: 0.18, y: 0.05, z: 0.05 }, nominal: '1' };
const SAFETY_NIPPLE = { nominalLeft: '1', nominalRight: NOMINAL, length: 0.034 };
const PUMP = { nominal: '1 1/2', installLength: 0.18, housing: 'vrs', motor: 'small', terminalBox: 'top' };
const PUMP_NUT = { pumpNominal: '1 1/2', pipeNominal: '1' };
const PUMP_NIPPLE = { nominalLeft: '1', nominalRight: NOMINAL, length: 0.034 };

/**
 * Довороты деталей вокруг оси стыка, градусы, у котла с патрубками снизу: отвод к группе
 * безопасности — наружу от котла, она стоит над ним под левым краем котла; отвод к баку —
 * вперёд (в помещение), бак висит под ним; слив и отстойник фильтра — наружу от котла,
 * мотор насоса и ручки кранов — вперёд. Исходный поворот детали зависит от того, что стоит перед ней, поэтому у деталей
 * после необязательных частей угол — по предшественнику: `union` (американка), `safety`
 * (тройник группы безопасности), `pump` (насос), `tank` (тройник бака). Подобраны по сборке;
 * тест стенда проверяет направления у всех сочетаний.
 */
export const BOILER_PIPEWORK_TURNS: Record<string, number | Record<string, number>> = {
  'тройник группы безопасности': 0,
  'угольник группы безопасности': 180,
  'группа безопасности': 180,
  'кран подачи': { union: 270, safety: 270 },
  'насос': 0,
  'тройник бака': { union: 270, pump: 270 },
  'угольник бака': 0,
  'фильтр': { union: 180, pump: 180, tank: 270 },
  'тройник слива': 0,
  'кран обратки': 90,
};

/** Удлинители 3/4 по линии подачи перед группой безопасности: она встаёт ниже котла. */
const SAFETY_DROP = 4;
/** Удлинители в отводе к группе безопасности: она стоит слева от линии подачи, не задевая её и бак. */
const SAFETY_REACH = 2;
/** Удлинители в отводе к баку: бак висит перед линией обратки, не задевая её. */
const TANK_REACH = 3;

/**
 * Обвязка котла (автоотопление редактора, docs/heating/boiler-pipework-plan.md в skeleton-wf):
 * то, что ставят между патрубками настенного котла и магистралью.
 *
 * - Подача: американка, [тройник с группой безопасности — если её нет в котле], кран.
 * - Обратка: американка, [насос — если его нет в котле], [тройник с расширительным баком —
 *   если его нет в котле], косой фильтр, тройник с краном заполнения и слива, кран.
 *
 * Группа безопасности и бак стоят между котлом и краном: краном их от котла не отсечь.
 * Бак — на всасывании насоса. Концы узла — наружная резьба 3/4 кранов, как у патрубков:
 * магистраль подключается к ним тем же переходником. Котёл — только с патрубками снизу:
 * у остальных исполнений обвязка ушла бы в стену или корпус — ошибка с причиной.
 */
export function boilerPipework(boiler: BoilerPipeworkBoiler, options: BoilerPipeworkOptions): BoilerPipework {
  const connection = boiler.params.connection ?? 'back';
  if (connection !== 'bottom') {
    throw new Error(`Обвязка котла: только у котла с патрубками снизу, у этого — ${CONNECTION_LABELS[String(connection)] ?? connection}`);
  }
  const nominal = boiler.params.nominal ?? NOMINAL;
  if (nominal !== NOMINAL) throw new Error(`Обвязка котла: только под патрубки ${NOMINAL}, у этого — ${nominal}`);
  const volume = options.tankVolume ?? DEFAULT_TANK;
  const tank = TANKS[volume];
  if (!tank) throw new Error(`Обвязка котла: нет бака на ${volume} л — есть ${Object.keys(TANKS).join(', ')}`);
  const { builtIn } = options;

  const parts: AssemblyPart[] = [{ name: BOILER, generatorId: 'equipment.boiler', params: boiler.params }];

  // Подача — левый патрубок, если смотреть на котёл спереди.
  const supply = new Line(parts, 'подачи', { part: BOILER, connector: 'bottom-left', gender: 'external' });
  supply.push('американка подачи', 'steel.union', UNION, { connector: 'inlet', gender: 'internal' }, { connector: 'outlet', gender: 'internal' });
  if (!builtIn.safetyGroup) {
    for (let index = 1; index <= SAFETY_DROP; index += 1) {
      supply.push(`удлинитель подачи ${index}`, 'steel.extension', EXTENSION, { connector: 'right', gender: 'external' }, { connector: 'left', gender: 'internal' });
    }
    supply.push('тройник группы безопасности', 'steel.tee', TEE, { connector: 'left', gender: 'internal' }, { connector: 'right', gender: 'internal' }, turn('тройник группы безопасности', supply.after));
    supply.after = 'safety';
    const branch = new Line(parts, 'группы безопасности', { part: 'тройник группы безопасности', connector: 'top', gender: 'internal' });
    for (let index = 1; index <= SAFETY_REACH; index += 1) {
      branch.push(`удлинитель группы безопасности ${index}`, 'steel.extension', EXTENSION, { connector: 'right', gender: 'external' }, { connector: 'left', gender: 'internal' });
    }
    branch.push('угольник группы безопасности', 'steel.elbow-90', ELBOW, { connector: 'right', gender: 'internal' }, { connector: 'top', gender: 'internal' }, turn('угольник группы безопасности'));
    branch.push('ниппель группы безопасности', 'steel.nipple', SAFETY_NIPPLE, { connector: 'right', gender: 'external' }, { connector: 'left', gender: 'external' });
    branch.push('группа безопасности', 'equipment.safety-group', SAFETY_GROUP, { connector: 'bottom', gender: 'internal' }, null, turn('группа безопасности'));
  }
  supply.push('кран подачи', 'valve.ball', VALVE_EXTERNAL, { connector: 'left', gender: 'external' }, { connector: 'right', gender: 'external' }, turn('кран подачи', supply.after));

  const back = new Line(parts, 'обратки', { part: BOILER, connector: 'bottom-right', gender: 'external' });
  back.push('американка обратки', 'steel.union', UNION, { connector: 'inlet', gender: 'internal' }, { connector: 'outlet', gender: 'internal' });
  if (!builtIn.pump) {
    // Вода идёт снизу вверх — к котлу: выход насоса (right) — к котлу.
    back.push('гайка насоса верхняя', 'equipment.pump-nut', PUMP_NUT, { connector: 'pipe', gender: 'internal' }, { connector: 'pump', gender: 'internal' }, 0, PUMP_NIPPLE);
    back.push('насос', 'equipment.pump', PUMP, { connector: 'right', gender: 'external' }, { connector: 'left', gender: 'external' }, turn('насос'));
    back.after = 'pump';
    back.push('гайка насоса нижняя', 'equipment.pump-nut', PUMP_NUT, { connector: 'pump', gender: 'internal' }, { connector: 'pipe', gender: 'internal' });
    back.push('ниппель насоса нижний', 'steel.nipple', PUMP_NIPPLE, { connector: 'left', gender: 'external' }, { connector: 'right', gender: 'external' });
  }
  if (!builtIn.expansionTank) {
    back.push('тройник бака', 'steel.tee', TEE, { connector: 'left', gender: 'internal' }, { connector: 'right', gender: 'internal' }, turn('тройник бака', back.after));
    back.after = 'tank';
    const branch = new Line(parts, 'бака', { part: 'тройник бака', connector: 'top', gender: 'internal' });
    for (let index = 1; index <= TANK_REACH; index += 1) {
      branch.push(`удлинитель бака ${index}`, 'steel.extension', EXTENSION, { connector: 'right', gender: 'external' }, { connector: 'left', gender: 'internal' });
    }
    branch.push('угольник бака', 'steel.elbow-90', ELBOW, { connector: 'right', gender: 'internal' }, { connector: 'top', gender: 'internal' }, turn('угольник бака'));
    branch.push('бак', 'equipment.expansion-tank', { ...tank, nominal: NOMINAL, volume }, { connector: 'bottom', gender: 'external' }, null);
  }
  back.push('фильтр', 'equipment.strainer', STRAINER, { connector: 'right', gender: 'internal' }, { connector: 'left', gender: 'internal' }, turn('фильтр', back.after));
  back.push('тройник слива', 'steel.tee', DRAIN_TEE, { connector: 'left', gender: 'internal' }, { connector: 'right', gender: 'internal' }, turn('тройник слива'));
  const drain = new Line(parts, 'слива', { part: 'тройник слива', connector: 'top', gender: 'internal' });
  drain.push('кран слива', 'valve.drain', DRAIN, { connector: 'inlet', gender: 'external' }, null);
  back.push('кран обратки', 'valve.ball', VALVE_EXTERNAL, { connector: 'left', gender: 'external' }, { connector: 'right', gender: 'external' }, turn('кран обратки'));

  return {
    definition: { label: label(builtIn, volume), parts },
    supply: { part: 'кран подачи', connector: 'right' },
    return: { part: 'кран обратки', connector: 'right' },
  };
}

/**
 * Линия деталей от разъёма: каждая следующая встаёт входом к концу линии. Резьба входа та же,
 * что у конца (две внутренние или две наружные), — между ними ниппель или муфта 3/4.
 */
class Line {
  /** Чей поворот задаёт исходный у следующих деталей: последняя необязательная часть линии. */
  after = 'union';
  private adapters = 0;

  constructor(private readonly parts: AssemblyPart[], private readonly role: string, private end: End) {}

  /**
   * Деталь в разрез линии: `input` — к концу, `output` — новый конец (null — деталь концевая).
   * `adapter` — свой переход между концом и деталью вместо ниппеля 3/4 (у гайки насоса — 1 × 3/4).
   */
  push(name: string, generatorId: string, params: unknown, input: Port, output: Port | null, angle?: number, adapter?: typeof NIPPLE): void {
    if (adapter) this.adapt('steel.nipple', adapter, 'external');
    else if (input.gender === this.end.gender) this.adapt(input.gender === 'internal' ? 'steel.nipple' : 'steel.coupling', input.gender === 'internal' ? NIPPLE : COUPLING, input.gender === 'internal' ? 'external' : 'internal');
    this.parts.push({
      name, generatorId, params,
      attach: { connector: input.connector, to: this.end.part, toConnector: this.end.connector, ...(angle ? { angle } : {}) },
    });
    if (output) this.end = { part: name, connector: output.connector, gender: output.gender };
  }

  private adapt(generatorId: 'steel.nipple' | 'steel.coupling', params: typeof NIPPLE, gender: Gender): void {
    this.adapters += 1;
    const name = `${generatorId === 'steel.nipple' ? 'ниппель' : 'муфта'} ${this.role} ${this.adapters}`;
    // Ниппель 1 × 3/4 у насоса: 3/4 — к линии (right), 1 — к гайке.
    const toLine = params.nominalLeft !== params.nominalRight ? 'right' : 'left';
    this.parts.push({ name, generatorId, params, attach: { connector: toLine, to: this.end.part, toConnector: this.end.connector } });
    this.end = { part: name, connector: toLine === 'left' ? 'right' : 'left', gender };
  }
}

/** Доворот детали `name` (по предшественнику `after`, если угол от него зависит). */
function turn(name: string, after = 'union'): number {
  const value = BOILER_PIPEWORK_TURNS[name];
  return typeof value === 'number' ? value : value?.[after] ?? 0;
}

const CONNECTION_LABELS: Readonly<Record<string, string>> = {
  back: 'сзади', bottom: 'снизу', 'top-bottom': 'снизу и сверху', 'left-right': 'слева и справа',
};

function label(builtIn: BoilerPipeworkBuiltIn, volume: number): string {
  const extra = [
    ...(builtIn.safetyGroup ? [] : ['группа безопасности']),
    ...(builtIn.pump ? [] : ['насос']),
    ...(builtIn.expansionTank ? [] : [`бак ${volume} л`]),
  ];
  return `Обвязка котла: американки, краны, фильтр, кран слива${extra.length > 0 ? `; ${extra.join(', ')}` : ''}`;
}

/** Исполнения узла каталога — по тому, что встроено в котёл. */
const UNIT_VARIANTS: readonly (AssemblyRecipeVariant & { builtIn: BoilerPipeworkBuiltIn })[] = [
  { key: 'built-in', label: 'насос, бак и группа безопасности в котле', builtIn: { pump: true, expansionTank: true, safetyGroup: true } },
  { key: 'pump', label: 'в котле только насос', builtIn: { pump: true, expansionTank: false, safetyGroup: false } },
  { key: 'none', label: 'без насоса, бака и группы безопасности', builtIn: { pump: false, expansionTank: false, safetyGroup: false } },
];

/**
 * Котёл настенный с патрубками снизу и обвязкой: американки и краны на подаче и обратке,
 * косой фильтр и кран слива на обратке; чего нет в котле — группа безопасности, бак 8 л,
 * насос. Свободны концы кранов — к ним прокладывают магистраль.
 */
export const BOILER_UNIT: AssemblyRecipe = {
  id: 'assembly.boiler-unit',
  version: 1,
  title: 'Котёл с обвязкой',
  variants: UNIT_VARIANTS.map(({ key, label: text }) => ({ key, label: text })),
  build(variant?: string): AssemblyDefinition {
    const found = variant === undefined ? UNIT_VARIANTS[0] : UNIT_VARIANTS.find((item) => item.key === variant);
    if (!found) throw new Error(`Нет исполнения котла с обвязкой: ${variant}`);
    return boilerPipework(
      { generatorId: 'equipment.boiler', params: { dimensions: { x: 0.4, y: 0.73, z: 0.3 }, nominal: NOMINAL, connection: 'bottom' } },
      { builtIn: found.builtIn },
    ).definition;
  },
};
