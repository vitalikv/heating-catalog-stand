import { RUNNING_NIPPLES_3_4 } from '../../catalog/extensions';
import { threadedSize } from '../../generators/ThreadedParts';
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

/**
 * Переходник потребителя с резьбы выноса на его трубу (МП, ПП): деталь и её разъёмы — на
 * внутреннюю резьбу 3/4 отвода тройника и угольника (`thread`, наружная 3/4) и под трубу (`pipe`).
 */
export interface BoilerPipeworkAdapter {
  generatorId: string;
  params: unknown;
  thread: string;
  pipe: string;
}

export interface BoilerPipeworkOptions {
  builtIn: BoilerPipeworkBuiltIn;
  /** Объём расширительного бака, л, если его нет в котле: позиции каталога 6–24. По умолчанию 8. */
  tankVolume?: number;
  /**
   * Чем выносы к группе безопасности и к баку набирают длину. Без него — одним сгоном 3/4 каталога:
   * узел — одна связанная группа. С ним — отрезком трубы потребителя: на концах выноса — переходники
   * `adapter`, деталь за выносом стоит напротив (без стыка), а пары разъёмов под трубу — в `runs`.
   */
  run?: { adapter: BoilerPipeworkAdapter };
}

/** Разъём детали узла: имя детали в описании и ID разъёма её модели. */
export interface BoilerPipeworkPort {
  part: string;
  connector: string;
}

/**
 * Вынос под отрезок трубы: разъём под трубу со стороны котла (`from`) и напротив него (`to`) —
 * оба смотрят друг на друга по одной оси. Трубу между ними прокладывает потребитель.
 */
export interface BoilerPipeworkRun {
  /** К чему вынос: «группа безопасности», «бак». */
  role: string;
  from: BoilerPipeworkPort;
  to: BoilerPipeworkPort;
}

export interface BoilerPipework {
  /** Узел: первая деталь — котёл («котёл»), к его патрубкам по стыкам — обвязка. */
  definition: AssemblyDefinition;
  /** Свободные концы подачи и обратки — наружная резьба 3/4, как у патрубков котла: к ним идёт магистраль. */
  supply: BoilerPipeworkPort;
  return: BoilerPipeworkPort;
  /** Выносы под трубу потребителя (опция `run`); без неё — пусто: выносы набраны сгонами. */
  runs: BoilerPipeworkRun[];
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

/** Деталь в разрез линии: генератор, параметры, вход (к концу линии), выход (новый конец; null — концевая). */
interface Piece {
  name: string;
  generatorId: string;
  params: unknown;
  input: Port;
  output: Port | null;
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
const ELBOW = { threadGender: 'internal', nominal: NOMINAL, armLength: 0.029 };
const STRAINER = { nominal: NOMINAL, length: 0.065 };
const DRAIN = { nominal: '1/2', hoseNominal: '16', length: 0.06 };
const SAFETY_GROUP = { dimensions: { x: 0.18, y: 0.05, z: 0.05 }, nominal: '1' };
const SAFETY_NIPPLE = { nominalLeft: '1', nominalRight: NOMINAL, length: 0.034 };
const PUMP = { nominal: '1 1/2', installLength: 0.18, housing: 'vrs', motor: 'small', terminalBox: 'top' };
const PUMP_NUT = { pumpNominal: '1 1/2', pipeNominal: '1' };
const PUMP_NIPPLE = { nominalLeft: '1', nominalRight: NOMINAL, length: 0.034 };
/** Сгон 3/4 каталога длиной `length`, м. */
const runningNipple = (length: number) => ({ nominal: NOMINAL, length, longThread: 0.045, shortThread: 0.012 });
/** Посадка сгона в резьбу тройника и угольника, м: глубина наружной резьбы 3/4 — у них внутренняя глубже. */
const RUNNING_SEAT = threadedSize(NOMINAL, 'external').depth;

/**
 * Вынос к группе безопасности — между торцами отвода тройника и входа угольника, м, у котла
 * шириной `width`. Группа стоит сбоку от котла, слева от подачи, и не задевает его: от отвода
 * тройника до бока котла — 0,3 ширины (патрубок — на 0,2 ширины от середины) без отвода (27 мм);
 * дальше — половина группы (90 мм) и зазор 1 см, а плечо угольника (31 мм) — уже за выносом.
 */
const safetyGap = (width: number): number => 0.3 * width - 0.027 + 0.09 + 0.01 - 0.031;

/**
 * Вынос к баку — между торцами отвода тройника и входа угольника, м: бак висит перед линией
 * обратки на угольнике (его плечо — 31 мм за выносом). Задний край бака — на 15 мм перед ручками
 * кранов подачи и обратки (они — в 17 мм от торца отвода, в 44 мм от оси линии), а у выноса
 * трубой (`piped`) — ещё и на 5 мм перед переходником на отводе (до 41 мм от торца): верх бака —
 * на высоте этого переходника.
 */
const tankGap = (diameter: number, piped: boolean): number => diameter / 2 - 0.031 + (piped ? 0.046 : 0.032);

/**
 * Довороты деталей вокруг оси стыка, градусы, у котла с патрубками снизу: отвод к группе
 * безопасности — наружу от котла, она стоит сбоку от котла; отвод к баку — вперёд (в помещение),
 * бак висит под ним; слив и отстойник фильтра — наружу от котла, мотор насоса и ручки кранов —
 * вперёд. Исходный поворот детали зависит от того, что стоит перед ней, поэтому у деталей после
 * необязательных частей угол — по предшественнику: `union` (американка), `safety` (тройник группы
 * безопасности), `pump` (насос), `tank` (тройник бака); у деталей за выносом — по выносу:
 * `nipple` (сгон), `pipe` (напротив отвода, под трубу). Подобраны по сборке; тест стенда проверяет
 * направления у всех сочетаний.
 */
export const BOILER_PIPEWORK_TURNS: Record<string, number | Record<string, number>> = {
  'тройник группы безопасности': 0,
  'угольник группы безопасности': { nipple: 180, pipe: 180 },
  'группа безопасности': 180,
  'кран подачи': { union: 270, safety: 270 },
  'насос': 0,
  'тройник бака': { union: 270, pump: 270 },
  'угольник бака': { nipple: 0, pipe: 0 },
  'фильтр': { union: 180, pump: 180, tank: 270 },
  'тройник слива': 0,
  'кран обратки': 90,
};

/**
 * Обвязка котла (автоотопление редактора, docs/heating/boiler-pipework-plan.md в skeleton-wf):
 * то, что ставят между патрубками настенного котла и магистралью.
 *
 * - Подача: американка, [тройник с выносом к группе безопасности — если её нет в котле], кран.
 * - Обратка: американка, [насос — если его нет в котле], [тройник с выносом к расширительному
 *   баку — если его нет в котле], косой фильтр, тройник с краном заполнения и слива, кран.
 *
 * Группа безопасности и бак стоят между котлом и краном: краном их от котла не отсечь.
 * Бак — на всасывании насоса. Концы узла — наружная резьба 3/4 кранов, как у патрубков:
 * магистраль подключается к ним тем же переходником. Котёл — только с патрубками снизу:
 * у остальных исполнений обвязка ушла бы в стену или корпус — ошибка с причиной.
 *
 * Детали соединяются напрямую или через один фитинг, цепочек удлинителей нет: где нужна длина
 * (выносы к группе безопасности и к баку) — одна деталь, сгон 3/4, или отрезок трубы потребителя
 * (`options.run`).
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
  const width = Number((boiler.params.dimensions as { x?: unknown } | undefined)?.x ?? 0.4);
  const { builtIn, run } = options;

  const parts: AssemblyPart[] = [{ name: BOILER, generatorId: 'equipment.boiler', params: boiler.params }];
  const runs: BoilerPipeworkRun[] = [];

  // Подача — левый патрубок, если смотреть на котёл спереди.
  const supply = new Line(parts, 'подачи', { part: BOILER, connector: 'bottom-left', gender: 'external' });
  supply.push('американка подачи', 'steel.union', UNION, { connector: 'inlet', gender: 'internal' }, { connector: 'outlet', gender: 'internal' });
  if (!builtIn.safetyGroup) {
    supply.push('тройник группы безопасности', 'steel.tee', TEE, { connector: 'left', gender: 'internal' }, { connector: 'right', gender: 'internal' }, turn('тройник группы безопасности', supply.after));
    supply.after = 'safety';
    const branch = new Line(parts, 'группы безопасности', { part: 'тройник группы безопасности', connector: 'top', gender: 'internal' });
    runs.push(...branch.reach('группа безопасности', safetyGap(width), run, {
      name: 'угольник группы безопасности', generatorId: 'steel.elbow-90', params: ELBOW,
      input: { connector: 'right', gender: 'internal' }, output: { connector: 'top', gender: 'internal' },
    }));
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
    runs.push(...branch.reach('бак', tankGap(tank.diameter, run !== undefined), run, {
      name: 'угольник бака', generatorId: 'steel.elbow-90', params: ELBOW,
      input: { connector: 'right', gender: 'internal' }, output: { connector: 'top', gender: 'internal' },
    }));
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
    runs,
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

  /**
   * Вынос к `target` (группе безопасности, баку): деталь `next` встаёт входом на `gap` от конца
   * линии (между торцами резьб) по его оси — конец линии и вход `next` — внутренняя резьба 3/4.
   * Без `run` длину набирает один сгон 3/4 — самый короткий из каталога, что не короче выноса
   * (не короче, — значит, деталь за ним встаёт чуть дальше); с `run` — отрезок трубы потребителя:
   * переходники на конец линии и на вход `next`, а `next` стоит напротив, без стыка. Отдаёт пару
   * разъёмов под трубу (без `run` — ничего).
   */
  reach(target: string, gap: number, run: BoilerPipeworkOptions['run'], next: Piece): BoilerPipeworkRun[] {
    if (!run) {
      const lengths = RUNNING_NIPPLES_3_4.map((mm) => mm / 1000);
      const length = lengths.find((item) => item - 2 * RUNNING_SEAT >= gap - 1e-9) ?? lengths[lengths.length - 1];
      this.push(`сгон ${this.role}`, 'steel.running-nipple', runningNipple(length), { connector: 'left', gender: 'external' }, { connector: 'right', gender: 'external' });
      this.push(next.name, next.generatorId, next.params, next.input, next.output, turn(next.name, 'nipple'));
      return [];
    }
    const { adapter } = run;
    const near = `переходник ${this.role} у тройника`;
    const far = `переходник ${this.role} у угольника`;
    const from = this.end;
    this.parts.push({ name: near, generatorId: adapter.generatorId, params: adapter.params, attach: { connector: adapter.thread, to: from.part, toConnector: from.connector } });
    const angle = turn(next.name, 'pipe');
    this.parts.push({
      name: next.name, generatorId: next.generatorId, params: next.params,
      across: { connector: next.input.connector, to: from.part, toConnector: from.connector, gap, ...(angle ? { angle } : {}) },
    });
    this.parts.push({ name: far, generatorId: adapter.generatorId, params: adapter.params, attach: { connector: adapter.thread, to: next.name, toConnector: next.input.connector } });
    if (next.output) this.end = { part: next.name, connector: next.output.connector, gender: next.output.gender };
    return [{ role: target, from: { part: near, connector: adapter.pipe }, to: { part: far, connector: adapter.pipe } }];
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
 * насос. Выносы к группе безопасности и к баку — сгонами 3/4: типа труб узел не знает.
 * Свободны концы кранов — к ним прокладывают магистраль. Версия 2 (0.8.0): выносы — сгоном,
 * а не цепочкой удлинителей, группа безопасности — сбоку от котла.
 */
export const BOILER_UNIT: AssemblyRecipe = {
  id: 'assembly.boiler-unit',
  version: 2,
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
