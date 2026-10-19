import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ConnectorMating, GeneratorRegistry, ParamSchema } from '../src/lib/index';
import type { Connector, GeneratedModel, MpPipePathParams, ParamSpec, Vector3Data } from '../src/lib/index';
import { PipePathBuilder } from '../src/lib/geometry/PipePathBuilder';

const registry = new GeneratorRegistry();
const generator = registry.get('mp.pipe-path');
const port = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;
const build = (params: Partial<MpPipePathParams>) => generator.build({ ...generator.defaults, ...params });
const v = (x: number, y: number, z: number): Vector3Data => ({ x, y, z });

describe('параметр-путь в схеме', () => {
  const spec: ParamSpec = { kind: 'path', key: 'path', label: 'Траектория', minPoints: 2, maxPoints: 3, extent: 1 };
  const codes = (path: unknown) => ParamSchema.validate([spec], { path }).map((e) => e.code);

  it('массив точек с конечными координатами в границах проходит', () => {
    expect(codes([v(0, 0, 0), v(1, 0, 0)])).toEqual([]);
  });

  it.each([
    ['строка вместо массива', '0,0,0;1,0,0', 'not_a_path'],
    ['точка без координаты', [v(0, 0, 0), { x: 1, y: 0 }], 'not_a_path'],
    ['NaN в координате', [v(0, 0, 0), v(Number.NaN, 0, 0)], 'not_a_path'],
    ['одна точка', [v(0, 0, 0)], 'path_points'],
    ['четыре точки', [v(0, 0, 0), v(0.1, 0, 0), v(0.2, 0, 0), v(0.3, 0, 0)], 'path_points'],
    ['точка дальше extent', [v(0, 0, 0), v(1.5, 0, 0)], 'out_of_range'],
  ])('%s отклоняется', (_, path, code) => {
    expect(codes(path)).toEqual([code]);
  });
});

describe('PipePathBuilder', () => {
  it('прямой путь: длина, порты на концах наружу, прямой участок — вся труба', () => {
    const pipe = PipePathBuilder.build([v(0, 0, 0), v(0.5, 0, 0)], 0.08, 0.016);
    expect(pipe.length).toBeCloseTo(0.5, 12);
    expect(pipe.start).toMatchObject({ position: v(0, 0, 0), direction: v(-1, 0, 0), straight: 0.5 });
    expect(pipe.end).toMatchObject({ position: v(0.5, 0, 0), direction: v(1, 0, 0), straight: 0.5 });
    // 1 участок × 12 граней × 2 треугольника.
    expect(pipe.geometry.getAttribute('position').count).toBe(72);
    pipe.geometry.dispose();
  });

  it('плоский поворот 90°: длина с дугой, касательные у концов, перенос сечения без закрутки', () => {
    const R = 0.08;
    const pipe = PipePathBuilder.build([v(0, 0, 0), v(0.3, 0, 0), v(0.3, 0.3, 0)], R, 0.016);
    expect(pipe.length).toBeCloseTo(0.3 + 0.3 - 2 * R + (Math.PI / 2) * R, 3);
    expect(pipe.end.direction.y).toBeCloseTo(1, 9);
    expect(pipe.start.straight).toBeCloseTo(0.3 - R, 12);
    // Начальный опорный вектор +Y (проекция +Y), после поворота в плоскости XY он становится −X.
    expect(pipe.start.up).toEqual(v(0, 1, 0));
    expect(pipe.end.up.x).toBeCloseTo(-1, 9);
    pipe.geometry.dispose();
  });

  it('пространственный путь: нормали единичные и перпендикулярны оси на прямых участках, up ⟂ direction', () => {
    const pipe = PipePathBuilder.build([v(0, 0, 0), v(0.3, 0, 0), v(0.3, 0.3, 0), v(0.3, 0.3, 0.3)], 0.08, 0.016);
    const normal = pipe.geometry.getAttribute('normal');
    for (let i = 0; i < normal.count; i++) expect(new Vector3().fromBufferAttribute(normal, i).length()).toBeCloseTo(1, 5);
    for (const end of [pipe.start, pipe.end]) expect(new Vector3().copy(end.up).dot(new Vector3().copy(end.direction))).toBeCloseTo(0, 9);
    expect(pipe.end.direction.z).toBeCloseTo(1, 9);
    pipe.geometry.dispose();
  });

  it('одинаковый вход — одинаковая сетка', () => {
    const points = [v(0, 0, 0), v(0.2, 0.1, 0), v(0.2, 0.3, 0.2), v(0.5, 0.3, 0.2)];
    const a = PipePathBuilder.build(points, 0.05, 0.02);
    const b = PipePathBuilder.build(points, 0.05, 0.02);
    expect(Array.from(a.geometry.getAttribute('position').array)).toEqual(Array.from(b.geometry.getAttribute('position').array));
    a.geometry.dispose(); b.geometry.dispose();
  });

  it('острые углы (радиус 0): длина по ломаной, прямой участок — весь крайний отрезок, без щели', () => {
    const points = [v(0, 0, 0), v(0.3, 0, 0), v(0.3, 0.3, 0), v(0.3, 0.3, 0.3)];
    const pipe = PipePathBuilder.build(points, 0, 0.016);
    expect(pipe.length).toBeCloseTo(0.9, 12);
    expect(pipe.start.straight).toBeCloseTo(0.3, 12);
    expect(pipe.end.straight).toBeCloseTo(0.3, 12);
    expect(pipe.end.direction.z).toBeCloseTo(1, 9);
    // 3 участка × 12 граней × 2 треугольника: пара колец угла участка не даёт.
    const position = pipe.geometry.getAttribute('position');
    expect(position.count).toBe(3 * 72);
    // Стык «на ус»: торец первого участка и начало второго — одни и те же точки в плоскости x + y = 0,3.
    const ring = (strip: number, end: 0 | 1) => Array.from({ length: 12 }, (_, j) =>
      new Vector3().fromBufferAttribute(position, strip * 72 + j * 6 + (end === 0 ? 0 : 2)));
    const first = ring(0, 1);
    const second = ring(1, 0);
    first.forEach((point, j) => {
      expect(point.distanceTo(second[j])).toBeLessThan(1e-6);
      expect(point.x + point.y).toBeCloseTo(0.3, 6);
    });
    // Нормали — каждого отрезка свои, перпендикулярны его оси.
    const normal = pipe.geometry.getAttribute('normal');
    for (let i = 0; i < 72; i++) expect(new Vector3().fromBufferAttribute(normal, i).x).toBeCloseTo(0, 6);
    pipe.geometry.dispose();
  });

  it('острый угол 45°: проверка гибов не мешает коротким отрезкам', () => {
    const points = [v(0, 0, 0), v(0.05, 0, 0), v(0.1, 0, 0.05), v(0.1, 0, 0.06)];
    expect(PipePathBuilder.analyze(points, 0, 0.016)).toEqual([]);
    expect(PipePathBuilder.analyze(points, 0.08, 0.016).map((issue) => issue.code)).toContain('segment_too_short');
    PipePathBuilder.build(points, 0, 0.016).geometry.dispose();
  });

  it.each([
    ['нулевой отрезок', [v(0, 0, 0), v(0, 0, 0), v(0.3, 0, 0)], 'zero_segment'],
    ['разворот на 180°', [v(0, 0, 0), v(0.3, 0, 0), v(0.1, 0, 0)], 'reversal'],
    ['короткий отрезок между изгибами', [v(0, 0, 0), v(0.3, 0, 0), v(0.3, 0.1, 0), v(0, 0.1, 0)], 'segment_too_short'],
    ['несмежные отрезки ближе диаметра', [v(0, 0, 0), v(0.5, 0, 0), v(0.5, 0.3, 0), v(0.2, 0.3, 0), v(0.2, 0.3, 0.3), v(0.2, 0.01, 0.3), v(0.2, 0.01, -0.3)], 'self_intersection'],
  ])('%s — ошибка %s', (_, points, code) => {
    expect(PipePathBuilder.analyze(points, 0.08, 0.016).map((issue) => issue.code)).toContain(code);
    expect(() => PipePathBuilder.build(points, 0.08, 0.016)).toThrow();
  });
});

describe('труба МП по траектории mp.pipe-path (позиция 8)', () => {
  it('концы — наружные mp-press, глубина — прямой участок у торца', () => {
    const model = build({});
    expect(port(model, 'start')).toMatchObject({ joint: 'mp-press', gender: 'external', nominal: '16', direction: v(-1, 0, 0) });
    expect(port(model, 'start').depth).toBeCloseTo(0.3 - 0.08, 12);
    expect(port(model, 'end').direction.z).toBeCloseTo(1, 9);
    expect(model.materials).toEqual(['pipe']);
    model.dispose();
  });

  it('стыкуется с обжимным и пресс-соединителем, адаптером евроконуса; не с ПП-раструбом', () => {
    const model = build({});
    const pp20 = build({ nominal: '20', bendRadius: 0.1, path: [v(0, 0, 0), v(0.3, 0, 0)] });
    const mating = (id: string, params: unknown, connector: string) => {
      const fitting = registry.get(id)!.build(params);
      const check = ConnectorMating.check(port(model, 'start'), fitting.connectors.find((c) => c.id === connector)!);
      fitting.dispose();
      return check.compatible;
    };
    expect(mating('mp.compression-coupling', { nominalLeft: '16', nominalRight: '16', length: 0.045 }, 'left')).toBe(true);
    expect(mating('mp.coupling', registry.get('mp.coupling').defaults, 'left')).toBe(true);
    expect(mating('mp.eurocone-adapter', { pipeNominal: '16', euroconeNominal: '3/4', length: 0.026 }, 'pipe')).toBe(true);
    const pp = registry.get('pp.coupling').build({ nominalLeft: '20', nominalRight: '20', length: 0.03 });
    expect(ConnectorMating.check(port(pp20, 'start'), pp.connectors[0])).toMatchObject({ compatible: false, reason: 'joint' });
    model.dispose(); pp20.dispose(); pp.dispose();
  });

  it('радиус: меньше трубогиба VALTEC — ошибка, меньше ручного гиба — предупреждение', () => {
    expect(generator.validate({ ...generator.defaults, bendRadius: 0.04 }).map((e) => `${e.code}:${e.param}`)).toEqual(['too_small:bendRadius']);
    const tool = build({ bendRadius: 0.05 });
    expect(tool.warnings).toHaveLength(1);
    expect(tool.warnings[0]).toContain('80 мм');
    tool.dispose();
    const hand = build({ bendRadius: 0.08 });
    expect(hand.warnings).toEqual([]);
    hand.dispose();
  });

  it('радиус 0 — острые углы: ни ошибки трубогиба, ни предупреждения', () => {
    expect(generator.validate({ ...generator.defaults, bendRadius: 0 })).toEqual([]);
    const sharp = build({ bendRadius: 0 });
    expect(sharp.warnings).toEqual([]);
    expect(port(sharp, 'start').depth).toBeCloseTo(0.3, 12);
    sharp.dispose();
    expect(generator.validate({ ...generator.defaults, bendRadius: 0.01 }).map((e) => e.code)).toEqual(['too_small']);
  });

  it('ошибки траектории — по параметру path', () => {
    const errors = generator.validate({ ...generator.defaults, path: [v(0, 0, 0), v(0.05, 0, 0), v(0.05, 0.05, 0)] });
    expect(errors.map((e) => `${e.code}:${e.param}`)).toEqual(['segment_too_short:path', 'segment_too_short:path']);
  });
});
