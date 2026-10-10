import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Assembly, CATALOG, ConnectorMating, GeneratorRegistry } from '../src/lib/index';
import type { BrassManifoldParams, Connector, GeneratedModel } from '../src/lib/index';
import { manifoldReturnNode } from '../src/stand/assemblies';

const registry = new GeneratorRegistry();
const manifold = registry.get('manifold.brass');
const actuator = registry.get('valve.thermoelectric-actuator');
const port = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;
const build = (params: Partial<BrassManifoldParams>) => manifold.build({ ...manifold.defaults, ...params });
const flowmeters = { inserts: 'flowmeter' } as const;
const underActuators = { inserts: 'thermostatic', head: 'none' } as const;

describe('латунный коллектор manifold.brass (102, по VALTEC VTc.594/596EMNX)', () => {
  it.each([
    ['1', 3, 0.212], ['1', 8, 0.462], ['1', 12, 0.662], ['1 1/4', 4, 0.264], ['1 1/4', 12, 0.664],
  ] as const)('%s" × %i: длина A = %f м по таблице VALTEC', (nominal, outlets, a) => {
    const model = build({ nominal, outlets });
    // Разъёмы — точные числа, габарит — по буферу float32.
    expect(port(model, 'end').position.x - port(model, 'main').position.x).toBeCloseTo(a, 9);
    expect(model.bounds.max.x - model.bounds.min.x).toBeCloseTo(a, 6);
    model.dispose();
  });

  it('выходы вниз с шагом 50 мм, первый — в 31 мм от магистрального торца; концевые порты — в 31 мм от дальнего', () => {
    const model = build({ outlets: 5 });
    const main = port(model, 'main').position.x;
    const outs = [1, 2, 3, 4, 5].map((k) => port(model, `out-${k}`));
    expect(outs[0].position.x - main).toBeCloseTo(0.031, 9);
    for (let k = 1; k < 5; k++) expect(outs[k].position.x - outs[k - 1].position.x).toBeCloseTo(0.05, 9);
    for (const out of outs) expect(out.direction).toEqual({ x: 0, y: -1, z: 0 });
    expect(port(model, 'end').position.x - port(model, 'vent').position.x).toBeCloseTo(0.031, 9);
    expect(port(model, 'vent').position.x).toBe(port(model, 'drain').position.x);
    expect(port(model, 'vent').direction).toEqual({ x: 0, y: 1, z: 0 });
    expect(port(model, 'drain').direction).toEqual({ x: 0, y: -1, z: 0 });
    model.dispose();
  });

  it('без концевых портов — короче на шаг, нет vent и drain', () => {
    const model = build({ outlets: 4, endPorts: 'none' });
    expect(port(model, 'end').position.x - port(model, 'main').position.x).toBeCloseTo(0.212, 9);
    expect(model.connectors.map((c) => c.id)).toEqual(['main', 'end', 'out-1', 'out-2', 'out-3', 'out-4']);
    model.dispose();
  });

  it('высоты вставок над осью — I, L, M, N из таблицы VTc.594; для 1 1/4" на 5 мм выше', () => {
    const top = (params: Partial<BrassManifoldParams>) => {
      const model = build(params);
      const y = model.bounds.max.y;
      model.dispose();
      return y;
    };
    expect(top({ inserts: 'shutoff' })).toBeCloseTo(0.0465, 6);
    expect(top({ inserts: 'thermostatic' })).toBeCloseTo(0.0615, 6);
    expect(top(flowmeters)).toBeCloseTo(0.0795, 6);
    expect(top({ ...flowmeters, nominal: '1 1/4', outlets: 4 })).toBeCloseTo(0.0845, 6);
  });

  it('посадочные места head-k — только у термоклапанов без ручки, по одному над каждым выходом', () => {
    const withHandle = build({ inserts: 'thermostatic', head: 'handle', outlets: 4 });
    const bare = build({ ...underActuators, outlets: 4 });
    const flow = build({ ...flowmeters, outlets: 4 });
    expect(withHandle.connectors.some((c) => c.id.startsWith('head-'))).toBe(false);
    expect(flow.connectors.some((c) => c.id.startsWith('head-'))).toBe(false);
    for (let k = 1; k <= 4; k++) {
      const head = port(bare, `head-${k}`);
      expect(head).toMatchObject({ joint: 'valve-head', gender: 'external', nominal: 'M30x1.5', direction: { x: 0, y: 1, z: 0 } });
      expect(head.position.x).toBe(port(bare, `out-${k}`).position.x);
      expect(head.position.y).toBeCloseTo(0.0465, 9);
    }
    withHandle.dispose(); bare.dispose(); flow.dispose();
  });

  it('стыкуется с адаптером евроконуса, ниппелем магистрали, пробкой и сливом; заглушка 3/4 на евроконус — нет', () => {
    const model = build({ outlets: 3 });
    const adapter = registry.get('mp.eurocone-adapter').build({ pipeNominal: '16', euroconeNominal: '3/4', length: 0.026 });
    const nipple = registry.get('steel.nipple').build({ nominalLeft: '1', nominalRight: '1', length: 0.044 });
    const plug = registry.get('steel.plug').build({ nominal: '1/2', length: 0.022 });
    const drain = registry.get('valve.drain').build({ nominal: '1/2', hoseNominal: '16', length: 0.06 });
    const cap = registry.get('steel.cap').build({ nominal: '3/4', length: 0.027 });
    expect(ConnectorMating.check(port(model, 'out-1'), port(adapter, 'eurocone'))).toMatchObject({ compatible: true });
    expect(ConnectorMating.check(port(model, 'out-1'), port(cap, 'left'))).toMatchObject({ compatible: false, reason: 'joint' });
    expect(ConnectorMating.check(port(model, 'main'), port(nipple, 'right'))).toMatchObject({ compatible: true });
    expect(ConnectorMating.check(port(model, 'vent'), port(plug, 'left'))).toMatchObject({ compatible: true });
    expect(ConnectorMating.check(port(model, 'drain'), port(drain, 'inlet'))).toMatchObject({ compatible: true });
    for (const part of [model, adapter, nipple, plug, drain, cap]) part.dispose();
  });

  it('магистральный конец: наружная резьба и накидная гайка выступают за корпус на длину резьбы', () => {
    const internal = build({});
    const external = build({ mainEnd: 'external' });
    const nut = build({ mainEnd: 'nut' });
    expect(port(external, 'main')).toMatchObject({ gender: 'external', nominal: '1' });
    expect(port(nut, 'main')).toMatchObject({ gender: 'internal', nominal: '1' });
    for (const model of [external, nut]) {
      expect(port(internal, 'main').position.x - port(model, 'main').position.x).toBeCloseTo(0.017, 9);
      expect(port(model, 'main').depth).toBeCloseTo(0.017, 9);
    }
    internal.dispose(); external.dispose(); nut.dispose();
  });

  it('расходомеры на резьбовых выходах отклоняются; резьба выходов задаётся только при outletEnd = thread', () => {
    expect(manifold.validate({ ...manifold.defaults, ...flowmeters, outletEnd: 'thread' }).map((e) => e.code)).toEqual(['incompatible']);
    const threaded = build({ outletEnd: 'thread', outletNominal: '3/4' });
    expect(port(threaded, 'out-1')).toMatchObject({ joint: 'thread', gender: 'external', nominal: '3/4' });
    threaded.dispose();
  });

  it('никелированная латунь: корпус metal, резьба thread; расходомер красный', () => {
    const model = build(flowmeters);
    expect(model.materials).toEqual(expect.arrayContaining(['metal', 'metalFlat', 'thread', 'red', 'plasticGrey']));
    expect(model.materials).not.toContain('bronze');
    model.dispose();
  });

  it('наборы 67 и 68 — пары с одинаковым числом выходов для 1" (3–12) и 1 1/4" (4–12)', () => {
    const items = CATALOG.find((entry) => entry.generatorId === 'manifold.brass')!.items as { label: string; params: BrassManifoldParams }[];
    const count = (inserts: string, head: string, nominal: string) => items.filter(({ params: p }) =>
      p.inserts === inserts && p.head === head && p.nominal === nominal && p.outletEnd === 'eurocone').map(({ params: p }) => p.outlets);
    for (const [nominal, outlets] of [['1', [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]], ['1 1/4', [4, 5, 6, 7, 8, 9, 10, 11, 12]]] as const) {
      expect(count('flowmeter', 'handle', nominal)).toEqual(outlets);
      expect(count('thermostatic', 'handle', nominal)).toEqual(outlets);
      expect(count('thermostatic', 'none', nominal)).toEqual(outlets);
    }
  });
});

describe('сервопривод valve.thermoelectric-actuator (69, по VALTEC VT.TE 3040)', () => {
  it('габарит 48,4 × 44,3 мм, высота 52,2 мм и индикатор; разъём — основание, внутренний valve-head', () => {
    const closed = actuator.build({ state: 'closed' });
    const open = actuator.build({ state: 'open' });
    const size = new Vector3().subVectors(new Vector3().copy(closed.bounds.max), new Vector3().copy(closed.bounds.min));
    // Габарит — по буферу float32: допуск 1 мкм.
    expect(size.x).toBeCloseTo(0.0484, 6);
    expect(size.z).toBeCloseTo(0.0443, 6);
    expect(closed.bounds.max.y).toBeCloseTo(0.0527, 6);
    expect(open.bounds.max.y).toBeCloseTo(0.0562, 6);
    expect(port(closed, 'valve')).toMatchObject({ joint: 'valve-head', gender: 'internal', nominal: 'M30x1.5', position: { x: 0, y: 0, z: 0 } });
    closed.dispose(); open.dispose();
  });

  it('садится на посадочное место коллектора; на трубную резьбу и евроконус — нет', () => {
    const model = actuator.build(actuator.defaults);
    const bare = build(underActuators);
    const nipple = registry.get('steel.nipple').build({ nominalLeft: '1', nominalRight: '1', length: 0.044 });
    expect(ConnectorMating.check(port(model, 'valve'), port(bare, 'head-1'))).toEqual({ compatible: true, engagement: 0.01 });
    expect(ConnectorMating.check(port(model, 'valve'), port(nipple, 'left'))).toMatchObject({ compatible: false, reason: 'joint' });
    expect(ConnectorMating.check(port(model, 'valve'), port(bare, 'out-1'))).toMatchObject({ compatible: false, reason: 'joint' });
    model.dispose(); bare.dispose(); nipple.dispose();
  });
});

describe('сборка обратного коллектора с приводами и концевым узлом (68, 69, 70)', () => {
  it('приводы стоят над выходами: основание на 10 мм ниже верха посадочного места, соседние не пересекаются', () => {
    const assembly = new Assembly(registry, manifoldReturnNode(4));
    expect(assembly.errors).toEqual([]);
    expect(assembly.joints.every(({ check }) => check.compatible)).toBe(true);
    const body = assembly.parts.find((part) => part.name === 'коллектор')!;
    const boxes = [1, 2, 3, 4].map((k) => {
      const part = assembly.parts.find((placed) => placed.name === `привод ${k}`)!;
      const base = new Vector3().setFromMatrixPosition(part.matrix);
      const head = port(body.model, `head-${k}`).position;
      expect(base.x).toBeCloseTo(head.x, 9);
      expect(base.y).toBeCloseTo(0.0465 - 0.01, 9);
      const min = new Vector3().copy(part.model.bounds.min).applyMatrix4(part.matrix);
      const max = new Vector3().copy(part.model.bounds.max).applyMatrix4(part.matrix);
      return { min: Math.min(min.x, max.x), max: Math.max(min.x, max.x) };
    });
    for (let k = 1; k < 4; k++) expect(boxes[k].min).toBeGreaterThan(boxes[k - 1].max);
    assembly.dispose();
  });
});
