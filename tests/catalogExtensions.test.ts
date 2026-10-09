import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ConnectorMating, GeneratorParamsError, GeneratorRegistry } from '../src/lib/index';
import type { Connector, GeneratedModel } from '../src/lib/index';
import { EXTENSION_CATALOG } from '../src/lib/catalog/extensions';

const registry = new GeneratorRegistry();
const port = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;

describe('новые модели вне gl2', () => {
  it('все восемь семейств доступны в каталоге', () => {
    expect(EXTENSION_CATALOG.map((entry) => entry.generatorId).sort()).toEqual([
      'steel.bushing', 'steel.cap', 'steel.union', 'valve.check', 'valve.drain',
      'valve.lockshield', 'valve.radiator-h-block', 'valve.thermostatic-angle',
    ]);
  });

  it('обратный клапан: торцы ±length/2, поток меняет стрелку без изменения портов', () => {
    const generator = registry.get('valve.check');
    const model = generator.build(generator.defaults);
    const reversed = generator.build({ ...generator.defaults, flow: 'right-to-left' });
    expect(port(model, 'left').position).toEqual({ x: -0.0275, y: 0, z: 0 });
    expect(port(model, 'right').position).toEqual({ x: 0.0275, y: 0, z: 0 });
    expect(port(model, 'left').depth).toBeCloseTo(0.00852, 9);
    expect(reversed.connectors).toEqual(model.connectors);
    expect(Array.from(reversed.geometry.getAttribute('position').array)).not.toEqual(Array.from(model.geometry.getAttribute('position').array));
    expect(reversed.title).toContain('←');
    model.dispose(); reversed.dispose();
  });

  it.each(['steel.union', 'valve.lockshield'] as const)('%s: прямое и угловое исполнение сохраняют ID и номиналы', (id) => {
    const generator = registry.get(id);
    const straight = generator.build({ ...generator.defaults, configuration: 'straight' });
    const angle = generator.build({ ...generator.defaults, configuration: 'angle' });
    expect(straight.connectors.map((c) => c.id)).toEqual(angle.connectors.map((c) => c.id));
    expect(port(straight, 'inlet').direction).toEqual({ x: -1, y: 0, z: 0 });
    expect(port(angle, 'inlet').direction).toEqual({ x: 0, y: -1, z: 0 });
    expect(port(angle, 'inlet').position.y).toBe(-generator.defaults.armLength);
    expect(straight.connectors[1].position.x).toBe(generator.defaults.armLength);
    expect(angle.connectors[1].gender).toBe('external');
    straight.dispose(); angle.dispose();
  });

  it('термоклапан: головка не меняет подключения, полусгон стыкуется с радиатором', () => {
    const generator = registry.get('valve.thermostatic-angle');
    const valve = generator.build(generator.defaults);
    const cap = generator.build({ ...generator.defaults, head: 'cap' });
    expect(cap.connectors).toEqual(valve.connectors);
    expect(valve.bounds.max.y).toBeGreaterThan(cap.bounds.max.y);
    const radiatorGenerator = registry.get('radiator.steel');
    const radiator = radiatorGenerator.build(radiatorGenerator.defaults);
    const fixed = port(radiator, 'top-right');
    const moving = port(valve, 'radiator');
    expect(ConnectorMating.check(fixed, moving).compatible).toBe(true);
    const matrix = ConnectorMating.place(fixed, new Matrix4(), moving);
    const expected = new Vector3().copy(fixed.position).addScaledVector(new Vector3().copy(fixed.direction), -Math.min(fixed.depth, moving.depth));
    expect(new Vector3().copy(moving.position).applyMatrix4(matrix).distanceTo(expected)).toBeLessThan(1e-9);
    valve.dispose(); cap.dispose(); radiator.dispose();
  });

  it.each(['straight', 'angle'] as const)('H-блок %s: четыре порта, межосевое расстояние и разные типы соединений', (configuration) => {
    const generator = registry.get('valve.radiator-h-block');
    const model = generator.build({ ...generator.defaults, spacing: 0.06, configuration });
    expect(model.connectors).toHaveLength(4);
    expect(port(model, 'radiator-right').position.x - port(model, 'radiator-left').position.x).toBeCloseTo(0.06, 9);
    expect(port(model, 'pipe-right').position.x - port(model, 'pipe-left').position.x).toBeCloseTo(0.06, 9);
    expect(port(model, 'radiator-left').direction).toEqual({ x: 0, y: 1, z: 0 });
    expect(port(model, 'pipe-left').direction).toEqual(configuration === 'straight' ? { x: 0, y: -1, z: 0 } : { x: 0, y: 0, z: -1 });
    const pipe = port(model, 'pipe-left');
    expect(pipe.joint).toBe('eurocone');
    expect(ConnectorMating.check(pipe, { ...pipe, joint: 'thread', gender: 'internal' })).toMatchObject({ compatible: false, reason: 'joint' });
    model.dispose();
  });

  it('футорка: больший наружный и меньший внутренний порт, ошибочная пара отклоняется', () => {
    const generator = registry.get('steel.bushing');
    const model = generator.build(generator.defaults);
    expect(port(model, 'left')).toMatchObject({ nominal: '3/4', gender: 'external' });
    expect(port(model, 'right')).toMatchObject({ nominal: '1/2', gender: 'internal' });
    for (const innerNominal of ['3/4', '1']) {
      const params = { ...generator.defaults, innerNominal };
      expect(generator.validate(params)).toContainEqual(expect.objectContaining({ code: 'wall_too_thin', param: 'innerNominal' }));
      expect(() => generator.build(params)).toThrow(GeneratorParamsError);
    }
    model.dispose();
  });

  it('заглушка: один внутренний порт и глухое дно толщиной 3 мм', () => {
    const generator = registry.get('steel.cap');
    const model = generator.build(generator.defaults);
    expect(model.connectors).toHaveLength(1);
    expect(model.connectors[0]).toMatchObject({ id: 'left', gender: 'internal', position: { x: -0.011, y: 0, z: 0 } });
    // Внутренняя грань глухого дна содержит центр диска при x = length/2 − 3 мм.
    const positions = model.geometry.getAttribute('position');
    const normals = model.geometry.getAttribute('normal');
    let backFace = false;
    for (let i = 0; i < positions.count; i++) {
      if (Math.abs(positions.getX(i) - 0.008) < 1e-6 && Math.abs(normals.getX(i)) > 0.99) backFace = true;
    }
    expect(backFace).toBe(true);
    model.dispose();
  });

  it('сливной кран: ёлочка не совместима с резьбой или прессом того же числового номинала', () => {
    const generator = registry.get('valve.drain');
    const model = generator.build({ ...generator.defaults, hoseNominal: '20' });
    const hose = port(model, 'hose');
    expect(hose).toMatchObject({ nominal: '20', joint: 'hose-barb', depth: 0.024, position: { x: 0.03, y: 0, z: 0 } });
    for (const joint of ['thread', 'mp-press', 'pp-socket'] as const) {
      expect(ConnectorMating.check(hose, { ...hose, gender: 'internal', joint })).toMatchObject({ compatible: false, reason: 'joint' });
    }
    model.dispose();
  });

  it.each(EXTENSION_CATALOG)('$generatorId: заведомо короткая модель отклоняется до построения', ({ generatorId }) => {
    const generator = registry.get(generatorId as string)!;
    const defaults = generator.defaults as Record<string, unknown>;
    const key = 'length' in defaults ? 'length' : 'armLength' in defaults ? 'armLength' : 'height';
    const params = { ...defaults, [key]: 0.001 };
    expect(generator.validate(params).length).toBeGreaterThan(0);
    expect(() => generator.build(params)).toThrow(GeneratorParamsError);
  });
});
