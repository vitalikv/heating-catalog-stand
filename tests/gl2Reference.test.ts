import { Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { GeneratorRegistry, MaterialLibrary } from '../src/lib/index';
import reference from './fixtures/gl2-reference.json';

/**
 * Эталон gl2 для всех наборов стенда: название, число треугольников и точек разъёмов, габарит.
 * Снят скриптом scripts/gl2-compare.mjs --fixture из моделей, построенных в gl2.
 */
interface ReferenceRow {
  id: string;
  params: Record<string, unknown>;
  title: string;
  triangles: number;
  connectors: number;
  bounds: { min: number[]; max: number[] };
}

/** Допуск габарита, м. */
const TOLERANCE = 1e-6;

/**
 * Генераторы, у которых треугольников меньше или больше, чем в gl2 (журнал, п. 12).
 * В r116 примитивы Geometry (SphereGeometry, CylinderGeometry) проходят mergeVertices
 * с точностью 0,1 мм и теряют вырожденные треугольники; у сплошных втулок в gl2 — вырожденный
 * внутренний цилиндр и отверстие из NaN.
 */
const TRIANGLES_DIFFER: Record<string, string> = {
  pl_ugol_90_1: 'сфера угла',
  pl_ugol_45_1: 'сфера угла',
  pl_ugol_90_rezba_1: 'сфера угла',
  st_ugol_90_1: 'сфера угла',
  st_ugol_45_1: 'сфера угла',
  mpl_ugol_1: 'сфера угла',
  mpl_ugol_rezba_1: 'сфера угла',
  st_zagl_nr: 'сплошной шестигранник',
  al_zagl_radiator_1: 'сплошные буртик и гайка',
  rad_vozduhotvod_1: 'сплошные гайка и диск',
  shar_kran_n_1: 'сплошной шток',
  shar_kran_v_1: 'сплошной шток',
  shar_kran_v_n_1: 'сплошной шток',
  shar_kran_sgon_1: 'сплошной шток',
  reg_kran_primoy_1: 'сплошные шток и головка',
  st_collector_2: 'шток крана Ø0,1 мм',
  filtr_kosoy_1: 'сплошные крышка и гайка отстойника',
  gr_bez_1: 'сплошные детали приборов',
  // Отверстие Ø0,01 мм в gl2 схлопывается: нет внутреннего цилиндра и половины треугольников колец.
  cr_zr_nasos_1: 'мотор и вал с отверстием Ø0,01 мм',
};

/**
 * Генераторы без эталона: в gl2 это не функция-генератор (журнал, п. 12).
 * createTubeWF_1 создаёт объект редактора TubeN по точкам пути, без типа трубы и разъёмов.
 */
const NOT_IN_GL2: Record<string, string> = {
  createTubeWF_1: 'объект редактора TubeN',
};

/** Названия, которые сознательно отличаются от gl2 (журнал, п. 12). */
const TITLE_DIFFERS = new Set(['al_zagl_radiator_1', 'gr_bez_1']);

const registry = new GeneratorRegistry(new MaterialLibrary());
const rows = (reference as ReferenceRow[]).map((row) => ({ ...row, name: `${row.id} ${JSON.stringify(row.params)}` }));

describe.each(rows)('$name', (row) => {
  it('габарит, разъёмы и название как в gl2', () => {
    const generator = registry.get(row.id);
    expect(generator, row.id).toBeDefined();
    const model = generator!.build(row.params);

    const min = model.bounds.min.toArray();
    const max = model.bounds.max.toArray();
    for (let axis = 0; axis < 3; axis++) {
      expect(Math.abs(min[axis] - row.bounds.min[axis]), `min[${axis}]`).toBeLessThan(TOLERANCE);
      expect(Math.abs(max[axis] - row.bounds.max[axis]), `max[${axis}]`).toBeLessThan(TOLERANCE);
    }
    expect(model.connectors).toHaveLength(row.connectors);
    if (!TITLE_DIFFERS.has(row.id)) expect(model.title).toBe(row.title);

    if (!(row.id in TRIANGLES_DIFFER)) {
      let triangles = 0;
      model.root.traverse((object) => {
        if (object instanceof Mesh) triangles += object.geometry.getAttribute('position').count / 3;
      });
      expect(triangles).toBe(row.triangles);
    }
    model.dispose();
  });
});

describe('эталон gl2', () => {
  it('покрывает все генераторы реестра', () => {
    const covered = new Set(rows.map((row) => row.id));
    expect(registry.list().filter((generator) => !covered.has(generator.id) && !(generator.id in NOT_IN_GL2)).map((generator) => generator.id)).toEqual([]);
  });
});
