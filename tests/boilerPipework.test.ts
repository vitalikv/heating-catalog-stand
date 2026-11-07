import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Assembly } from '../src/lib/assembly/Assembly';
import {
  BOILER_UNIT,
  boilerPipework,
  type BoilerPipeworkAdapter,
  type BoilerPipeworkBuiltIn,
  type BoilerPipeworkOptions,
} from '../src/lib/assembly/recipes/boilerPipework';
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
/** Самый короткий видимый кусок трубы выноса между переходниками, м. */
const MIN_PIPE = 0.03;

/** Переходники редактора на резьбу 3/4 — позиции каталога: МП 26 и ПП 25, наружная резьба. */
const ADAPTERS: Record<'МП' | 'ПП', BoilerPipeworkAdapter> = {
  'МП': { generatorId: 'mp.thread-adapter', params: { threadGender: 'external', pipeNominal: '26', threadNominal: '3/4', length: 0.05 }, thread: 'right', pipe: 'left' },
  'ПП': { generatorId: 'pp.thread-adapter', params: { threadGender: 'external', pipeNominal: '25', threadNominal: '3/4', length: 0.041 }, thread: 'right', pipe: 'left' },
};
/** Чем набраны выносы: сгоном (узел каталога) или трубой редактора. */
const RUNS: [string, BoilerPipeworkOptions['run']][] = [['сгон', undefined], ['труба МП', { adapter: ADAPTERS['МП'] }], ['труба ПП', { adapter: ADAPTERS['ПП'] }]];
/** Прямые фитинги, у которых одна работа — длина: два одинаковых подряд — цепочка. */
const STRAIGHT = new Set(['steel.extension', 'steel.nipple', 'steel.coupling', 'steel.running-nipple']);

type Part = Assembly['parts'][number];
const connectorOf = (part: Part, id: string) => part.model.connectors.find((item) => item.id === id)!;
const at = (part: Part, id: string): Vector3 => new Vector3().copy(connectorOf(part, id).position).applyMatrix4(part.matrix);
const port = (part: Part, id: string): Vector3 => new Vector3().copy(connectorOf(part, id).direction).transformDirection(part.matrix);
const axis = (part: Part, x: number, y: number, z: number): Vector3 => new Vector3(x, y, z).transformDirection(part.matrix);
const box = (part: Part): Box3 => {
  const { min, max } = part.model.bounds;
  return new Box3(new Vector3(min.x, min.y, min.z), new Vector3(max.x, max.y, max.z)).applyMatrix4(part.matrix);
};

const combos: [string, BoilerPipeworkBuiltIn, BoilerPipeworkOptions['run']][] = [];
for (const [runLabel, run] of RUNS) {
  for (const pump of [true, false]) {
    for (const expansionTank of [true, false]) {
      for (const safetyGroup of [true, false]) {
        const where = (inside: boolean) => (inside ? 'в котле' : 'в обвязке');
        combos.push([`${runLabel}: насос ${where(pump)}, бак ${where(expansionTank)}, группа безопасности ${where(safetyGroup)}`, { pump, expansionTank, safetyGroup }, run]);
      }
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
  it.each(combos)('%s', (_, builtIn, run) => {
    const { definition, supply, return: back, runs } = boilerPipework(BOILER, { builtIn, run });
    expect(definition.parts[0].name).toBe('котёл');
    const names = definition.parts.map((part) => part.name);
    expect(new Set(names).size).toBe(names.length);
    // Чего нет в котле — то в обвязке, и наоборот.
    expect(names.includes('насос')).toBe(!builtIn.pump);
    expect(names.includes('бак')).toBe(!builtIn.expansionTank);
    expect(names.includes('группа безопасности')).toBe(!builtIn.safetyGroup);
    for (const always of ['американка подачи', 'кран подачи', 'американка обратки', 'фильтр', 'кран слива', 'кран обратки']) expect(names).toContain(always);
    // Вынос — к каждому, что не в котле: к группе безопасности и к баку.
    const expected = [...(builtIn.safetyGroup ? [] : ['группа безопасности']), ...(builtIn.expansionTank ? [] : ['бак'])];
    expect(runs.map(({ role }) => role)).toEqual(run ? expected : []);
    expect(names.filter((name) => name.startsWith('сгон ')).length).toBe(run ? 0 : expected.length);

    const assembly = new Assembly(registry, definition);
    try {
      expect(assembly.errors).toEqual([]);
      expect(assembly.joints.filter(({ check }) => !check.compatible).map(({ label }) => label)).toEqual([]);
      expect(assembly.parts.length).toBe(definition.parts.length);
      const byName = new Map(assembly.parts.map((part) => [part.name, part]));
      const kind = new Map(definition.parts.map((part) => [part.name, part]));

      // Цепочек удлинителей нет: удлинителей нет вовсе, и два одинаковых прямых фитинга подряд не стоят.
      expect(definition.parts.filter(({ generatorId }) => generatorId === 'steel.extension').map(({ name }) => name)).toEqual([]);
      const chains = definition.parts.filter((part) => {
        const before = part.attach && kind.get(part.attach.to);
        return before && STRAIGHT.has(part.generatorId) && part.generatorId === before.generatorId && JSON.stringify(part.params) === JSON.stringify(before.params);
      });
      expect(chains.map(({ name }) => name)).toEqual([]);

      // Одна связанная группа от котла: каждая деталь, кроме него, присоединена стыком или стоит
      // напротив выноса, и вынос замыкает труба между его парой разъёмов.
      expect(definition.parts.slice(1).every((part) => part.attach || part.across)).toBe(true);
      expect(definition.parts.filter((part) => part.across).length).toBe(runs.length);
      const linked = new Set(['котёл']);
      const edges = [
        ...definition.parts.flatMap((part) => (part.attach ? [[part.name, part.attach.to]] : [])),
        ...runs.map(({ from, to }) => [from.part, to.part]),
      ];
      for (let grew = true; grew;) {
        grew = false;
        for (const [a, b] of edges) {
          if (linked.has(a) !== linked.has(b)) {
            linked.add(a);
            linked.add(b);
            grew = true;
          }
        }
      }
      expect(names.filter((name) => !linked.has(name))).toEqual([]);

      // Свободны только концы кранов (к ним — магистраль), штуцер крана слива под шланг, концы
      // выносов под трубу и место контргайки на сгоне.
      const used = new Set<string>();
      for (const part of definition.parts) {
        if (!part.attach) continue;
        used.add(`${part.name}.${part.attach.connector}`);
        used.add(`${part.attach.to}.${part.attach.toConnector}`);
      }
      const free = assembly.parts.flatMap(({ name, model }) => model.connectors.map(({ id }) => `${name}.${id}`)).filter((key) => !used.has(key));
      const pairs = runs.flatMap(({ from, to }) => [`${from.part}.${from.connector}`, `${to.part}.${to.connector}`]);
      const locknuts = names.filter((name) => name.startsWith('сгон ')).map((name) => `${name}.locknut`);
      expect(free.sort()).toEqual(['кран обратки.right', 'кран подачи.right', 'кран слива.hose', ...pairs, ...locknuts].sort());
      expect([supply, back]).toEqual([{ part: 'кран подачи', connector: 'right' }, { part: 'кран обратки', connector: 'right' }]);

      // Пара выноса: разъёмы под трубу смотрят друг на друга по одной оси, между ними — кусок трубы.
      for (const { role, from, to } of runs) {
        const a = byName.get(from.part)!;
        const b = byName.get(to.part)!;
        const span = at(b, to.connector).sub(at(a, from.connector));
        expect(span.length(), role).toBeGreaterThan(MIN_PIPE);
        expect(span.clone().normalize().distanceTo(port(a, from.connector)), role).toBeLessThan(1e-6);
        expect(port(b, to.connector).dot(port(a, from.connector)), role).toBeCloseTo(-1, 6);
        expect(connectorOf(a, from.connector).joint).toBe(connectorOf(b, to.connector).joint);
      }

      // Концы — наружная резьба 3/4, как у патрубков, и смотрят вниз; подача — левее обратки.
      for (const end of [supply, back]) {
        const part = byName.get(end.part)!;
        const connector = connectorOf(part, end.connector);
        expect([connector.joint, connector.gender, connector.nominal]).toEqual(['thread', 'external', '3/4']);
        expect(port(part, end.connector).distanceTo(new Vector3(0, -1, 0))).toBeLessThan(1e-6);
      }
      const centre = (name: string) => new Vector3().setFromMatrixPosition(byName.get(name)!.matrix);
      expect(centre('кран подачи').x).toBeLessThan(centre('кран обратки').x);

      for (const [name, measure, target] of DIRECTIONS) {
        const part = byName.get(name);
        if (part) expect(measure(part).distanceTo(new Vector3(...target)), name).toBeLessThan(1e-6);
      }

      // Группа безопасности — сбоку от котла, слева, не выше его середины.
      const group = byName.get('группа безопасности');
      if (group) {
        expect(box(group).max.x).toBeLessThan(-SIZE.x / 2);
        expect(box(group).max.y).toBeLessThan(0);
      }

      // Детали и трубы выносов не задевают котёл и друг друга (кроме соседей по стыку), не заходят
      // за котёл (там стена) и не опускаются к полу.
      const neighbours = new Set(edges.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
      const boxes = assembly.parts.map((part) => ({ name: part.name, box: box(part).expandByScalar(-TOUCH) }));
      for (const { role, from, to } of runs) {
        // Труба выноса — её ось с диаметром разъёма под неё; соседи — оба переходника.
        const a = at(byName.get(from.part)!, from.connector);
        const b = at(byName.get(to.part)!, to.connector);
        const radius = Number(connectorOf(byName.get(from.part)!, from.connector).nominal) / 2000;
        const pipe = `труба ${role}`;
        boxes.push({ name: pipe, box: new Box3().setFromPoints([a, b]).expandByScalar(radius - TOUCH) });
        for (const end of [from.part, to.part]) neighbours.add(`${pipe}|${end}`).add(`${end}|${pipe}`);
      }
      const clashes: string[] = [];
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          if (!neighbours.has(`${boxes[i].name}|${boxes[j].name}`) && boxes[i].box.intersectsBox(boxes[j].box)) clashes.push(`${boxes[i].name} × ${boxes[j].name}`);
        }
      }
      expect(clashes).toEqual([]);
      const all = new Box3();
      for (const { box: item } of boxes) all.union(item);
      expect(all.min.z, 'за котлом — стена').toBeGreaterThanOrEqual(-SIZE.z / 2 - 1e-6);
      expect(all.min.y, 'до пола').toBeGreaterThan(FLOOR);
    } finally {
      assembly.dispose();
    }
  });

  it.each(RUNS)('объём бака — позиция каталога; бак любого объёма ничего не задевает (%s)', (_, run) => {
    const builtIn = { pump: true, expansionTank: false, safetyGroup: true };
    const { definition } = boilerPipework(BOILER, { builtIn, tankVolume: 12, run });
    expect(definition.parts.find(({ name }) => name === 'бак')!.params).toMatchObject({ volume: 12, diameter: 0.285, height: 0.325 });
    expect(() => boilerPipework(BOILER, { builtIn, tankVolume: 7, run })).toThrow(/нет бака на 7 л/);
    // Вынос растёт с диаметром бака: и 24 л (Ø 325) висит, не задевая краны и линию обратки.
    for (const volume of [6, 8, 10, 12, 18, 24]) {
      const built = boilerPipework(BOILER, { builtIn: { pump: true, expansionTank: false, safetyGroup: false }, tankVolume: volume, run });
      const assembly = new Assembly(registry, built.definition);
      const tank = box(assembly.parts.find(({ name }) => name === 'бак')!).expandByScalar(-TOUCH);
      const near = new Set(['бак', 'угольник бака', 'переходник бака у угольника']);
      const hit = assembly.parts.filter((part) => !near.has(part.name) && box(part).expandByScalar(-TOUCH).intersectsBox(tank));
      expect(hit.map(({ name }) => `${volume} л × ${name}`)).toEqual([]);
      assembly.dispose();
    }
  });

  it('котёл не с патрубками снизу или не 3/4 — ошибка с причиной', () => {
    const builtIn = { pump: true, expansionTank: true, safetyGroup: true };
    for (const connection of ['back', 'top-bottom', 'left-right']) {
      expect(() => boilerPipework({ ...BOILER, params: { ...BOILER.params, connection } }, { builtIn })).toThrow(/только у котла с патрубками снизу/);
    }
    expect(() => boilerPipework({ ...BOILER, params: { ...BOILER.params, nominal: '1' } }, { builtIn })).toThrow(/только под патрубки 3\/4/);
  });

  it('узел каталога «Котёл с обвязкой» — по исполнению, выносы — сгонами каталога', () => {
    expect(BOILER_UNIT.version).toBe(2);
    expect(BOILER_UNIT.variants!.map(({ key }) => key)).toEqual(['built-in', 'pump', 'none']);
    const counts = BOILER_UNIT.variants!.map(({ key }) => BOILER_UNIT.build(key).parts.length);
    expect(counts[0]).toBeLessThan(counts[1]);
    expect(counts[1]).toBeLessThan(counts[2]);
    const nipples = BOILER_UNIT.build('none').parts.filter(({ generatorId }) => generatorId === 'steel.running-nipple');
    expect(nipples.map(({ name, params }) => [name, (params as { length: number }).length])).toEqual([['сгон группы безопасности', 0.2], ['сгон бака', 0.15]]);
    expect(() => BOILER_UNIT.build('wall')).toThrow(/Нет исполнения/);
  });
});
