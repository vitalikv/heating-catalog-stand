/**
 * Соответствие gl2: ID функций-генераторов и параметры cdm → ID и параметры библиотеки.
 * Нужно для сверки с gl2 (эталон, scripts/gl2-compare.mjs) и наборов start.js на стенде;
 * старые имена за пределами этого слоя не используются (docs/library-refactoring-plan.md).
 */

/** Параметры в формате gl2 (cdm) или библиотеки. */
export type Gl2Params = Record<string, unknown>;

/** Деталь в формате библиотеки: как она хранится в данных проекта. */
export interface Gl2Converted {
  generatorId: string;
  params: Gl2Params;
}

/**
 * ID gl2 → ID библиотеки по таблице п. 3 плана. createTubeWF_1 делится по cdm.type:
 * в gl2 одна функция на обе трубы.
 */
export const GL2_IDS: Readonly<Record<string, string | Readonly<Record<string, string>>>> = {
  st_mufta_1: 'steel.coupling',
  st_nippel_1: 'steel.nipple',
  st_zagl_nr: 'steel.plug',
  st_pol_sgon_1: 'steel.half-union',
  st_ugol_90_1: 'steel.elbow-90',
  st_ugol_45_1: 'steel.elbow-45',
  st_troinik_1: 'steel.tee',
  st_krestovina_1: 'steel.cross',
  st_collector_1: 'steel.manifold',
  st_collector_2: 'steel.manifold-valves',
  pl_ugol_90_1: 'pp.elbow-90',
  pl_ugol_45_1: 'pp.elbow-45',
  pl_ugol_90_rezba_1: 'pp.elbow-90-thread',
  pl_mufta_1: 'pp.coupling',
  pl_perehod_rezba_1: 'pp.thread-adapter',
  pl_troinik_1: 'pp.tee',
  pl_troinik_2: 'pp.tee-reducing',
  pl_troinik_rezba_1: 'pp.tee-thread',
  pl_krestovina_1: 'pp.cross',
  mpl_ugol_1: 'mp.elbow',
  mpl_ugol_rezba_1: 'mp.elbow-thread',
  mpl_perehod_1: 'mp.coupling',
  mpl_perehod_rezba_1: 'mp.thread-adapter',
  mpl_troinik_1: 'mp.tee',
  mpl_troinik_rezba_1: 'mp.tee-thread',
  createTubeWF_1: { pp: 'pp.pipe', mp: 'mp.pipe' },
  al_radiator_1: 'radiator.aluminium',
  st_radiator_1: 'radiator.steel',
  al_zagl_radiator_1: 'radiator.port-fitting',
  rad_vozduhotvod_1: 'radiator.vent',
  shar_kran_v_1: 'valve.ball',
  shar_kran_n_1: 'valve.ball',
  shar_kran_v_n_1: 'valve.ball',
  shar_kran_sgon_1: 'valve.ball-union',
  reg_kran_primoy_1: 'valve.regulating',
  cr_kotel_1: 'equipment.boiler',
  cr_zr_nasos_1: 'equipment.pump',
  cr_gaika_nasos_1: 'equipment.pump-nut',
  filtr_kosoy_1: 'equipment.strainer',
  cr_rash_bak_1: 'equipment.expansion-tank',
  gr_bez_1: 'equipment.safety-group',
};

/** Ключ cdm → ключ параметров библиотеки; null — ключ gl2, не влияющий на модель. */
type FieldMap = Readonly<Record<string, string | null>>;

const SIDE = { side: 'threadGender' } as const;
const RUN = { m1: 'length', m2: 'branchLength' } as const;

/** Перевод ключей по таблице п. 3 плана. */
const FIELDS: Readonly<Record<string, FieldMap>> = {
  st_mufta_1: { r1: 'nominalLeft', r2: 'nominalRight', m1: 'length' },
  st_nippel_1: { r1: 'nominalLeft', r2: 'nominalRight', m1: 'length' },
  st_zagl_nr: { r1: 'nominal', m1: 'length' },
  st_pol_sgon_1: { r1: 'nutNominal', r2: 'pipeNominal', m1: 'length' },
  st_ugol_90_1: { ...SIDE, r1: 'nominal', m1: 'armLength' },
  st_ugol_45_1: { r1: 'nominal', m1: 'armLength' },
  st_troinik_1: { ...SIDE, r1: 'nominalLeft', r2: 'nominalBranch', r3: 'nominalRight', ...RUN },
  st_krestovina_1: { r1: 'nominal', m1: 'size' },
  st_collector_1: { ...SIDE, r1: 'nominal', r2: 'outletNominal', count: 'outlets', ...RUN },
  st_collector_2: { r1: 'nominal', r2: 'outletNominal', count: 'outlets', ...RUN, color: 'handleColor' },
  pl_ugol_90_1: { r1: 'nominal', m1: 'armLength' },
  pl_ugol_45_1: { r1: 'nominal', m1: 'armLength' },
  pl_ugol_90_rezba_1: { ...SIDE, r1: 'pipeNominal', r2: 'threadNominal', m1: 'armLength' },
  pl_mufta_1: { r1: 'nominalLeft', r2: 'nominalRight', m1: 'length' },
  pl_perehod_rezba_1: { ...SIDE, r1: 'pipeNominal', r2: 'threadNominal', m1: 'length' },
  pl_troinik_1: { r1: 'nominal', m1: 'length' },
  pl_troinik_2: { r1: 'nominalLeft', r2: 'nominalBranch', r3: 'nominalRight', ...RUN },
  pl_troinik_rezba_1: { ...SIDE, r1: 'pipeNominal', r2: 'threadNominal', m1: 'length' },
  pl_krestovina_1: { r1: 'nominal', m1: 'size' },
  mpl_ugol_1: { r1: 'nominal', m1: 'armLength' },
  mpl_ugol_rezba_1: { ...SIDE, r1: 'pipeNominal', r2: 'threadNominal', m1: 'armLength', m2: 'threadArmLength' },
  mpl_perehod_1: { r1: 'nominalLeft', r3: 'nominalRight', m1: 'length' },
  mpl_perehod_rezba_1: { ...SIDE, r1: 'pipeNominal', r2: 'threadNominal', m1: 'length' },
  mpl_troinik_1: { r1: 'nominalLeft', r2: 'nominalBranch', r3: 'nominalRight', ...RUN },
  mpl_troinik_rezba_1: { ...SIDE, r1: 'nominalLeft', r2: 'threadNominal', r3: 'nominalRight', ...RUN },
  createTubeWF_1: { type: null, ppSize: 'nominal', mpSize: 'nominal', length: 'length' },
  al_radiator_1: { count: 'sections', size: 'dimensions', r1: 'nominal' },
  st_radiator_1: { size: 'dimensions', r1: 'nominal' },
  al_zagl_radiator_1: { type: 'kind', r1: 'portNominal', r2: 'outletNominal' },
  rad_vozduhotvod_1: { type: 'kind', r1: 'nominal', r2: null, m1: null },
  shar_kran_v_1: { r1: 'nominal', m1: 'length', t1: 'handleLength' },
  shar_kran_n_1: { r1: 'nominal', m1: 'length', t1: 'handleLength' },
  shar_kran_v_n_1: { r1: 'nominal', m1: 'length', t1: 'handleLength' },
  shar_kran_sgon_1: { r1: 'nominal', r2: 'unionNominal', m1: 'length', m2: 'unionLength', t1: 'handleLength' },
  reg_kran_primoy_1: { r1: 'nominal', r2: 'unionNominal', m1: 'length', m2: 'unionLength', head: 'head' },
  cr_kotel_1: { size: 'dimensions', r1: 'nominal', type: 'connection' },
  cr_zr_nasos_1: { r1: 'nominal' },
  cr_gaika_nasos_1: { r1: 'pumpNominal', r2: 'pipeNominal', m1: null },
  filtr_kosoy_1: { r1: 'nominal', m1: 'length' },
  cr_rash_bak_1: { d: 'diameter', h1: 'height', r1: 'nominal', name: 'volume' },
  gr_bez_1: { size: 'dimensions', r1: 'nominal' },
};

/** Значения-коды gl2 → значения библиотеки, по новому ключу. */
const VALUES: Readonly<Record<string, Readonly<Record<string, (value: unknown) => unknown>>>> = {
  '*': { threadGender: (side) => (side === 'v' ? 'internal' : 'external') },
  al_zagl_radiator_1: { kind: (type) => ({ prh: 'adapter', zgl: 'plug', vsd: 'vent' })[String(type)] ?? type },
  // В gl2 воздухоотводчик — только type 'vsd', любой другой — пробка.
  rad_vozduhotvod_1: { kind: (type) => (type === 'vsd' ? 'vent' : 'plug') },
  reg_kran_primoy_1: { head: (head) => (head === 'termo' ? 'thermostatic' : head) },
  // Объём в названии: '6л' → 6.
  cr_rash_bak_1: { volume: (name) => Number.parseFloat(String(name)) },
};

/** Концы шаровых кранов: в gl2 — три функции. */
const BALL_VALVE_ENDS: Readonly<Record<string, string>> = {
  shar_kran_v_1: 'internal',
  shar_kran_n_1: 'external',
  shar_kran_v_n_1: 'internal-external',
};

/** ID библиотеки для детали gl2; бросает исключение для неизвестных. */
export function gl2TargetId(id: string, cdm: Gl2Params): string {
  const target = GL2_IDS[id];
  if (target === undefined) throw new Error(`Неизвестный ID gl2: ${id}`);
  if (typeof target === 'string') return target;
  const variant = target[String(cdm.type)];
  if (variant === undefined) throw new Error(`${id}: неизвестный type ${String(cdm.type)}`);
  return variant;
}

/**
 * Деталь gl2 → деталь библиотеки: ID и параметры по таблице п. 3 плана.
 * Неизвестный ключ cdm — исключение, чтобы расхождение таблицы и наборов ловилось сразу.
 */
export function fromGl2(id: string, cdm: Gl2Params): Gl2Converted {
  const generatorId = gl2TargetId(id, cdm);
  const fields = FIELDS[id];
  const params: Gl2Params = id in BALL_VALVE_ENDS ? { ends: BALL_VALVE_ENDS[id] } : {};
  for (const [key, value] of Object.entries(cdm)) {
    if (!(key in fields)) throw new Error(`${id}: неизвестный параметр gl2 '${key}'`);
    const target = fields[key];
    if (target === null || value === undefined) continue;
    // У радиаторной заглушки и воздухоотводчика в gl2 r2: 0 — выхода нет.
    if (id === 'al_zagl_radiator_1' && key === 'r2' && value === 0) continue;
    const convert = VALUES[id]?.[target] ?? VALUES['*'][target];
    params[target] = convert ? convert(value) : value;
  }
  return { generatorId, params };
}
