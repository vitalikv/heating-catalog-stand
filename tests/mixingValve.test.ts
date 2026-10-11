import { describe, expect, it } from 'vitest';
import { ConnectorMating, GeneratorRegistry } from '../src/lib/index';
import type { Connector, GeneratedModel } from '../src/lib/index';

const registry = new GeneratorRegistry();
const generator = registry.get('valve.mixing');
const port = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;

describe('смесительный клапан valve.mixing (позиции 46–47, по VALTEC VT.MIX03/04)', () => {
  it.each([['3/4', 0.076], ['1', 0.076], ['1 1/4', 0.082]] as const)('%s: все ходы на A/2 от оси штока, A = %s м', (nominal, length) => {
    const model = generator.build({ ways: 4, nominal, control: 'none' });
    expect(port(model, 'right').position.x - port(model, 'left').position.x).toBeCloseTo(length, 12);
    expect(port(model, 'top').position.y - port(model, 'bottom').position.y).toBeCloseTo(length, 12);
    expect(model.bounds.max.x - model.bounds.min.x).toBeCloseTo(length, 6);
    for (const c of model.connectors) expect(c).toMatchObject({ nominal, joint: 'thread', gender: 'internal' });
    model.dispose();
  });

  it('3-ходовой: слева, справа и сверху; 4-ходовой — ещё снизу', () => {
    const three = generator.build({ ways: 3, nominal: '1', control: 'handle' });
    const four = generator.build({ ways: 4, nominal: '1', control: 'handle' });
    expect(three.connectors.map((c) => c.id)).toEqual(['left', 'right', 'top']);
    expect(four.connectors.map((c) => c.id)).toEqual(['left', 'right', 'top', 'bottom']);
    expect(port(three, 'top').direction).toEqual({ x: 0, y: 1, z: 0 });
    expect(port(four, 'bottom').direction).toEqual({ x: 0, y: -1, z: 0 });
    expect(three.title).toBe('Клапан 3-ходовой смесительный 1(в) VT.MIX03, рукоятка');
    three.dispose(); four.dispose();
  });

  it('D: от тыльной стороны до монтажной плоскости 44 мм, шпилька выступает на E = 6 мм', () => {
    const model = generator.build({ ways: 3, nominal: '1', control: 'none' });
    // Без рукоятки выше монтажной плоскости — шток (12 мм) и шпилька (6 мм): верх габарита — шток.
    expect(model.bounds.max.z - model.bounds.min.z).toBeCloseTo(0.044 + 0.012, 6);
    const handle = generator.build({ ways: 3, nominal: '1', control: 'handle' });
    expect(handle.connectors).toEqual(model.connectors);
    expect(handle.bounds.max.z).toBeCloseTo(model.bounds.max.z, 6);
    expect(handle.bounds.max.x).toBeCloseTo(model.bounds.max.x, 6);
    model.dispose(); handle.dispose();
  });

  it('латунный корпус: резьба и грани в цвет корпуса, рукоятка чёрная', () => {
    const model = generator.build({ ways: 3, nominal: '3/4', control: 'handle' });
    expect(model.materials).toEqual(expect.arrayContaining(['bronze', 'bronzeFlat', 'bronzeThread', 'black']));
    expect(model.materials).not.toContain('thread');
    expect(model.materials).not.toContain('metalFlat');
    model.dispose();
  });

  it('ходы стыкуются с ниппелем своего номинала, с другим номиналом — нет', () => {
    const valve = generator.build({ ways: 3, nominal: '1', control: 'handle' });
    const nipple = registry.get('steel.nipple').build({ nominalLeft: '1', nominalRight: '1', length: 0.04 });
    const small = registry.get('steel.nipple').build({ nominalLeft: '3/4', nominalRight: '3/4', length: 0.04 });
    for (const id of ['left', 'right', 'top']) expect(ConnectorMating.check(port(valve, id), port(nipple, 'left'))).toMatchObject({ compatible: true });
    expect(ConnectorMating.check(port(valve, 'left'), port(small, 'left'))).toMatchObject({ compatible: false, reason: 'nominal' });
    valve.dispose(); nipple.dispose(); small.dispose();
  });

  it('неизвестные номинал и число ходов отклоняются', () => {
    const codes = (params: unknown) => generator.validate(params as Parameters<typeof generator.validate>[0]).map((e) => `${e.code}:${e.param}`);
    expect(codes({ ...generator.defaults, nominal: '1/2' })).toEqual(['unknown_option:nominal']);
    expect(codes({ ...generator.defaults, ways: 2 })).toEqual(['unknown_option:ways']);
  });
});
