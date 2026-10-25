import type { AssemblyDefinition, AssemblyPart } from '../Assembly';
import type { AssemblyRecipe, AssemblyRecipeVariant } from './AssemblyRecipe';
import { bottomHBlockParts } from './radiatorHBlock';

/** Радиатор, к которому собирается обвязка: генератор и его параметры (размер, секции, номинал). */
export interface RadiatorPipeworkRadiator {
  generatorId: 'radiator.steel' | 'radiator.aluminium';
  params: Record<string, unknown>;
}

/**
 * Как подключён радиатор: боковое (подача сверху, обратка снизу у одного торца), диагональное
 * (подача сверху у одного торца, обратка снизу у другого), нижнее (H-блок под радиатором),
 * инжекторное (однотрубная схема: инжекторный клапан в нижнее отверстие одного торца).
 */
export type RadiatorPipeworkConnection = 'side' | 'diagonal' | 'bottom' | 'injector';

export interface RadiatorPipeworkOptions {
  connection: RadiatorPipeworkConnection;
  /** Торец подачи; у нижнего подключения — сторона нижней пары, у инжекторного — торец клапана. */
  side: 'left' | 'right';
  /** Клапаны бокового и диагонального подключения: угловые — трубы снизу, прямые — сбоку. */
  valves: 'angle' | 'straight';
  supply: 'thermostatic' | 'ball' | 'none';
  return: 'lockshield' | 'ball' | 'none';
  /** Труба к узлу: МП 16 или 20, ПП 20 или 25. Нижнее и инжекторное — только МП (евроконус). */
  pipe: { system: 'mp' | 'pp'; nominal: string };
}

/** Разъём детали узла: имя детали в описании и ID разъёма её модели. */
export interface RadiatorPipeworkPort {
  part: string;
  connector: string;
}

export interface RadiatorPipework {
  /** Узел: первая деталь — радиатор («радиатор»), к нему по стыкам — обвязка. */
  definition: AssemblyDefinition;
  /** Свободные разъёмы под трубу подачи и обратки: к ним прокладывают трубы. */
  supply: RadiatorPipeworkPort;
  return: RadiatorPipeworkPort;
}

type Corner = 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right';

const RADIATOR = 'радиатор';
const MP_NOMINALS = ['16', '20'];
const PP_NOMINALS = ['20', '25'];

/**
 * Обвязка любого радиатора каталога (шаг 2 автоотопления редактора,
 * docs/heating/radiator-pipework-plan.md в skeleton-wf). Состав — как у сборок gl2
 * (createObj/sborka/radiator): воздухоотводчик и заглушки в свободные отверстия, на подаче
 * термоклапан с головкой или кран, на обратке запорный клапан или кран, затем переход под
 * трубу МП или ПП. Тройников магистрали и байпаса в узле нет — это трассировка труб.
 *
 * Отверстия алюминиевого радиатора — радиаторная резьба 1": клапаны встают через
 * переходники 1 → 1/2, воздухоотводчик и заглушки — свои, радиаторные. Неподдерживаемое
 * сочетание (нижнее с ПП) — ошибка с причиной.
 */
export function radiatorPipework(radiator: RadiatorPipeworkRadiator, options: RadiatorPipeworkOptions): RadiatorPipework {
  const { system, nominal } = options.pipe;
  if (!(system === 'mp' ? MP_NOMINALS : PP_NOMINALS).includes(nominal)) {
    throw new Error(`Обвязка радиатора: нет трубы ${system === 'mp' ? 'МП' : 'ПП'} ${nominal} — есть ${(system === 'mp' ? MP_NOMINALS : PP_NOMINALS).join(', ')}`);
  }
  const aluminium = radiator.generatorId === 'radiator.aluminium';
  const bottom = options.connection === 'bottom';
  if ((bottom || options.connection === 'injector') && system !== 'mp') {
    throw new Error('Обвязка радиатора: нижнее и инжекторное подключение — только МП: у ПП нет перехода на евроконус');
  }
  const near = options.side;
  const far = near === 'left' ? 'right' : 'left';
  const radiatorPart: AssemblyPart = {
    name: RADIATOR,
    generatorId: radiator.generatorId,
    params: bottom
      ? { ...radiator.params, connection: 'bottom', bottomSide: near, ...(aluminium ? { bottomNominal: '1/2' } : {}) }
      : { ...radiator.params, connection: 'side' },
  };
  const parts: AssemblyPart[] = [radiatorPart];
  const build = new PartsBuilder(parts, aluminium);

  if (bottom) {
    const shutoff = options.supply === 'ball' || options.return === 'ball' ? 'ball' : 'none';
    const pair = bottomHBlockParts(radiatorPart, near, shutoff, nominal as '16' | '20');
    parts.push(...pair.parts.slice(1));
    build.closeCorners([`top-${far}`, `bottom-${far}`, `top-${near}`, `bottom-${near}`], `top-${far}`);
    // Адаптеры H-блока: подача — к торцу пары, обратка — второй.
    return {
      definition: { label: label(radiator, options), parts, closures: pair.closures },
      supply: { part: `адаптер ${near}`, connector: 'pipe' },
      return: { part: `адаптер ${far}`, connector: 'pipe' },
    };
  }

  if (options.connection === 'injector') {
    const seat = build.seat(`bottom-${near}`, 'инжектор');
    parts.push({
      name: 'инжекторный клапан', generatorId: 'valve.injector',
      params: { handle: 'top', probeLength: probeLength(radiator) },
      attach: { connector: 'radiator', ...seat },
    });
    for (const end of ['supply', 'return'] as const) {
      parts.push({
        name: end === 'supply' ? 'адаптер подачи' : 'адаптер обратки', generatorId: 'mp.eurocone-adapter',
        params: { pipeNominal: nominal, euroconeNominal: '3/4', length: 0.026 },
        attach: { connector: 'eurocone', to: 'инжекторный клапан', toConnector: end },
      });
    }
    build.closeCorners([`top-${far}`, `bottom-${far}`, `top-${near}`], `top-${far}`);
    return {
      definition: { label: label(radiator, options), parts },
      supply: { part: 'адаптер подачи', connector: 'pipe' },
      return: { part: 'адаптер обратки', connector: 'pipe' },
    };
  }

  const supplyCorner: Corner = `top-${near}`;
  const returnCorner: Corner = options.connection === 'diagonal' ? `bottom-${far}` : `bottom-${near}`;
  const supply = build.end('подача', supplyCorner, options.supply, options);
  const back = build.end('обратка', returnCorner, options.return, options);
  // Воздухоотводчик — верх торца без подачи, заглушка — оставшийся низ.
  const free = (['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const)
    .filter((corner) => corner !== supplyCorner && corner !== returnCorner);
  build.closeCorners(free, `top-${far}`);
  return { definition: { label: label(radiator, options), parts }, supply, return: back };
}

/** Детали обвязки по отверстиям радиатора: переходники алюминиевого, клапаны, заглушки. */
class PartsBuilder {
  constructor(private readonly parts: AssemblyPart[], private readonly aluminium: boolean) {}

  /**
   * Куда встаёт деталь с резьбой 1/2 нар. в отверстие corner: у стального — само отверстие,
   * у алюминиевого — выход переходника 1 → 1/2, который сначала ставится в отверстие.
   */
  seat(corner: Corner, role: string): { to: string; toConnector: string } {
    if (!this.aluminium) return { to: RADIATOR, toConnector: corner };
    const name = `переходник (${role})`;
    this.parts.push({
      name, generatorId: 'radiator.port-fitting', params: { kind: 'adapter', portNominal: '1', outletNominal: '1/2' },
      attach: { connector: 'radiator', to: RADIATOR, toConnector: corner },
    });
    return { to: name, toConnector: 'outlet' };
  }

  /** Подача или обратка у отверстия corner: клапан (или без него) и переход под трубу. */
  end(role: 'подача' | 'обратка', corner: Corner, valve: RadiatorPipeworkOptions['supply'] | RadiatorPipeworkOptions['return'], options: RadiatorPipeworkOptions): RadiatorPipeworkPort {
    let seat = this.seat(corner, role);
    const angle = options.valves === 'angle';
    const valveName = role === 'подача' ? 'клапан подачи' : 'клапан обратки';
    if (valve === 'thermostatic') {
      this.parts.push(angle
        ? { name: valveName, generatorId: 'valve.thermostatic-angle', params: { nominal: '1/2', armLength: 0.04, head: 'none', pipeEnd: 'internal' }, attach: { connector: 'radiator', ...seat } }
        : { name: valveName, generatorId: 'valve.thermostatic-straight', params: { nominal: '1/2', inletLength: 0.027, radiatorLength: 0.055, head: 'none', pipeEnd: 'internal' }, attach: { connector: 'radiator', ...seat } });
      this.parts.push({ name: 'термоголовка', generatorId: 'valve.thermostatic-head', params: { setting: '3' }, attach: { connector: 'valve', to: valveName, toConnector: 'head' } });
      seat = { to: valveName, toConnector: 'inlet' };
    } else if (valve === 'lockshield') {
      this.parts.push({ name: valveName, generatorId: 'valve.lockshield',
        params: { nominal: '1/2', armLength: 0.035, configuration: angle ? 'angle' : 'straight', pipeEnd: 'internal' }, attach: { connector: 'radiator', ...seat } });
      seat = { to: valveName, toConnector: 'inlet' };
    } else if (valve === 'ball') {
      this.parts.push({ name: valveName, generatorId: 'valve.ball-union',
        params: { nominal: '1/2', unionNominal: '3/4', length: 0.055, unionLength: 0.026, handleLength: 0.053, valveEnd: 'internal',
          configuration: angle ? 'angle' : 'straight', ...(angle ? { inletLength: 0.031 } : {}) },
        attach: { connector: 'right', ...seat } });
      seat = { to: valveName, toConnector: 'left' };
    }
    const name = role === 'подача' ? 'переход подачи' : 'переход обратки';
    const { system, nominal } = options.pipe;
    this.parts.push(system === 'mp'
      ? { name, generatorId: 'mp.thread-adapter', params: { threadGender: 'external', pipeNominal: nominal, threadNominal: '1/2', length: 0.048 }, attach: { connector: 'right', ...seat } }
      : { name, generatorId: 'pp.thread-adapter', params: { threadGender: 'external', pipeNominal: nominal, threadNominal: '1/2', length: 0.036 }, attach: { connector: 'right', ...seat } });
    return { part: name, connector: 'left' };
  }

  /** Отверстия без подачи и обратки: в vent — воздухоотводчик, в остальные — заглушки. */
  closeCorners(corners: readonly Corner[], vent: Corner): void {
    for (const corner of corners) {
      const kind = corner === vent ? 'vent' : 'plug';
      const name = kind === 'vent' ? 'воздухоотводчик' : `заглушка ${corner}`;
      this.parts.push(this.aluminium
        ? { name, generatorId: 'radiator.port-fitting', params: { kind, portNominal: '1' }, attach: { connector: 'radiator', to: RADIATOR, toConnector: corner } }
        : { name, generatorId: 'radiator.vent', params: { kind, nominal: '1/2' }, attach: { connector: 'left', to: RADIATOR, toConnector: corner } });
    }
  }
}

/** Щуп инжектора — до половины длины радиатора, в пределах генератора. */
function probeLength(radiator: RadiatorPipeworkRadiator): number {
  const dimensions = radiator.params.dimensions as { x?: number } | undefined;
  const width = dimensions?.x ?? 0.5;
  const length = radiator.generatorId === 'radiator.aluminium' ? width * Number(radiator.params.sections ?? 1) : width;
  return Math.min(1.5, Math.max(0.05, Math.round(length * 50) / 100));
}

const CONNECTION_LABELS: Record<RadiatorPipeworkConnection, string> = {
  side: 'боковое', diagonal: 'диагональное', bottom: 'нижнее', injector: 'инжекторное',
};

function label(radiator: RadiatorPipeworkRadiator, options: RadiatorPipeworkOptions): string {
  const kind = radiator.generatorId === 'radiator.aluminium' ? 'Алюминиевый' : 'Стальной';
  const pipe = `${options.pipe.system === 'mp' ? 'МП' : 'ПП'} ${options.pipe.nominal}`;
  return `${kind} радиатор, ${CONNECTION_LABELS[options.connection]} подключение ${options.side === 'left' ? 'слева' : 'справа'}: обвязка под ${pipe}`;
}

const SIDE_VARIANTS: readonly (AssemblyRecipeVariant & Pick<RadiatorPipeworkOptions, 'connection' | 'side'>)[] = [
  { key: 'left', label: 'слева', connection: 'side', side: 'left' },
  { key: 'right', label: 'справа', connection: 'side', side: 'right' },
  { key: 'diagonal-left', label: 'диагональ, подача слева', connection: 'diagonal', side: 'left' },
  { key: 'diagonal-right', label: 'диагональ, подача справа', connection: 'diagonal', side: 'right' },
];

/**
 * Стальной радиатор 1000 × 500 с боковой обвязкой: угловые термоклапан с головкой и запорный
 * клапан, переходы под МП 16; воздухоотводчик и заглушка. Свободны разъёмы под трубу.
 */
export const RADIATOR_SIDE: AssemblyRecipe = {
  id: 'assembly.radiator-side',
  version: 1,
  title: 'Радиатор стальной с боковой обвязкой',
  variants: SIDE_VARIANTS.map(({ key, label: text }) => ({ key, label: text })),
  build(variant?: string): AssemblyDefinition {
    const found = variant === undefined ? SIDE_VARIANTS[0] : SIDE_VARIANTS.find((item) => item.key === variant);
    if (!found) throw new Error(`Нет исполнения узла радиатора: ${variant}`);
    return radiatorPipework(
      { generatorId: 'radiator.steel', params: { dimensions: { x: 1, y: 0.5, z: 0.07 }, nominal: '1/2' } },
      { connection: found.connection, side: found.side, valves: 'angle', supply: 'thermostatic', return: 'lockshield', pipe: { system: 'mp', nominal: '16' } },
    ).definition;
  },
};
