import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ConnectorMating, GeneratorRegistry } from '../src/lib/index';
import type { Connector, GeneratedModel, GeneratorId } from '../src/lib/index';
import { boundsBox } from './modelHelpers';

// Часть 23: латунная резьба и КИП.
const registry = new GeneratorRegistry();
const port = (model: GeneratedModel, id: string): Connector => {
  const found = model.connectors.find((c) => c.id === id);
  if (!found) throw new Error(`нет порта ${id}`);
  return found;
};
const build = (id: GeneratorId, params: object = {}) => {
  const generator = registry.get(id);
  return generator.build({ ...(generator.defaults as object), ...params } as never);
};
const codes = (id: GeneratorId, params: object) => {
  const generator = registry.get(id);
  return generator.validate({ ...(generator.defaults as object), ...params } as never).map(({ code, param }) => `${code}:${param}`);
};
const positions = (model: GeneratedModel) => Array.from(model.geometry.getAttribute('position').array);

describe('кран с полусгоном valve.ball-union, версия 2 (позиции 133, 95)', () => {
  const gl2 = { nominal: '1/2', unionNominal: '3/4', length: 0.055, unionLength: 0.026, handleLength: 0.053 };

  it('параметры версии 1 и явные умолчания — прежний кран VT.227', () => {
    const generator = registry.get('valve.ball-union');
    const old = generator.build(gl2 as never);
    const explicit = build('valve.ball-union', { ...gl2, valveEnd: 'internal', configuration: 'straight' });
    expect(positions(explicit)).toEqual(positions(old));
    expect(explicit.connectors).toEqual(old.connectors);
    expect(explicit.title).toBe(old.title);
    old.dispose(); explicit.dispose();
  });

  it.each([['1/2', '3/4', 0.0633, 0.026, 0.083], ['3/4', '1', 0.0648, 0.03, 0.09]] as const)(
    '133: VT.226 %s — слева наружная резьба, общая длина В по каталогу', (nominal, unionNominal, length, unionLength, b) => {
      const model = build('valve.ball-union', { nominal, unionNominal, length, unionLength, valveEnd: 'external' });
      const internal = build('valve.ball-union', { nominal, unionNominal, length, unionLength });
      expect(port(model, 'left')).toMatchObject({ gender: 'external', nominal, joint: 'thread', direction: { x: -1, y: 0, z: 0 } });
      expect(port(model, 'left').position.x).toBeCloseTo(-length / 2, 9);
      // Правая сторона и сгон не меняются.
      expect(port(model, 'right')).toEqual(port(internal, 'right'));
      expect(port(model, 'right').position.x - port(model, 'left').position.x).toBeCloseTo(b, 3);
      expect(model.title).toBe(`Шаровой кран с полусгоном ${nominal} (н)`);
      // Наружный конец крана стыкуется с муфтой.
      const coupling = build('steel.coupling', { nominalLeft: nominal, nominalRight: nominal, length: 0.03 });
      expect(ConnectorMating.check(port(model, 'left'), port(coupling, 'right')).compatible).toBe(true);
      model.dispose(); internal.dispose(); coupling.dispose();
    });

  it.each([['1/2', '3/4', 0.0664, 0.026, 0.031, 0.071], ['3/4', '1', 0.0797, 0.03, 0.0355, 0.086], ['1', '1 1/4', 0.0892, 0.037, 0.042, 0.102]] as const)(
    '95: VT.228 %s угловой — вход вниз на Г, габарит В от стенки корпуса до конца сгона', (nominal, unionNominal, length, unionLength, g, b) => {
      const model = build('valve.ball-union', { nominal, unionNominal, length, unionLength, configuration: 'angle', inletLength: g });
      const left = port(model, 'left');
      expect(left).toMatchObject({ gender: 'internal', nominal, direction: { x: 0, y: -1, z: 0 } });
      expect(left.position).toEqual({ x: 0, y: -g, z: 0 });
      expect(model.bounds.min.y).toBeCloseTo(-g, 6);
      // В — от левой стенки корпуса шара (Ø n + 15 мм) до конца сгона; габарит по X шире из-за ручки-бабочки.
      const body = ({ '1/2': 0.0213, '3/4': 0.0268, '1': 0.0335 }[nominal] + 0.015) / 2;
      expect(port(model, 'right').position.x + body).toBeCloseTo(b, 3);
      expect(port(model, 'right').direction).toEqual({ x: 1, y: 0, z: 0 });
      expect(model.title).toBe(`Шаровой кран угловой с полусгоном ${nominal}`);
      model.dispose();
    });

  it('ошибки: угловой только с внутренней резьбой, короткий вход', () => {
    expect(codes('valve.ball-union', { configuration: 'angle', valveEnd: 'external' })).toEqual(['incompatible:valveEnd']);
    // 1/2: резьба 12 мм + радиус корпуса 18,15 мм.
    expect(codes('valve.ball-union', { configuration: 'angle', inletLength: 0.03 })).toEqual(['too_short:inletLength']);
    expect(codes('valve.ball-union', { configuration: 'angle', inletLength: 0.0305 })).toEqual([]);
    expect(codes('valve.ball-union', { configuration: 'straight', inletLength: 0.001 })).toEqual([]);
  });
});

describe('угольник под евроконус steel.eurocone-elbow (позиция 87, VTr.092.NE)', () => {
  it('накидная гайка слева, наружный евроконус вниз; плечи до торцов', () => {
    const model = build('steel.eurocone-elbow');
    expect(port(model, 'inlet')).toMatchObject({ joint: 'eurocone', gender: 'internal', nominal: '3/4', position: { x: -0.028, y: 0, z: 0 } });
    expect(port(model, 'outlet')).toMatchObject({ joint: 'eurocone', gender: 'external', nominal: '3/4', position: { x: 0, y: -0.028, z: 0 } });
    const size = boundsBox(model.bounds).getSize(new Vector3());
    expect(model.bounds.min.x).toBeCloseTo(-0.028, 6);
    expect(model.bounds.min.y).toBeCloseTo(-0.028, 6);
    expect(size.z).toBeGreaterThan(0.0268);
    model.dispose();
  });

  it('встаёт на выход евроконуса коллектора, на выход — адаптер МП; резьба 3/4 — нет', () => {
    const elbow = build('steel.eurocone-elbow');
    const manifold = build('manifold.brass', { outlets: 3, nominal: '1', outletEnd: 'eurocone', outletNominal: '1/2', mainEnd: 'internal', endPorts: 'none', inserts: 'none' });
    const adapter = build('mp.eurocone-adapter');
    const nipple = build('steel.nipple', { nominalLeft: '3/4', nominalRight: '3/4', length: 0.026 });
    expect(ConnectorMating.check(port(manifold, 'out-1'), port(elbow, 'inlet')).compatible).toBe(true);
    expect(ConnectorMating.check(port(elbow, 'outlet'), port(adapter, 'eurocone')).compatible).toBe(true);
    expect(ConnectorMating.check(port(elbow, 'inlet'), port(nipple, 'left')).compatible).toBe(false);
    for (const model of [elbow, manifold, adapter, nipple]) model.dispose();
  });

  it('короткое плечо — ошибка', () => {
    // Евроконус 3/4: резьба 9,6 мм + носик 3 мм + 5 мм гладкого участка.
    expect(codes('steel.eurocone-elbow', { armLength: 0.0175 })).toEqual(['too_short:armLength']);
    expect(codes('steel.eurocone-elbow', { armLength: 0.018 })).toEqual([]);
  });
});

describe('КИП (часть 23b)', () => {
  it('90: гильза OR.551 — резьба 11 мм, трубка за торцем на 42,5 мм, общая длина 60 мм', () => {
    const model = build('equipment.thermowell');
    expect(port(model, 'process')).toMatchObject({ joint: 'thread', gender: 'external', nominal: '1/2', depth: 0.011, position: { x: 0, y: 0, z: 0 } });
    expect(model.bounds.min.x).toBeCloseTo(-0.0425, 6);
    expect(model.bounds.max.x - model.bounds.min.x).toBeCloseTo(0.06, 6);
    // Шестигранник SW 22.
    expect(model.bounds.max.y - model.bounds.min.y).toBeCloseTo(0.022, 6);
    const long = build('equipment.thermowell', { length: 0.09, socket: 12 });
    expect(long.bounds.min.x).toBeCloseTo(-(0.09 - 0.0175), 6);
    expect(codes('equipment.thermowell', { length: 0.028 })).toEqual(['too_short:length']);
    model.dispose(); long.dispose();
  });

  it('89: косой тройник VTr.136 — отвод 1/2 под 45° вверх-назад; гильза в отводе доходит до оси прохода', () => {
    const tee = build('steel.y-tee');
    const branch = port(tee, 'branch');
    expect(branch).toMatchObject({ joint: 'thread', gender: 'internal', nominal: '1/2' });
    expect(branch.direction.x).toBeCloseTo(-Math.SQRT1_2, 9);
    expect(branch.direction.y).toBeCloseTo(Math.SQRT1_2, 9);
    expect(port(tee, 'left').position.x).toBeCloseTo(-0.03, 9);
    const well = build('equipment.thermowell');
    const check = ConnectorMating.check(branch, port(well, 'process'));
    expect(check.compatible).toBe(true);
    // Конец гильзы — за осью прохода, но внутри канала 1/2: дальняя точка трубки Ø12 от оси меньше 9,3 мм.
    const tip = 0.045 - (check.compatible ? check.engagement : 0) - 0.0425;
    expect(tip).toBeLessThan(0);
    expect((Math.abs(tip) + 0.006) * Math.SQRT1_2).toBeLessThan(0.0093);
    expect(codes('steel.y-tee', { length: 0.05 })).toEqual(['too_short:length']);
    expect(codes('steel.y-tee', { nominal: '1', length: 0.072 })).toEqual([]);
    tee.dispose(); well.dispose();
  });

  it.each([['1/4', 0.157], ['3/8', 0.164], ['1/2', 0.167]] as const)('92: трубка OR.1809 %s — H между торцами, петля D 62 мм вниз', (nominal, length) => {
    const model = build('equipment.siphon-tube', { nominal, length });
    const process = port(model, 'process');
    const gauge = port(model, 'gauge');
    expect(process).toMatchObject({ gender: 'external', nominal, direction: { x: -1, y: 0, z: 0 } });
    expect(gauge).toMatchObject({ gender: 'internal', nominal, direction: { x: 1, y: 0, z: 0 } });
    expect(gauge.position.x - process.position.x).toBeCloseTo(length, 9);
    // Виток смещён по Z больше диаметра трубки 10 мм.
    expect(gauge.position.z - process.position.z).toBeGreaterThan(0.01);
    expect(model.bounds.min.y).toBeCloseTo(-0.062 + 0.005, 3);
    model.dispose();
  });

  it('92: трубка — короткая H ошибка', () => {
    expect(codes('equipment.siphon-tube', { length: 0.1 })).toEqual(['too_short:length']);
  });

  it.each([['external', '1/2', 0.075], ['internal', '1/4', 0.065]] as const)('91: кран для манометра %s × гайка %s — торцы ±A/2, гайка под манометр', (inlet, gaugeNominal, length) => {
    const tap = build('valve.gauge-tap', { inlet, gaugeNominal, length });
    expect(port(tap, 'inlet')).toMatchObject({ nominal: '1/2', gender: inlet, joint: 'thread' });
    expect(port(tap, 'inlet').position.x).toBeCloseTo(-length / 2, 9);
    expect(port(tap, 'gauge')).toMatchObject({ nominal: gaugeNominal, gender: 'internal', joint: 'thread' });
    expect(port(tap, 'gauge').position.x).toBeCloseTo(length / 2, 9);
    // Верх — втулка ручки общих частей шаровых кранов: 39,3 мм против B = 37 мм по каталогу.
    expect(tap.bounds.max.y).toBeCloseTo(0.0393, 4);
    expect(tap.title).toContain(inlet === 'external' ? 'VT.806' : 'VT.807');
    tap.dispose();
  });

  it('91: VT.806 1/2 × 1/4 — манометр G1/4 на гайку, вход в тройник 1/2; трубка OR.1809 — между тройником и краном', () => {
    const tap = build('valve.gauge-tap', { inlet: 'external', gaugeNominal: '1/4', length: 0.073 });
    const gauge = build('equipment.gauge', { kind: 'manometer', diameter: 63, connection: 'bottom', nominal: '1/4' });
    const siphon = build('equipment.siphon-tube');
    const tee = build('steel.tee', { threadGender: 'internal', nominalLeft: '1/2', nominalRight: '1/2', nominalBranch: '1/2', length: 0.046, branchLength: 0.023 });
    expect(ConnectorMating.check(port(tap, 'gauge'), port(gauge, 'connection')).compatible).toBe(true);
    expect(ConnectorMating.check(port(tap, 'inlet'), port(tee, 'top')).compatible).toBe(true);
    expect(ConnectorMating.check(port(siphon, 'process'), port(tee, 'top')).compatible).toBe(true);
    expect(ConnectorMating.check(port(siphon, 'gauge'), port(tap, 'inlet')).compatible).toBe(true);
    expect(codes('valve.gauge-tap', { length: 0.04 })).toEqual(['too_short:length']);
    for (const model of [tap, gauge, siphon, tee]) model.dispose();
  });
});

describe('шаровой кран valve.ball, версия 2 (позиции 93, 94)', () => {
  const gl2 = { ends: 'internal', nominal: '1/2', length: 0.0475, handleLength: 0.053 } as const;

  it('параметры версии 1 и явные умолчания — прежний кран с бабочкой', () => {
    const old = registry.get('valve.ball').build(gl2 as never);
    const explicit = build('valve.ball', { ...gl2, handle: 'butterfly', sensorPort: 'none' });
    expect(positions(explicit)).toEqual(positions(old));
    expect(explicit.connectors).toEqual(old.connectors);
    old.dispose(); explicit.dispose();
  });

  it.each([['1/2', 0.0475, 0.067], ['3/4', 0.0555, 0.072]] as const)('93: VT.808 %s — ручка с термометром, верх на B над осью, циферблат термометра', (nominal, length, b) => {
    const model = build('valve.ball', { ends: 'internal', nominal, length, handleLength: 0.045, handle: 'thermometer' });
    expect(model.bounds.max.y).toBeCloseTo(b, 6);
    expect(model.materials).toEqual(expect.arrayContaining(['black', 'thermometer']));
    expect(model.connectors.map((c) => c.id)).toEqual(['left', 'right']);
    expect(model.title).toBe(`Шаровой кран ${nominal}(в-в), с термометром`);
    model.dispose();
  });

  it.each([['1/2', 0.047, 0.0905], ['1', 0.067, 0.1045]] as const)('94: VT.247 %s — рычаг по +X, гнездо M10×1 вниз', (nominal, length, reach) => {
    const model = build('valve.ball', { ends: 'internal', nominal, length, handleLength: reach, handle: 'lever', sensorPort: 'M10x1' });
    const sensor = port(model, 'sensor');
    expect(sensor).toMatchObject({ joint: 'thread', gender: 'internal', nominal: 'M10x1', direction: { x: 0, y: -1, z: 0 } });
    expect(sensor.position.y).toBeCloseTo(model.bounds.min.y, 6);
    expect(model.bounds.max.x).toBeCloseTo(reach, 6);
    expect(model.title).toContain('гнездо датчика M10×1');
    // Гнездо — свободная граница: трубная резьба 1/2 в него не входит.
    const nipple = build('steel.nipple');
    expect(ConnectorMating.check(sensor, port(nipple, 'left')).compatible).toBe(false);
    model.dispose(); nipple.dispose();
  });

  it('только выпускаемые исполнения', () => {
    expect(codes('valve.ball', { ends: 'external', handle: 'thermometer' })).toEqual(['incompatible:handle']);
    expect(codes('valve.ball', { ends: 'internal', nominal: '1', length: 0.0625, handle: 'thermometer' })).toEqual(['incompatible:handle']);
    expect(codes('valve.ball', { ends: 'internal-external', sensorPort: 'M10x1' })).toEqual(['incompatible:sensorPort']);
    expect(codes('valve.ball', { ends: 'internal', nominal: '1 1/4', length: 0.0775, sensorPort: 'M10x1' })).toEqual(['incompatible:sensorPort']);
    expect(codes('valve.ball', { ends: 'external', handle: 'lever', handleLength: 0.1 })).toEqual([]);
  });
});
