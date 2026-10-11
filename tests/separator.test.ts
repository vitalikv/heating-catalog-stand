import { describe, expect, it } from 'vitest';
import { ConnectorMating, GeneratorRegistry } from '../src/lib/index';
import type { Connector, GeneratedModel, SeparatorParams } from '../src/lib/index';

const registry = new GeneratorRegistry();
const generator = registry.get('equipment.separator');
const port = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;
const build = (params: Partial<SeparatorParams>) => generator.build({ ...generator.defaults, ...params });

describe('отделитель equipment.separator (позиции 77, 78, 122)', () => {
  it.each(['magnetic', 'air', 'combined'] as const)('%s: проход по X, слив 1/2 внизу', (kind) => {
    const model = build({ kind, nominal: '1' });
    expect(model.connectors.map((c) => c.id)).toEqual(['left', 'right', 'drain']);
    expect(port(model, 'right').position.x - port(model, 'left').position.x).toBeCloseTo(0.11, 12);
    expect(port(model, 'left')).toMatchObject({ nominal: '1', joint: 'thread', gender: 'internal' });
    expect(port(model, 'drain')).toMatchObject({ nominal: '1/2', gender: 'internal', direction: { x: 0, y: -1, z: 0 } });
    expect(port(model, 'drain').position.y).toBeCloseTo(model.bounds.min.y, 6);
    model.dispose();
  });

  it('грязеуловитель — глубокий отстойник с магнитом; сепаратор — воздухоотводчик сверху; комбинированный — оба', () => {
    const magnetic = build({ kind: 'magnetic' });
    const air = build({ kind: 'air' });
    const combined = build({ kind: 'combined' });
    expect(magnetic.bounds.min.y).toBeLessThan(air.bounds.min.y);
    expect(combined.bounds.min.y).toBeCloseTo(magnetic.bounds.min.y, 9);
    expect(air.bounds.max.y).toBeGreaterThan(magnetic.bounds.max.y);
    expect(combined.bounds.max.y).toBeCloseTo(air.bounds.max.y, 9);
    expect(magnetic.title).toBe('Грязеуловитель магнитный 3/4(в-в)');
    magnetic.dispose(); air.dispose(); combined.dispose();
  });

  it('накидные гайки удлиняют прибор, порты остаются внутренней резьбой', () => {
    const plain = build({ ends: 'internal' });
    const union = build({ ends: 'union' });
    expect(port(union, 'right').position.x - port(plain, 'right').position.x).toBeCloseTo(0.018, 12);
    expect(port(union, 'left').gender).toBe('internal');
    expect(union.title).toBe('Грязеуловитель магнитный 3/4, накидные гайки');
    plain.dispose(); union.dispose();
  });

  it('латунный корпус: резьба и грани в цвет корпуса', () => {
    const model = build({ kind: 'combined', ends: 'union' });
    expect(model.materials).toEqual(expect.arrayContaining(['bronze', 'bronzeFlat', 'bronzeThread']));
    expect(model.materials).not.toContain('thread');
    expect(model.materials).not.toContain('metalFlat');
    model.dispose();
  });

  it('к сливу подходит сливной кран, к проходу — ниппель своего номинала', () => {
    const model = build({ nominal: '1' });
    const drain = registry.get('valve.drain').build({ nominal: '1/2', hoseNominal: '16', length: 0.06 });
    const nipple = registry.get('steel.nipple').build({ nominalLeft: '1', nominalRight: '1', length: 0.04 });
    expect(ConnectorMating.check(port(model, 'drain'), port(drain, 'inlet'))).toMatchObject({ compatible: true });
    expect(ConnectorMating.check(port(model, 'left'), port(nipple, 'right'))).toMatchObject({ compatible: true });
    expect(ConnectorMating.check(port(model, 'drain'), port(nipple, 'right'))).toMatchObject({ compatible: false, reason: 'nominal' });
    model.dispose(); drain.dispose(); nipple.dispose();
  });
});
