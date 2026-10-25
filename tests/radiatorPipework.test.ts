import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Assembly } from '../src/lib/assembly/Assembly';
import { radiatorPipework, type RadiatorPipeworkOptions, type RadiatorPipeworkRadiator } from '../src/lib/assembly/recipes/radiatorPipework';
import { GeneratorRegistry } from '../src/lib/generators/GeneratorRegistry';

const registry = new GeneratorRegistry();

const RADIATORS: readonly [string, RadiatorPipeworkRadiator][] = [
  ['стальной 1400 × 300', { generatorId: 'radiator.steel', params: { dimensions: { x: 1.4, y: 0.3, z: 0.07 }, nominal: '1/2' } }],
  ['стальной 600 × 900', { generatorId: 'radiator.steel', params: { dimensions: { x: 0.6, y: 0.9, z: 0.07 }, nominal: '1/2' } }],
  ['алюминиевый 8 секций h500', { generatorId: 'radiator.aluminium', params: { sections: 8, dimensions: { x: 0.08, y: 0.5, z: 0.08 }, nominal: '1' } }],
];

const BASE: RadiatorPipeworkOptions = {
  connection: 'side', side: 'left', valves: 'angle', supply: 'thermostatic', return: 'lockshield', pipe: { system: 'mp', nominal: '16' },
};

/** Все сочетания, которые узел поддерживает. */
function combinations(): RadiatorPipeworkOptions[] {
  const list: RadiatorPipeworkOptions[] = [];
  for (const side of ['left', 'right'] as const) {
    for (const connection of ['side', 'diagonal'] as const) {
      for (const valves of ['angle', 'straight'] as const) {
        for (const [supply, back] of [['thermostatic', 'lockshield'], ['ball', 'ball'], ['none', 'none']] as const) {
          for (const pipe of [{ system: 'mp', nominal: '16' }, { system: 'mp', nominal: '20' }, { system: 'pp', nominal: '20' }, { system: 'pp', nominal: '25' }] as const) {
            list.push({ connection, side, valves, supply, return: back, pipe });
          }
        }
      }
    }
    for (const connection of ['bottom', 'injector'] as const) {
      for (const nominal of ['16', '20']) {
        for (const [supply, back] of [['thermostatic', 'lockshield'], ['ball', 'ball']] as const) {
          list.push({ ...BASE, connection, side, supply, return: back, pipe: { system: 'mp', nominal } });
        }
      }
    }
  }
  return list;
}

const cases = RADIATORS.flatMap(([title, radiator]) => combinations().map((options) => [
  `${title}: ${options.connection} ${options.side}, ${options.valves}, ${options.supply}/${options.return}, ${options.pipe.system} ${options.pipe.nominal}`,
  radiator,
  options,
] as const));

/** Направление разъёма детали узла в координатах узла (корень — радиатор). */
function direction(assembly: Assembly, part: string, connector: string): Vector3 {
  const placed = assembly.parts.find((item) => item.name === part)!;
  const port = placed.model.connectors.find((item) => item.id === connector)!;
  return new Vector3().copy(port.direction).transformDirection(placed.matrix);
}

describe('обвязка радиатора', () => {
  it.each(cases)('%s', (_, radiator, options) => {
    const { definition, supply, return: back } = radiatorPipework(radiator, options);
    expect(definition.parts[0].name).toBe('радиатор');
    const names = definition.parts.map((part) => part.name);
    expect(new Set(names).size).toBe(names.length);

    const assembly = new Assembly(registry, definition);
    try {
      expect(assembly.errors).toEqual([]);
      expect(assembly.joints.filter(({ check }) => !check.compatible).map(({ label }) => label)).toEqual([]);
      expect(assembly.closures.filter(({ closed }) => !closed).map(({ label }) => label)).toEqual([]);

      // Каждое отверстие радиатора занято: обвязкой, воздухоотводчиком или заглушкой.
      const used = new Set<string>();
      for (const part of definition.parts) {
        if (!part.attach) continue;
        used.add(`${part.name}.${part.attach.connector}`);
        used.add(`${part.attach.to}.${part.attach.toConnector}`);
      }
      for (const closure of definition.closures ?? []) {
        used.add(`${closure.part}.${closure.connector}`);
        used.add(`${closure.to}.${closure.toConnector}`);
      }
      const radiatorPorts = assembly.parts[0].model.connectors.map(({ id }) => id);
      expect(radiatorPorts.filter((id) => !used.has(`радиатор.${id}`))).toEqual([]);

      // Разъёмы под трубу свободны и подходят трубе выбранной системы.
      for (const end of [supply, back]) {
        expect(used.has(`${end.part}.${end.connector}`)).toBe(false);
        const placed = assembly.parts.find((item) => item.name === end.part)!;
        const port = placed.model.connectors.find((item) => item.id === end.connector)!;
        expect(port.nominal).toBe(options.pipe.nominal);
        expect(port.joint.startsWith(options.pipe.system === 'mp' ? 'mp-' : 'pp-')).toBe(true);
      }

      // Угловые клапаны, нижнее и инжекторное — трубы снизу; прямые — вбок, от радиатора.
      const down = options.valves === 'angle' || options.connection === 'bottom' || options.connection === 'injector';
      for (const [end, side] of [[supply, options.side], [back, options.connection === 'diagonal' ? (options.side === 'left' ? 'right' : 'left') : options.side]] as const) {
        const dir = direction(assembly, end.part, end.connector);
        if (down && (options.supply !== 'none' || options.connection === 'bottom' || options.connection === 'injector')) {
          expect(dir.y).toBeCloseTo(-1, 6);
        } else {
          expect(dir.x).toBeCloseTo(side === 'left' ? -1 : 1, 6);
        }
      }
    } finally {
      assembly.dispose();
    }

    // Узел держится соединениями: каждая деталь связана с радиатором цепочкой стыков.
    const linked = new Set(['радиатор']);
    for (let grew = true; grew;) {
      grew = false;
      for (const part of definition.parts) {
        if (part.attach && linked.has(part.attach.to) && !linked.has(part.name)) {
          linked.add(part.name);
          grew = true;
        }
      }
    }
    expect(names.filter((name) => !linked.has(name))).toEqual([]);
  });

  it('нижнее и инжекторное с ПП и чужой номинал — ошибка с причиной', () => {
    const [, steel] = RADIATORS[0];
    expect(() => radiatorPipework(steel, { ...BASE, connection: 'bottom', pipe: { system: 'pp', nominal: '20' } })).toThrow(/только МП/);
    expect(() => radiatorPipework(steel, { ...BASE, connection: 'injector', pipe: { system: 'pp', nominal: '20' } })).toThrow(/только МП/);
    expect(() => radiatorPipework(steel, { ...BASE, pipe: { system: 'mp', nominal: '32' } })).toThrow(/нет трубы МП 32/);
  });

  it('нижнее подключение переводит радиатор на нижнюю пару с той стороны', () => {
    const [, aluminium] = RADIATORS[2];
    const { definition } = radiatorPipework(aluminium, { ...BASE, connection: 'bottom', side: 'right' });
    expect(definition.parts[0].params).toMatchObject({ connection: 'bottom', bottomSide: 'right', bottomNominal: '1/2', sections: 8 });
    const side = radiatorPipework(aluminium, BASE).definition.parts[0].params;
    expect(side).toMatchObject({ connection: 'side' });
  });
});
