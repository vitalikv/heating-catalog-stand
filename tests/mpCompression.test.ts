import { describe, expect, it } from 'vitest';
import { CATALOG, ConnectorMating, GeneratorRegistry } from '../src/lib/index';
import type { Connector, GeneratedModel, ModelGenerator } from '../src/lib/index';

const registry = new GeneratorRegistry();
const port = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;
const codes = <T>(generator: ModelGenerator<T>, params: T) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);

// Обжим 16 по эскизу VTm.303: гайка 3,6 + 0,6 × 16 = 13,2 мм — глубина ввода трубы до буртика.
const NUT_16 = 0.0132;
const COMPRESSION = ['mp.compression-coupling', 'mp.compression-elbow', 'mp.compression-tee', 'mp.compression-thread-adapter'] as const;

describe('обжимные фитинги МП (часть 22, по VALTEC VTm.300)', () => {
  const pipe16 = registry.get('mp.pipe').build({ nominal: '16', length: 0.5 });
  const pipe20 = registry.get('mp.pipe').build({ nominal: '20', length: 0.5 });
  const pressCoupling = registry.get('mp.coupling').build({ nominalLeft: '16', nominalRight: '16', length: 0.06 });

  it('соединитель VTm.303 20 × 16: торцы на ±A/2, внутренние mp-compression, глубина — длина гайки', () => {
    const model = registry.get('mp.compression-coupling').build({ nominalLeft: '16', nominalRight: '20', length: 0.048 });
    expect(port(model, 'left')).toMatchObject({ joint: 'mp-compression', gender: 'internal', nominal: '16', position: { x: -0.024, y: 0, z: 0 } });
    expect(port(model, 'right')).toMatchObject({ nominal: '20', position: { x: 0.024, y: 0, z: 0 } });
    expect(port(model, 'left').depth).toBeCloseTo(NUT_16, 9);
    expect(model.title).toBe('Соединитель обжимной 16x20');
    model.dispose();
  });

  it.each([
    ['mp.compression-coupling', ['left', 'right']],
    ['mp.compression-elbow', ['right', 'top']],
    ['mp.compression-tee', ['left', 'right', 'top']],
    ['mp.compression-thread-adapter', ['left']],
    ['mp.eurocone-adapter', ['pipe']],
  ] as const)('%s: конец МП-трубы входит, пресс-фитинг и труба другого диаметра — нет', (id, ports) => {
    const generator = registry.get(id);
    const model = generator.build(generator.defaults);
    for (const portId of ports) {
      const socket = port(model, portId);
      expect(ConnectorMating.check(socket, port(pipe16, 'end')), portId).toEqual({ compatible: true, engagement: socket.depth });
      expect(ConnectorMating.check(socket, port(pipe20, 'end')), portId).toMatchObject({ compatible: false, reason: 'nominal' });
      expect(ConnectorMating.check(socket, port(pressCoupling, 'left')), portId).toMatchObject({ compatible: false, reason: 'joint' });
    }
    model.dispose();
  });

  it.each(COMPRESSION)('%s: никелированный корпус и гайки, латунное разрезное кольцо', (id) => {
    const generator = registry.get(id);
    const model = generator.build(generator.defaults);
    expect(model.materials).toEqual(expect.arrayContaining(['metal', 'metalFlat', 'bronze']));
    expect(model.materials).not.toContain('bronzeThread');
    expect(model.materials).not.toContain('bronzeFlat');
    model.dispose();
  });

  it.each(COMPRESSION)('%s: ряд труб VTm.300 — 16…32, без 40', (id) => {
    const key = id === 'mp.compression-coupling' ? 'nominalLeft' : id === 'mp.compression-thread-adapter' ? 'pipeNominal' : 'nominal';
    const spec = registry.get(id).paramSpecs.find((s) => s.key === key)!;
    expect(spec).toMatchObject({ kind: 'choice', options: ['16', '20', '26', '32'] });
  });

  it('позиции каталога подписаны артикулом VALTEC и строятся с габаритами из таблиц', () => {
    const items: { label: string }[] = COMPRESSION.flatMap((id) => [...CATALOG.find((entry) => entry.generatorId === id)!.items] as { label: string }[]);
    expect(items.length).toBe(10 + 4 + 16 + 13 + 14 + 18);
    for (const item of items) expect(item.label, item.label).toMatch(/\(VTm\.3\d\d\)$/);
  });

  it('угол VTm.351 и тройник VTm.331: выходы по осям, A и B — до торцов', () => {
    const elbow = registry.get('mp.compression-elbow').build({ nominal: '16', armLength: 0.036 });
    expect(port(elbow, 'right').position).toEqual({ x: 0.036, y: 0, z: 0 });
    expect(port(elbow, 'top').position).toMatchObject({ x: 0, y: 0.036 });
    expect(port(elbow, 'top').direction).toMatchObject({ x: 0, y: 1 });
    const tee = registry.get('mp.compression-tee').build({ nominal: '20', nominalBranch: '16', length: 0.077, branchLength: 0.0355 });
    expect(tee.connectors.map((c) => [c.id, c.nominal])).toEqual([['left', '20'], ['right', '20'], ['top', '16']]);
    expect(port(tee, 'right').position.x).toBeCloseTo(0.0385, 9);
    expect(port(tee, 'top').position.y).toBeCloseTo(0.0355, 9);
    expect(tee.title).toBe('Тройник обжимной 20x16x20');
    elbow.dispose(); tee.dispose();
  });

  describe('«обжим × резьба» (позиции 126–127, версия 2)', () => {
    const elbow = registry.get('mp.compression-elbow');
    const tee = registry.get('mp.compression-tee');
    const geometryOf = (model: GeneratedModel) => Array.from(model.geometry.getAttribute('position').array);

    it("параметры версии 1 и явный 'compression' — прежняя модель", () => {
      const cases = [
        [elbow, { nominal: '16', armLength: 0.036 }, { topEnd: 'compression', threadGender: 'internal', threadNominal: '1', threadArmLength: 0.05 }],
        [tee, { nominal: '20', nominalBranch: '16', length: 0.077, branchLength: 0.0355 }, { branchEnd: 'compression' }],
      ] as const;
      for (const [generator, old, explicit] of cases) {
        const before = (generator as ModelGenerator<object>).build(old);
        const after = (generator as ModelGenerator<object>).build({ ...old, ...explicit });
        expect(after.connectors).toEqual(before.connectors);
        expect(geometryOf(after)).toEqual(geometryOf(before));
        expect(after.title).toBe(before.title);
        before.dispose(); after.dispose();
      }
    });

    it.each(['external', 'internal'] as const)('угол VTm.35x 16 × 1/2 %s: резьбовое плечо A = 27, обжимное B = 32', (threadGender) => {
      const model = elbow.build({ nominal: '16', armLength: 0.032, topEnd: 'thread', threadGender, threadNominal: '1/2', threadArmLength: 0.027 });
      expect(port(model, 'right')).toMatchObject({ joint: 'mp-compression', nominal: '16', position: { x: 0.032, y: 0, z: 0 } });
      expect(port(model, 'top')).toMatchObject({ joint: 'thread', gender: threadGender, nominal: '1/2' });
      expect(port(model, 'top').position.y).toBeCloseTo(0.027, 9);
      // Резьба 1/2: 0,4 n в пределах 8…16 мм; никелированная — в цвет корпуса.
      expect(port(model, 'top').depth).toBeGreaterThanOrEqual(0.008);
      expect(model.materials).toContain('thread');
      expect(model.title).toBe(`Угол обжимной 16x1/2${threadGender === 'internal' ? '(в)' : '(н)'}`);
      const coupling = registry.get('steel.coupling').build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 });
      const nipple = registry.get('steel.nipple').build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.022 });
      const mate = threadGender === 'external' ? port(coupling, 'left') : port(nipple, 'left');
      expect(ConnectorMating.check(mate, port(model, 'top')).compatible).toBe(true);
      expect(ConnectorMating.check(port(model, 'top'), port(pipe16, 'end')).compatible).toBe(false);
      model.dispose(); coupling.dispose(); nipple.dispose();
    });

    it('тройник VTm.332 20 × 1/2(в) × 20: отвод — резьба, проход — обжим; nominalBranch не нужен', () => {
      const params = { nominal: '20', length: 0.077, branchLength: 0.0275, branchEnd: 'thread', threadGender: 'internal', threadNominal: '1/2' } as const;
      const model = tee.build(params as typeof params & { nominalBranch: string });
      expect(model.connectors.map((c) => [c.id, c.joint, c.nominal])).toEqual([
        ['left', 'mp-compression', '20'], ['right', 'mp-compression', '20'], ['top', 'thread', '1/2'],
      ]);
      expect(port(model, 'top')).toMatchObject({ gender: 'internal', position: { x: 0, y: 0.0275, z: 0 } });
      expect(model.title).toBe('Тройник обжимной 20x1/2(в)x20');
      model.dispose();
    });

    it('короткие плечи под резьбу и неверный номинал резьбы — ошибки', () => {
      const thread = { topEnd: 'thread', threadGender: 'external', threadNominal: '1/2' } as const;
      // Обжимное плечо: гайка 13,2 мм + половина корпуса резьбового плеча 1/2(н) (18,6 + 4 = 22,6 мм) = 24,5 мм.
      expect(codes(elbow, { nominal: '16', armLength: 0.024, threadArmLength: 0.027, ...thread })).toEqual(['too_short:armLength']);
      // Резьбовое плечо: резьба 8,5 мм + половина корпуса обжима (20 мм).
      expect(codes(elbow, { nominal: '16', armLength: 0.032, threadArmLength: 0.018, ...thread })).toEqual(['too_short:threadArmLength']);
      expect(codes(elbow, { nominal: '16', armLength: 0.032, threadArmLength: 0.027, ...thread, threadNominal: '5/8' })).toEqual(['unknown_option:threadNominal']);
      expect(codes(tee, { nominal: '16', nominalBranch: '16', length: 0.065, branchLength: 0.018, branchEnd: 'thread', threadGender: 'internal', threadNominal: '1/2' }))
        .toEqual(['too_short:branchLength']);
    });
  });

  it('переход VTm.301/302: справа трубная резьба, слева обжим до торца гайки, длина A', () => {
    const generator = registry.get('mp.compression-thread-adapter');
    const external = generator.build({ threadGender: 'external', pipeNominal: '16', threadNominal: '1/2', length: 0.038 });
    const internal = generator.build({ threadGender: 'internal', pipeNominal: '16', threadNominal: '1/2', length: 0.035 });
    expect(port(external, 'right')).toMatchObject({ joint: 'thread', gender: 'external', nominal: '1/2', position: { x: 0.019, y: 0, z: 0 } });
    expect(port(external, 'left').position).toEqual({ x: -0.019, y: 0, z: 0 });
    expect(port(internal, 'right')).toMatchObject({ gender: 'internal', position: { x: 0.0175, y: 0, z: 0 } });
    expect(external.materials).toContain('thread');
    const coupling = registry.get('steel.coupling').build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 });
    expect(ConnectorMating.check(port(coupling, 'left'), port(external, 'right')).compatible).toBe(true);
    external.dispose(); internal.dispose(); coupling.dispose();
  });

  it('адаптер 63 по VT.4420: L = 26 мм, гайка навинчивается на евроконус H-блока, труба — на хвостовик', () => {
    const adapter = registry.get('mp.eurocone-adapter').build({ pipeNominal: '16', euroconeNominal: '3/4', length: 0.026 });
    const hBlock = registry.get('valve.radiator-h-block').build(registry.get('valve.radiator-h-block').defaults);
    const nipple = registry.get('steel.nipple').build({ nominalLeft: '3/4', nominalRight: '3/4', length: 0.022 });
    // Доли L по эскизу: конус штуцера 6 %, корпус гайки 51 %, шестигранник 20 %, хвостовик — остальное.
    const L = 0.026;
    const euro = port(adapter, 'eurocone');
    expect(euro).toMatchObject({ joint: 'eurocone', gender: 'internal', nominal: '3/4' });
    expect(euro.position.x).toBeCloseTo(-L / 2 + 0.06 * L, 9);
    expect(euro.depth).toBeCloseTo(0.51 * L, 9);
    // Габарит по X — ровно L: конус выступает перед гайкой, хвостовик — за ней.
    expect(adapter.bounds.min.x).toBeCloseTo(-L / 2, 6);
    expect(adapter.bounds.max.x).toBeCloseTo(L / 2, 6);
    // Выход H-блока — резьба 3/4(н) 0,4 × 24 мм и носик 3 мм; корпус гайки длиннее — садится вся резьба.
    const outlet = port(hBlock, 'pipe-left');
    expect(outlet.depth).toBeCloseTo(0.4 * 0.024 + 0.003, 9);
    expect(ConnectorMating.check(outlet, euro)).toMatchObject({ compatible: true });
    expect((ConnectorMating.check(outlet, euro) as { engagement: number }).engagement).toBeCloseTo(outlet.depth, 9);
    expect(ConnectorMating.check(port(nipple, 'right'), euro)).toMatchObject({ compatible: false, reason: 'joint' });
    // Труба надевается на хвостовик до корпуса гайки: шестигранник и хвостовик.
    expect(port(adapter, 'pipe').position).toEqual({ x: L / 2, y: 0, z: 0 });
    expect(port(adapter, 'pipe').depth).toBeCloseTo(L * (1 - 0.06 - 0.51), 9);
    // Корпус гайки — 1,16 резьбы 3/4 (26,8 мм).
    expect(adapter.bounds.max.y).toBeCloseTo(0.0268 * 1.16 / 2, 6);
    // VT.4420 NE: гайка никелированная, резьба в цвет гайки; штуцер латунный, кольца чёрные.
    expect(adapter.materials).toEqual(expect.arrayContaining(['metal', 'metalFlat', 'thread', 'bronze', 'black']));
    expect(adapter.materials).not.toContain('bronzeThread');
    adapter.dispose(); hBlock.dispose(); nipple.dispose();
  });

  it.each(['valve.check', 'valve.drain'] as const)('%s: бронзовая деталь — резьба и грани гаек бронзовые, не серебристые', (id) => {
    const generator = registry.get(id);
    const model = generator.build(generator.defaults);
    expect(model.materials).not.toContain('thread');
    expect(model.materials).not.toContain('metalFlat');
    expect(model.materials).toContain('bronzeThread');
    model.dispose();
  });

  it('слишком короткие фитинги — ошибки relations', () => {
    // Гайка 16 (13,2 мм) и половина шестигранника (3 мм) с каждой стороны.
    expect(codes(registry.get('mp.compression-coupling'), { nominalLeft: '16', nominalRight: '16', length: 0.03 })).toEqual(['too_short:length']);
    expect(codes(registry.get('mp.compression-elbow'), { nominal: '20', armLength: 0.025 })).toEqual(['too_short:armLength']);
    expect(codes(registry.get('mp.compression-tee'), { nominal: '16', nominalBranch: '16', length: 0.04, branchLength: 0.02 }))
      .toEqual(['too_short:length', 'too_short:branchLength']);
    expect(codes(registry.get('mp.compression-thread-adapter'), { threadGender: 'internal', pipeNominal: '16', threadNominal: '1/2', length: 0.028 }))
      .toEqual(['too_short:length']);
    expect(codes(registry.get('mp.compression-coupling'), { nominalLeft: '40', nominalRight: '40', length: 0.08 })).toEqual(['unknown_option:nominalLeft', 'unknown_option:nominalRight']);
    expect(codes(registry.get('mp.eurocone-adapter'), { pipeNominal: '20', euroconeNominal: '3/4', length: 0.02 })).toEqual(['out_of_range:length']);
    expect(codes(registry.get('mp.eurocone-adapter'), { pipeNominal: '16', euroconeNominal: '1/2', length: 0.026 })).toEqual(['unknown_option:euroconeNominal']);
    // Труба 26 с кольцом не проходит внутри резьбы 3/4.
    expect(codes(registry.get('mp.eurocone-adapter'), { pipeNominal: '26', euroconeNominal: '3/4', length: 0.026 })).toEqual(['unknown_option:pipeNominal']);
  });
});
