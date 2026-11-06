import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Assembly } from '../src/lib/assembly/Assembly';
import { BOILER_UNIT, boilerPipework, type BoilerPipeworkBuiltIn } from '../src/lib/assembly/recipes/boilerPipework';
import { GeneratorRegistry } from '../src/lib/generators/GeneratorRegistry';

const registry = new GeneratorRegistry();
const SIZE = { x: 0.4, y: 0.73, z: 0.3 };
const BOILER = { generatorId: 'equipment.boiler' as const, params: { dimensions: SIZE, nominal: '3/4', connection: 'bottom' } };
/** Низ патрубков котла в системе узла (центр корпуса — начало координат). */
const OUTLETS = -SIZE.y / 2 - 0.0212;
/** Котёл мастера редактора висит низом патрубков на 0,8 м: узел не опускается ниже 10 см над полом. */
const FLOOR = OUTLETS - 0.8 + 0.1;
/** Допуск на касание габаритов соседних деталей, м. */
const TOUCH = 0.001;

type Part = Assembly['parts'][number];
const port = (part: Part, id: string): Vector3 =>
  new Vector3().copy(part.model.connectors.find((item) => item.id === id)!.direction).transformDirection(part.matrix);
const axis = (part: Part, x: number, y: number, z: number): Vector3 => new Vector3(x, y, z).transformDirection(part.matrix);
const box = (part: Part): Box3 => {
  const { min, max } = part.model.bounds;
  return new Box3(new Vector3(min.x, min.y, min.z), new Vector3(max.x, max.y, max.z)).applyMatrix4(part.matrix);
};

const combos: [string, BoilerPipeworkBuiltIn][] = [];
for (const pump of [true, false]) {
  for (const expansionTank of [true, false]) {
    for (const safetyGroup of [true, false]) {
      const where = (inside: boolean) => (inside ? 'в котле' : 'в обвязке');
      combos.push([`насос ${where(pump)}, бак ${where(expansionTank)}, группа безопасности ${where(safetyGroup)}`, { pump, expansionTank, safetyGroup }]);
    }
  }
}

/** Куда смотрит деталь, если она есть: разъём или ось модели → направление в системе котла (+Z — в помещение). */
const DIRECTIONS: [string, (part: Part) => Vector3, [number, number, number]][] = [
  ['тройник группы безопасности', (part) => port(part, 'top'), [-1, 0, 0]],
  ['угольник группы безопасности', (part) => port(part, 'top'), [0, 1, 0]],
  ['группа безопасности', (part) => axis(part, 0, 0, 1), [0, 0, 1]],
  ['кран подачи', (part) => axis(part, 0, 1, 0), [0, 0, 1]],
  ['насос', (part) => axis(part, 0, 0, 1), [0, 0, 1]],
  ['тройник бака', (part) => port(part, 'top'), [0, 0, 1]],
  ['угольник бака', (part) => port(part, 'top'), [0, -1, 0]],
  ['бак', (part) => port(part, 'bottom'), [0, 1, 0]],
  ['тройник слива', (part) => port(part, 'top'), [1, 0, 0]],
  ['кран обратки', (part) => axis(part, 0, 1, 0), [0, 0, 1]],
];

describe('обвязка котла', () => {
  it.each(combos)('%s', (_, builtIn) => {
    const { definition, supply, return: back } = boilerPipework(BOILER, { builtIn });
    expect(definition.parts[0].name).toBe('котёл');
    const names = definition.parts.map((part) => part.name);
    expect(new Set(names).size).toBe(names.length);
    // Чего нет в котле — то в обвязке, и наоборот.
    expect(names.includes('насос')).toBe(!builtIn.pump);
    expect(names.includes('бак')).toBe(!builtIn.expansionTank);
    expect(names.includes('группа безопасности')).toBe(!builtIn.safetyGroup);
    for (const always of ['американка подачи', 'кран подачи', 'американка обратки', 'фильтр', 'кран слива', 'кран обратки']) expect(names).toContain(always);

    const assembly = new Assembly(registry, definition);
    try {
      expect(assembly.errors).toEqual([]);
      expect(assembly.joints.filter(({ check }) => !check.compatible).map(({ label }) => label)).toEqual([]);
      expect(assembly.parts.length).toBe(definition.parts.length);

      // Одна связанная группа от котла: каждая деталь, кроме него, присоединена стыком.
      expect(definition.parts.slice(1).every((part) => part.attach)).toBe(true);
      const used = new Set<string>();
      for (const part of definition.parts) {
        if (!part.attach) continue;
        used.add(`${part.name}.${part.attach.connector}`);
        used.add(`${part.attach.to}.${part.attach.toConnector}`);
      }
      // Свободны только концы кранов (к ним — магистраль) и штуцер крана слива под шланг.
      const free = assembly.parts.flatMap(({ name, model }) => model.connectors.map(({ id }) => `${name}.${id}`)).filter((key) => !used.has(key));
      expect(free.sort()).toEqual(['кран обратки.right', 'кран подачи.right', 'кран слива.hose']);
      expect([supply, back]).toEqual([{ part: 'кран подачи', connector: 'right' }, { part: 'кран обратки', connector: 'right' }]);

      const byName = new Map(assembly.parts.map((part) => [part.name, part]));
      // Концы — наружная резьба 3/4, как у патрубков, и смотрят вниз; подача — левее обратки.
      for (const end of [supply, back]) {
        const part = byName.get(end.part)!;
        const connector = part.model.connectors.find(({ id }) => id === end.connector)!;
        expect([connector.joint, connector.gender, connector.nominal]).toEqual(['thread', 'external', '3/4']);
        expect(port(part, end.connector).distanceTo(new Vector3(0, -1, 0))).toBeLessThan(1e-6);
      }
      const at = (name: string) => new Vector3().setFromMatrixPosition(byName.get(name)!.matrix);
      expect(at('кран подачи').x).toBeLessThan(at('кран обратки').x);

      for (const [name, measure, target] of DIRECTIONS) {
        const part = byName.get(name);
        if (part) expect(measure(part).distanceTo(new Vector3(...target)), name).toBeLessThan(1e-6);
      }

      // Детали не задевают котёл и друг друга (кроме соседей по стыку), не заходят за котёл
      // (там стена) и не опускаются к полу.
      const neighbours = new Set(definition.parts.flatMap((part) => (part.attach ? [`${part.name}|${part.attach.to}`, `${part.attach.to}|${part.name}`] : [])));
      const boxes = assembly.parts.map((part) => ({ name: part.name, box: box(part).expandByScalar(-TOUCH) }));
      const clashes: string[] = [];
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          if (!neighbours.has(`${boxes[i].name}|${boxes[j].name}`) && boxes[i].box.intersectsBox(boxes[j].box)) clashes.push(`${boxes[i].name} × ${boxes[j].name}`);
        }
      }
      expect(clashes).toEqual([]);
      const all = new Box3();
      for (const part of assembly.parts) all.union(box(part));
      expect(all.min.z, 'за котлом — стена').toBeGreaterThanOrEqual(-SIZE.z / 2 - 1e-6);
      expect(all.min.y, 'до пола').toBeGreaterThan(FLOOR);
    } finally {
      assembly.dispose();
    }
  });

  it('объём бака — позиция каталога', () => {
    const builtIn = { pump: true, expansionTank: false, safetyGroup: true };
    const { definition } = boilerPipework(BOILER, { builtIn, tankVolume: 12 });
    expect(definition.parts.find(({ name }) => name === 'бак')!.params).toMatchObject({ volume: 12, diameter: 0.285, height: 0.325 });
    expect(() => boilerPipework(BOILER, { builtIn, tankVolume: 7 })).toThrow(/нет бака на 7 л/);
  });

  it('котёл не с патрубками снизу или не 3/4 — ошибка с причиной', () => {
    const builtIn = { pump: true, expansionTank: true, safetyGroup: true };
    for (const connection of ['back', 'top-bottom', 'left-right']) {
      expect(() => boilerPipework({ ...BOILER, params: { ...BOILER.params, connection } }, { builtIn })).toThrow(/только у котла с патрубками снизу/);
    }
    expect(() => boilerPipework({ ...BOILER, params: { ...BOILER.params, nominal: '1' } }, { builtIn })).toThrow(/только под патрубки 3\/4/);
  });

  it('узел каталога «Котёл с обвязкой» — по исполнению', () => {
    expect(BOILER_UNIT.variants!.map(({ key }) => key)).toEqual(['built-in', 'pump', 'none']);
    const counts = BOILER_UNIT.variants!.map(({ key }) => BOILER_UNIT.build(key).parts.length);
    expect(counts[0]).toBeLessThan(counts[1]);
    expect(counts[1]).toBeLessThan(counts[2]);
    expect(() => BOILER_UNIT.build('wall')).toThrow(/Нет исполнения/);
  });
});
