import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Assembly } from '../src/lib/assembly/Assembly';
import { HYDRAULIC_MODULE, hydraulicModule, type HydraulicContour } from '../src/lib/assembly/recipes/hydraulicModule';
import { HYDRAULIC_MANIFOLD_LINES, HYDRAULIC_MANIFOLD_STEP } from '../src/lib/generators/equipment/HydraulicManifoldGenerator';
import { GeneratorRegistry } from '../src/lib/generators/GeneratorRegistry';
import type { Connector, GeneratedModel } from '../src/lib/index';

const registry = new GeneratorRegistry();
const generator = registry.get('equipment.hydraulic-manifold');
const port = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;
/** Допуск на касание габаритов, м. */
const TOUCH = 0.001;
/** Прямые фитинги, у которых одна работа — длина: два одинаковых подряд — цепочка. */
const STRAIGHT = new Set(['steel.extension', 'steel.nipple', 'steel.coupling', 'steel.running-nipple']);

type Part = Assembly['parts'][number];
const at = (part: Part, id: string): Vector3 => new Vector3().copy(part.model.connectors.find((c) => c.id === id)!.position).applyMatrix4(part.matrix);
const direction = (part: Part, id: string): Vector3 => new Vector3().copy(part.model.connectors.find((c) => c.id === id)!.direction).transformDirection(part.matrix);
const axis = (part: Part, x: number, y: number, z: number): Vector3 => new Vector3(x, y, z).transformDirection(part.matrix);
const box = (part: Part): Box3 => {
  const { min, max } = part.model.bounds;
  return new Box3(new Vector3(min.x, min.y, min.z), new Vector3(max.x, max.y, max.z)).applyMatrix4(part.matrix);
};

describe('гидрострелка с коллектором equipment.hydraulic-manifold (позиция 107)', () => {
  it.each([2, 3, 4])('%i контура: к котлу справа, пары выходов 1" сверху через 100 мм, шаг пар 250 мм', (contours) => {
    const model = generator.build({ contours, nominal: '1', side: 'right' });
    expect(model.connectors.map((c) => c.id)).toEqual([
      'boiler-supply', 'boiler-return',
      ...Array.from({ length: contours }, (_, i) => [`supply-${i + 1}`, `return-${i + 1}`]).flat(),
      'vent', 'drain',
    ]);
    expect(port(model, 'boiler-supply')).toMatchObject({ nominal: '1', joint: 'thread', gender: 'internal', direction: { x: 1, y: 0, z: 0 } });
    // Выходы контуров — левее гидрострелки, последняя обратка — ближе всех к ней.
    expect(port(model, `return-${contours}`).position.x).toBeLessThan(port(model, 'boiler-supply').position.x - 0.08);
    expect(port(model, 'boiler-supply').position.y).toBeGreaterThan(port(model, 'boiler-return').position.y);
    for (let i = 1; i <= contours; i += 1) {
      const supply = port(model, `supply-${i}`);
      const back = port(model, `return-${i}`);
      expect(supply).toMatchObject({ nominal: '1', gender: 'external', direction: { x: 0, y: 1, z: 0 } });
      expect(back.position.x - supply.position.x).toBeCloseTo(HYDRAULIC_MANIFOLD_LINES, 12);
      expect(back.position.y).toBeCloseTo(supply.position.y, 12);
      if (i > 1) expect(supply.position.x - port(model, `supply-${i - 1}`).position.x).toBeCloseTo(HYDRAULIC_MANIFOLD_STEP, 12);
    }
    expect(port(model, 'vent')).toMatchObject({ nominal: '1/2', gender: 'internal', direction: { x: 0, y: 1, z: 0 } });
    expect(port(model, 'drain')).toMatchObject({ nominal: '1/2', gender: 'internal', direction: { x: 0, y: -1, z: 0 } });
    // Задняя грань — к стене: ничто не выходит за неё.
    expect(model.bounds.min.z).toBeCloseTo(-0.04, 6);
    expect(model.title).toBe(`Гидрострелка с коллектором на ${contours} контура, к котлу 1(в)`);
    model.dispose();
  });

  it('патрубки к котлу 1 1/4 — корпус гидрострелки крупнее; контуров не меньше 2 и не больше 4', () => {
    const small = generator.build({ contours: 2, nominal: '1', side: 'right' });
    const large = generator.build({ contours: 2, nominal: '1 1/4', side: 'right' });
    expect(port(large, 'boiler-supply').nominal).toBe('1 1/4');
    expect(large.bounds.max.y).toBeGreaterThan(small.bounds.max.y);
    expect(generator.validate({ contours: 1, nominal: '1', side: 'right' }).map(({ param }) => param)).toEqual(['contours']);
    expect(generator.validate({ contours: 5, nominal: '1', side: 'right' }).map(({ param }) => param)).toEqual(['contours']);
    small.dispose(); large.dispose();
  });

  it('гидрострелка слева: патрубки к котлу смотрят влево, выходы — правее неё в том же порядке', () => {
    const right = generator.build({ contours: 3, nominal: '1', side: 'right' });
    const left = generator.build({ contours: 3, nominal: '1', side: 'left' });
    expect(port(left, 'boiler-supply').direction).toEqual({ x: -1, y: 0, z: 0 });
    expect(port(left, 'boiler-supply').position.x).toBeCloseTo(-port(right, 'boiler-supply').position.x, 9);
    expect(port(left, 'supply-1').position.x).toBeGreaterThan(port(left, 'boiler-supply').position.x + 0.08);
    for (const id of ['supply-1', 'return-1', 'supply-2', 'return-3']) {
      expect(port(left, id).position.y).toBeCloseTo(port(right, id).position.y, 9);
    }
    expect(port(left, 'supply-2').position.x - port(left, 'supply-1').position.x).toBeCloseTo(HYDRAULIC_MANIFOLD_STEP, 12);
    expect(left.title).toBe('Гидрострелка с коллектором на 3 контура, к котлу 1(в), гидрострелка слева');
    right.dispose(); left.dispose();
  });
});

const combos: [string, HydraulicContour[], ('right' | 'left')?][] = [
  ['2 прямых', ['direct', 'direct']],
  ['гидрострелка слева: смесительный и 2 прямых', ['mixing', 'direct', 'direct'], 'left'],
  ['4 прямых', ['direct', 'direct', 'direct', 'direct']],
  ['прямой и смесительный', ['direct', 'mixing']],
  ['3 прямых и смесительный', ['direct', 'direct', 'direct', 'mixing']],
  ['2 смесительных', ['mixing', 'mixing']],
];

describe('котельная hydraulicModule: гидрострелка с коллектором и насосные группы', () => {
  it.each(combos)('%s', (_, contours, side) => {
    const module = hydraulicModule({ contours, side });
    const { definition } = module;
    expect(definition.parts[0].name).toBe('гидрострелка');
    const names = definition.parts.map((part) => part.name);
    expect(new Set(names).size).toBe(names.length);
    const assembly = new Assembly(registry, definition);
    try {
      expect(assembly.errors).toEqual([]);
      expect(assembly.joints.filter(({ check }) => !check.compatible).map(({ label }) => label)).toEqual([]);
      expect(assembly.closures.filter(({ closed }) => !closed).map(({ label }) => label)).toEqual([]);
      expect(assembly.closures.length).toBe(contours.filter((kind) => kind === 'mixing').length);
      const byName = new Map(assembly.parts.map((part) => [part.name, part]));
      const kind = new Map(definition.parts.map((part) => [part.name, part]));

      // Одна связанная группа от гидрострелки — стыками; цепочек удлинителей нет.
      expect(definition.parts.slice(1).every((part) => part.attach)).toBe(true);
      expect(definition.parts.filter(({ generatorId }) => generatorId === 'steel.extension')).toEqual([]);
      const chains = definition.parts.filter((part) => {
        const before = part.attach && kind.get(part.attach.to);
        return before && STRAIGHT.has(part.generatorId) && part.generatorId === before.generatorId && JSON.stringify(part.params) === JSON.stringify(before.params);
      });
      expect(chains.map(({ name }) => name)).toEqual([]);

      // Свободны патрубки к котлу, верхние краны групп, штуцер слива и места контргаек сгонов.
      const used = new Set<string>();
      for (const part of definition.parts) {
        if (!part.attach) continue;
        used.add(`${part.name}.${part.attach.connector}`);
        used.add(`${part.attach.to}.${part.attach.toConnector}`);
      }
      for (const closure of definition.closures ?? []) used.add(`${closure.part}.${closure.connector}`).add(`${closure.to}.${closure.toConnector}`);
      const free = assembly.parts.flatMap(({ name, model }) => model.connectors.map(({ id }) => `${name}.${id}`)).filter((key) => !used.has(key));
      const ends = module.contours.flatMap(({ supply, return: back }) => [`${supply.part}.${supply.connector}`, `${back.part}.${back.connector}`]);
      const locknuts = names.filter((name) => name.startsWith('сгон ')).map((name) => `${name}.locknut`);
      expect(free.sort()).toEqual(['гидрострелка.boiler-supply', 'гидрострелка.boiler-return', 'кран слива.hose', ...ends, ...locknuts].sort());
      expect(module.boiler).toEqual({ supply: { part: 'гидрострелка', connector: 'boiler-supply' }, return: { part: 'гидрострелка', connector: 'boiler-return' } });

      // Контуры слева направо; концы смотрят вверх, подача и обратка — на одной высоте через 100 мм.
      expect(module.contours.map(({ kind: item }) => item)).toEqual(contours);
      let left = -Infinity;
      for (const { supply, return: back } of module.contours) {
        const a = byName.get(supply.part)!;
        const b = byName.get(back.part)!;
        expect(direction(a, supply.connector).y).toBeCloseTo(1, 6);
        expect(direction(b, back.connector).y).toBeCloseTo(1, 6);
        expect(at(b, back.connector).y).toBeCloseTo(at(a, supply.connector).y, 3);
        expect(at(b, back.connector).x - at(a, supply.connector).x).toBeCloseTo(HYDRAULIC_MANIFOLD_LINES, 3);
        expect(at(a, supply.connector).x).toBeGreaterThan(left);
        left = at(a, supply.connector).x;
      }

      // Насосы и термометры — вперёд, от стены; за заднюю грань гидрострелки ничто не выходит.
      for (const part of assembly.parts) {
        if (part.name.startsWith('насос ') || part.name.startsWith('термометр ')) expect(axis(part, 0, 0, 1).z, part.name).toBeCloseTo(1, 6);
      }
      const back = box(byName.get('гидрострелка')!).min.z;
      expect(assembly.parts.filter((part) => box(part).min.z < back - TOUCH).map(({ name }) => name)).toEqual([]);

      // Столкновений нет: габариты деталей дальше двух стыков друг от друга не пересекаются.
      const near = new Map(names.map((name) => [name, new Set([name])]));
      const links = [
        ...definition.parts.flatMap((part) => (part.attach ? [[part.name, part.attach.to]] : [])),
        ...(definition.closures ?? []).map(({ part, to }) => [part, to]),
      ];
      for (const [a, b] of links) {
        near.get(a)!.add(b);
        near.get(b)!.add(a);
      }
      const within = (a: string, b: string) => [...near.get(a)!].some((middle) => near.get(middle)!.has(b));
      const hits: string[] = [];
      for (let i = 0; i < assembly.parts.length; i += 1) {
        for (let j = i + 1; j < assembly.parts.length; j += 1) {
          const a = assembly.parts[i];
          const b = assembly.parts[j];
          if (within(a.name, b.name)) continue;
          const overlap = box(a).clone().intersect(box(b));
          if (overlap.isEmpty()) continue;
          const size = overlap.getSize(new Vector3());
          if (Math.min(size.x, size.y, size.z) > TOUCH) hits.push(`${a.name} × ${b.name}`);
        }
      }
      expect(hits).toEqual([]);
    } finally {
      for (const part of assembly.parts) part.model.dispose();
    }
  });

  it('контуров меньше двух или больше четырёх — ошибка с причиной', () => {
    expect(() => hydraulicModule({ contours: ['direct'] })).toThrow(/контуров 2–4, а задано 1/);
    expect(() => hydraulicModule({ contours: ['direct', 'direct', 'direct', 'direct', 'direct'] })).toThrow(/задано 5/);
  });

  it('узел каталога: исполнения — прямые контуры и, по желанию, смесительный справа', () => {
    expect(HYDRAULIC_MODULE.variants!.map(({ key }) => key)).toEqual(['direct-2', 'direct-3', 'direct-4', 'direct-1-mixing', 'direct-2-mixing', 'direct-3-mixing']);
    expect(HYDRAULIC_MODULE.build('direct-2-mixing').label).toBe('Гидрострелка с коллектором на 3 контура: 2 прямых и смесительный, насосы VRS, термометры');
    expect(() => HYDRAULIC_MODULE.build('нет такого')).toThrow(/Нет исполнения/);
  });
});
