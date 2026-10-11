import { describe, expect, it } from 'vitest';
import { ConnectorMating, GeneratorRegistry } from '../src/lib/index';
import type { AirVentExecution, Connector, GeneratedModel } from '../src/lib/index';

const registry = new GeneratorRegistry();
const vent = registry.get('equipment.air-vent');
const shutoff = registry.get('valve.vent-shutoff');
const port = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;

describe('автоматический воздухоотводчик equipment.air-vent (позиция 109, VALTEC VT.502)', () => {
  it('NH по чертежу: высота 57 мм от торца резьбы, колба Ø40, боковой выпуск на 32,5 мм от оси', () => {
    const model = vent.build({ execution: 'NH' });
    expect(port(model, 'inlet')).toMatchObject({ nominal: '1/2', joint: 'thread', gender: 'external', position: { x: 0, y: 0, z: 0 },
      direction: { x: 0, y: -1, z: 0 } });
    expect(port(model, 'inlet').depth).toBeCloseTo(0.0105, 12);
    expect(model.bounds.max.y - model.bounds.min.y).toBeCloseTo(0.057, 6);
    expect(model.bounds.max.x).toBeCloseTo(0.0325, 6);
    expect(model.bounds.min.x).toBeCloseTo(-0.02, 6);
    model.dispose();
  });

  it('NV: выпуск сверху выше корпуса, сбоку ничего не выступает', () => {
    const model = vent.build({ execution: 'NV' });
    expect(model.bounds.max.y).toBeGreaterThan(0.057);
    expect(model.bounds.max.x).toBeCloseTo(0.02, 6);
    model.dispose();
  });

  it('NA: вход сбоку, колба вертикально, выпуск сверху', () => {
    const model = vent.build({ execution: 'NA' });
    const inlet = port(model, 'inlet');
    expect(inlet.direction).toEqual({ x: -1, y: 0, z: 0 });
    expect(inlet.position.x).toBeCloseTo(model.bounds.min.x, 6);
    expect(model.bounds.max.y).toBeGreaterThan(-model.bounds.min.y);
    model.dispose();
  });

  it.each(['NH', 'NV', 'NA'] as AirVentExecution[])('%s: никелированная латунь — серебристая резьба и грани', (execution) => {
    const model = vent.build({ execution });
    expect(model.materials).toEqual(expect.arrayContaining(['metal', 'metalFlat', 'thread', 'black']));
    expect(model.materials).not.toContain('bronzeThread');
    expect(model.title).toContain(`VT.502.${execution}`);
    model.dispose();
  });
});

describe('отсекающий клапан valve.vent-shutoff (позиция 110, VALTEC VT.539)', () => {
  it('высота 26 мм: снизу 1/2 Н, сверху 1/2 В под воздухоотводчик', () => {
    const model = shutoff.build({});
    expect(port(model, 'vent').position.y - port(model, 'inlet').position.y).toBeCloseTo(0.026, 12);
    expect(port(model, 'inlet')).toMatchObject({ gender: 'external', nominal: '1/2', direction: { x: 0, y: -1, z: 0 } });
    expect(port(model, 'vent')).toMatchObject({ gender: 'internal', nominal: '1/2', direction: { x: 0, y: 1, z: 0 } });
    // Шестигранник под ключ 23 мм: по граням (X) 23, по углам (Z) 23 / cos 30°.
    expect(model.bounds.max.x - model.bounds.min.x).toBeCloseTo(0.023, 6);
    expect(model.bounds.max.z - model.bounds.min.z).toBeCloseTo(0.023 / Math.cos(Math.PI / 6), 6);
    model.dispose();
  });

  it('цепочка: порт коллектора → клапан → воздухоотводчик', () => {
    const valve = shutoff.build({});
    const air = vent.build({ execution: 'NH' });
    const manifold = registry.get('manifold.brass');
    const collector = manifold.build({ ...manifold.defaults, endPorts: 'vent-drain' });
    expect(ConnectorMating.check(port(collector, 'vent'), port(valve, 'inlet'))).toMatchObject({ compatible: true });
    expect(ConnectorMating.check(port(valve, 'vent'), port(air, 'inlet'))).toMatchObject({ compatible: true });
    valve.dispose(); air.dispose(); collector.dispose();
  });
});
