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
 * ID gl2 → ID библиотеки по таблице п. 3 плана. Вводится на шаге 4; до него fromGl2
 * оставляет ID gl2. createTubeWF_1 делится по cdm.type: в gl2 одна функция на обе трубы.
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

/** ID библиотеки, в который перейдёт деталь gl2 (шаг 4); бросает исключение для неизвестных. */
export function gl2TargetId(id: string, cdm: Gl2Params): string {
  const target = GL2_IDS[id];
  if (target === undefined) throw new Error(`Неизвестный ID gl2: ${id}`);
  if (typeof target === 'string') return target;
  const variant = target[String(cdm.type)];
  if (variant === undefined) throw new Error(`${id}: неизвестный type ${String(cdm.type)}`);
  return variant;
}

/**
 * Деталь gl2 → деталь библиотеки. Пока ID и параметры не переименованы (шаг 4),
 * возвращает их без изменений; проверка по таблице уже идёт, чтобы ошибки ловились сразу.
 */
export function fromGl2(id: string, cdm: Gl2Params): Gl2Converted {
  gl2TargetId(id, cdm);
  return { generatorId: id, params: cdm };
}
