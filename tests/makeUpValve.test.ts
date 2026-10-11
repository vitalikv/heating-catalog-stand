import { describe, expect, it } from 'vitest';
import { ConnectorMating, GeneratorRegistry } from '../src/lib/index';
import type { Connector, GeneratedModel } from '../src/lib/index';

const registry = new GeneratorRegistry();
const generator = registry.get('valve.make-up');
const port = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;

describe('клапан подпиточный valve.make-up (позиция 113, VALTEC VT.515)', () => {
  it.each([['1/2', 0.097, 0.038, 0.072], ['3/4', 0.1, 0.041, 0.076]] as const)('%s: A, B, D по чертежу', (nominal, a, b, dTop) => {
    const model = generator.build({ nominal });
    expect(port(model, 'outlet').position.x - port(model, 'inlet').position.x).toBeCloseTo(a, 12);
    // Редуктор, фильтр и манометр не выходят за длину A.
    expect(model.bounds.max.x - model.bounds.min.x).toBeCloseTo(a, 6);
    expect(model.bounds.max.y).toBeCloseTo(dTop, 6);
    // Низ пробки фильтра — B под осью; шестигранная пробка повёрнута, допуск 2 мм.
    expect(Math.abs(model.bounds.min.y + b)).toBeLessThan(0.002);
    model.dispose();
  });

  it('муфтовые концы: вход слева, выход справа, внутренняя резьба; манометр — циферблат manometer', () => {
    const model = generator.build({ nominal: '1/2' });
    expect(port(model, 'inlet')).toMatchObject({ nominal: '1/2', joint: 'thread', gender: 'internal', direction: { x: -1, y: 0, z: 0 } });
    expect(port(model, 'outlet')).toMatchObject({ nominal: '1/2', gender: 'internal', direction: { x: 1, y: 0, z: 0 } });
    expect(model.materials).toEqual(expect.arrayContaining(['metal', 'metalFlat', 'thread', 'manometer']));
    expect(model.title).toBe('Клапан подпиточный 1/2(в) с фильтром и манометром (VT.515)');
    const nipple = registry.get('steel.nipple').build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 });
    expect(ConnectorMating.check(port(model, 'outlet'), nipple.connectors[0])).toMatchObject({ compatible: true });
    model.dispose(); nipple.dispose();
  });
});
