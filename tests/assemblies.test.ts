import { Box3, Group, MathUtils, Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Assembly, ConnectorMating, createModelObject, GeneratorRegistry, MaterialLibrary } from '../src/lib/index';
import type { AssemblyClosureDefinition, AssemblyDefinition } from '../src/lib/index';
import { CLOSURE_TOLERANCE } from '../src/lib/assembly/Assembly';
import { MANIFOLD_PAIR_OFFSET, manifoldPair, STAND_ASSEMBLIES, steelBottomHBlock } from '../src/stand/assemblies';

const registry = new GeneratorRegistry();

describe.each(STAND_ASSEMBLIES)('сборка «$label»', (definition) => {
  const expectFailure = definition.label.startsWith('Ошибка');

  it(expectFailure ? 'строится, стык помечен несовместимым' : 'строится, все стыки совместимы', () => {
    const assembly = new Assembly(registry, definition);
    expect(assembly.errors).toEqual([]);
    expect(assembly.parts).toHaveLength(definition.parts.length);
    expect(assembly.joints).toHaveLength(definition.parts.filter((part) => part.attach).length);
    expect(assembly.joints.every(({ check }) => check.compatible)).toBe(!expectFailure);
    expect(assembly.closures).toHaveLength(definition.closures?.length ?? 0);
    for (const closure of assembly.closures) expect(closure.closed, closure.label).toBe(true);
    assembly.dispose();
  });

  it('разъёмы каждого стыка смотрят навстречу, up — с доворотом на угол стыка', () => {
    const assembly = new Assembly(registry, definition);
    for (const part of definition.parts) {
      if (!part.attach) continue;
      const moving = assembly.parts.find((placed) => placed.name === part.name)!;
      const fixed = assembly.parts.find((placed) => placed.name === part.attach!.to)!;
      const a = fixed.model.connectors.find((c) => c.id === part.attach!.toConnector)!;
      const b = moving.model.connectors.find((c) => c.id === part.attach!.connector)!;
      const da = new Vector3().copy(a.direction).transformDirection(fixed.matrix);
      const db = new Vector3().copy(b.direction).transformDirection(moving.matrix);
      expect(da.dot(db), part.name).toBeCloseTo(-1, 9);
      const ua = new Vector3().copy(a.up).transformDirection(fixed.matrix);
      const ub = new Vector3().copy(b.up).transformDirection(moving.matrix);
      expect(ua.dot(ub), part.name).toBeCloseTo(Math.cos(MathUtils.degToRad(part.attach.angle ?? 0)), 9);
    }
    assembly.dispose();
  });
});

describe('цепочка радиатор → переходник → ниппель → муфта', () => {
  it('детали идут по +X без зазоров и с вводом резьбы', () => {
    const assembly = new Assembly(registry, STAND_ASSEMBLIES[0]);
    const engagements = assembly.joints.map(({ check }) => (check.compatible ? Math.round(check.engagement * 1e6) / 1e3 : NaN));
    // Переходник в радиатор — 8 мм; ниппель в переходник — 5 мм (резьба гайки); муфта на ниппель — 8 мм.
    expect(engagements).toEqual([8, 5, 8]);

    const xs = assembly.parts.map(({ matrix }) => new Vector3().setFromMatrixPosition(matrix).x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    assembly.dispose();
  });
});

describe('стальной радиатор снизу: H-блок на двух ниппелях', () => {
  it.each(['right', 'left'] as const)('%s: второй порт H-блока встаёт в ниппель B по правилу стыковки', (bottomSide) => {
    const assembly = new Assembly(registry, steelBottomHBlock(bottomSide));
    expect(assembly.joints.every(({ check }) => check.compatible)).toBe(true);
    const part = (name: string) => assembly.parts.find((placed) => placed.name === name)!;
    const port = (name: string, id: string) => part(name).model.connectors.find((c) => c.id === id)!;
    const hBlock = part('H-блок');
    // Порт H-блока, не участвующий в attach, — с ниппелем B.
    const free = port('H-блок', bottomSide === 'right' ? 'radiator-right' : 'radiator-left');
    const nippleB = port('ниппель B', 'left');
    expect(ConnectorMating.check(nippleB, free).compatible).toBe(true);
    // Замыкание вне дерева attach: H-блок, поставленный по второму стыку, совпадает с фактическим.
    const expected = ConnectorMating.place(nippleB, part('ниппель B').matrix, free);
    const actual = new Vector3().setFromMatrixPosition(hBlock.matrix);
    expect(new Vector3().setFromMatrixPosition(expected).distanceTo(actual)).toBeLessThan(1e-6);
    const worldFree = new Vector3().copy(free.direction).transformDirection(hBlock.matrix);
    const worldNipple = new Vector3().copy(nippleB.direction).transformDirection(part('ниппель B').matrix);
    expect(worldFree.dot(worldNipple)).toBeCloseTo(-1, 9);
    // Звено «евроконус → МП-труба»: обе трубы уходят от H-блока вниз, под радиатор.
    const hBlockY = actual.y;
    for (const side of ['left', 'right']) {
      expect(new Vector3().setFromMatrixPosition(part(`труба ${side}`).matrix).y, side).toBeLessThan(hBlockY - 0.05);
    }
    assembly.dispose();
  });
});

describe('Assembly.bounds', () => {
  it('совпадает с габаритом объектов сцены, поставленных по матрицам деталей', () => {
    const library = new MaterialLibrary();
    for (const definition of STAND_ASSEMBLIES) {
      const assembly = new Assembly(registry, definition);
      const root = new Group();
      for (const { model, matrix } of assembly.parts) {
        const object = createModelObject(model, library);
        matrix.decompose(object.position, object.quaternion, object.scale);
        root.add(object);
      }
      const expected = new Box3().setFromObject(root);
      const { min, max } = assembly.bounds();
      expect(new Vector3().copy(min).distanceTo(expected.min), definition.label).toBeLessThan(1e-9);
      expect(new Vector3().copy(max).distanceTo(expected.max), definition.label).toBeLessThan(1e-9);
      assembly.dispose();
    }
  });
});

describe('доворот на угол стыка', () => {
  it('угол на ниппеле повёрнут на 90°: второй выход смотрит вдоль Z', () => {
    const definition = STAND_ASSEMBLIES.find((assembly) => assembly.label.startsWith('Тройник'))!;
    const assembly = new Assembly(registry, definition);
    const elbow = assembly.parts.find(({ name }) => name === 'угол')!;
    const top = elbow.model.connectors.find((c) => c.id === 'top')!;
    const direction = new Vector3().copy(top.direction).transformDirection(elbow.matrix);
    expect(Math.abs(direction.z)).toBeCloseTo(1, 9);
    assembly.dispose();
  });
});

describe('Assembly.setAngle', () => {
  const definition = STAND_ASSEMBLIES.find((assembly) => assembly.label.startsWith('Тройник'))!;
  const worldConnector = (assembly: Assembly, part: string, id: string) => {
    const { model, matrix } = assembly.parts.find(({ name }) => name === part)!;
    const connector = model.connectors.find((c) => c.id === id)!;
    return {
      connector,
      position: new Vector3().copy(connector.position).applyMatrix4(matrix),
      direction: new Vector3().copy(connector.direction).transformDirection(matrix),
      up: new Vector3().copy(connector.up).transformDirection(matrix),
    };
  };

  it('угол 0: второй выход угла смотрит вверх; 90°: вдоль Z', () => {
    const assembly = new Assembly(registry, definition);
    assembly.setAngle('угол', 0);
    expect(worldConnector(assembly, 'угол', 'top').direction.y).toBeCloseTo(1, 9);
    assembly.setAngle('угол', 90);
    expect(Math.abs(worldConnector(assembly, 'угол', 'top').direction.z)).toBeCloseTo(1, 9);
    expect(assembly.joints.find(({ part }) => part === 'угол')!.angle).toBe(90);
    assembly.dispose();
  });

  it('поворот ниппеля: стыки сходятся, торцы на месте, угол повернулся вместе с ниппелем', () => {
    const assembly = new Assembly(registry, definition);
    const elbowBefore = worldConnector(assembly, 'угол', 'top').direction;
    const valveBefore = assembly.parts.find(({ name }) => name === 'кран в-в')!.matrix.clone();

    assembly.setAngle('ниппель слева', 45);

    const angles: Record<string, number> = { 'ниппель слева': 45, угол: 90 };
    for (const part of definition.parts) {
      if (!part.attach) continue;
      const fixed = worldConnector(assembly, part.attach.to, part.attach.toConnector);
      const moving = worldConnector(assembly, part.name, part.attach.connector);
      expect(fixed.direction.dot(moving.direction), part.name).toBeCloseTo(-1, 9);
      expect(fixed.up.dot(moving.up), part.name).toBeCloseTo(Math.cos(MathUtils.degToRad(angles[part.name] ?? part.attach.angle ?? 0)), 9);
      const engagement = Math.min(fixed.connector.depth, moving.connector.depth);
      const expected = fixed.position.clone().addScaledVector(fixed.direction, -engagement);
      expect(moving.position.distanceTo(expected), part.name).toBeLessThan(1e-9);
    }

    // Ось стыка ниппеля — X: выход угла повернулся вокруг неё на 45°.
    const elbowAfter = worldConnector(assembly, 'угол', 'top').direction;
    expect(elbowAfter.x).toBeCloseTo(elbowBefore.x, 9);
    expect(elbowAfter.angleTo(elbowBefore)).toBeCloseTo(Math.PI / 4, 9);
    // Детали с другой стороны тройника не сдвинулись.
    expect(assembly.parts.find(({ name }) => name === 'кран в-в')!.matrix.equals(valveBefore)).toBe(true);
    assembly.dispose();
  });
});

describe('явное положение детали (часть 16)', () => {
  const nipple = { nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 };
  const coupling = { nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 };
  const position = (assembly: Assembly, name: string) => new Vector3().setFromMatrixPosition(assembly.parts.find((part) => part.name === name)!.matrix);

  it('без relativeTo — в координатах сборки: сдвиг, затем поворот в градусах', () => {
    const assembly = new Assembly(registry, { label: 'положение', parts: [
      { name: 'муфта', generatorId: 'steel.coupling', params: coupling },
      { name: 'ниппель', generatorId: 'steel.nipple', params: nipple, placement: { at: { x: 0.1, y: 0.2, z: 0 }, rotation: { x: 0, y: 0, z: 90 } } },
    ] });
    expect(assembly.errors).toEqual([]);
    expect(assembly.joints).toEqual([]);
    expect(position(assembly, 'ниппель').toArray()).toEqual([0.1, 0.2, 0]);
    const axis = new Vector3(1, 0, 0).transformDirection(assembly.parts[1].matrix);
    expect(axis.y).toBeCloseTo(1, 9);
    assembly.dispose();
  });

  it('с relativeTo — следует за деталью, когда setAngle переставляет её', () => {
    const definition: AssemblyDefinition = { label: 'относительно', parts: [
      { name: 'муфта', generatorId: 'steel.coupling', params: coupling },
      { name: 'ниппель', generatorId: 'steel.nipple', params: nipple, attach: { connector: 'left', to: 'муфта', toConnector: 'right' } },
      { name: 'метка', generatorId: 'steel.coupling', params: coupling, placement: { at: { x: 0, y: 0.05, z: 0 }, relativeTo: 'ниппель' } },
    ] };
    const assembly = new Assembly(registry, definition);
    const expected = () => new Vector3(0, 0.05, 0).applyMatrix4(assembly.parts[1].matrix);
    expect(position(assembly, 'метка').distanceTo(expected())).toBeLessThan(1e-12);
    assembly.setAngle('ниппель', 90);
    // Ниппель повернулся вокруг оси X: метка ушла с +Y на ±Z вместе с ним.
    expect(position(assembly, 'метка').distanceTo(expected())).toBeLessThan(1e-12);
    expect(Math.abs(position(assembly, 'метка').z)).toBeCloseTo(0.05, 9);
    assembly.dispose();
  });

  it.each([
    ['и attach, и placement', { attach: { connector: 'left', to: 'муфта', toConnector: 'right' }, placement: { at: { x: 0, y: 0, z: 0 } } }, 'и присоединение, и явное положение'],
    ['relativeTo неизвестной детали', { placement: { at: { x: 0, y: 0, z: 0 }, relativeTo: 'нет такой' } }, 'не найдена или ещё не поставлена'],
    ['relativeTo детали ниже по описанию', { placement: { at: { x: 0, y: 0, z: 0 }, relativeTo: 'последняя' } }, 'не найдена или ещё не поставлена'],
  ] as const)('%s — ошибка описания, деталь остаётся в начале координат', (_, how, message) => {
    const assembly = new Assembly(registry, { label: 'ошибка', parts: [
      { name: 'муфта', generatorId: 'steel.coupling', params: coupling },
      { name: 'ниппель', generatorId: 'steel.nipple', params: nipple, ...how },
      { name: 'последняя', generatorId: 'steel.coupling', params: coupling },
    ] });
    expect(assembly.errors).toHaveLength(1);
    expect(assembly.errors[0]).toContain(message);
    expect(assembly.joints).toEqual([]);
    expect(assembly.parts[1].matrix.equals(new Matrix4())).toBe(true);
    assembly.dispose();
  });

  it('пара гребёнок 67/68: обратная на 200 мм выше и на 32 мм ближе к стене, контуры с одним номером на одной вертикали', () => {
    const assembly = new Assembly(registry, manifoldPair(4));
    expect(assembly.errors).toEqual([]);
    expect(position(assembly, 'обратный').toArray()).toEqual([MANIFOLD_PAIR_OFFSET.x, MANIFOLD_PAIR_OFFSET.y, MANIFOLD_PAIR_OFFSET.z]);
    const outlet = (part: string, k: number) => {
      const placed = assembly.parts.find((p) => p.name === part)!;
      return new Vector3().copy(placed.model.connectors.find((c) => c.id === `out-${k}`)!.position).applyMatrix4(placed.matrix);
    };
    for (let k = 1; k <= 4; k++) expect(outlet('обратный', k).x).toBeCloseTo(outlet('подающий', k).x, 12);
    // Труба обратки (Ø16) проходит за корпусом подающей (Ø40): разнос по глубине больше суммы радиусов.
    expect(Math.abs(MANIFOLD_PAIR_OFFSET.z)).toBeGreaterThan(0.02 + 0.008);
    // Расходомеры подающей ниже нижнего края обратной гребёнки.
    const supply = assembly.parts.find((p) => p.name === 'подающий')!;
    expect(supply.model.bounds.max.y).toBeLessThan(MANIFOLD_PAIR_OFFSET.y - 0.02);
    assembly.dispose();
  });
});

describe('замыкания вне дерева attach', () => {
  // Муфта на ниппеле; второй ниппель поставлен явным положением напротив правого конца муфты.
  const coupling = { nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 };
  const nipple = { nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 };
  const loop = (x: number, closure: Partial<AssemblyClosureDefinition> = {}): AssemblyDefinition => ({
    label: 'замыкание',
    parts: [
      { name: 'муфта', generatorId: 'steel.coupling', params: coupling },
      { name: 'ниппель', generatorId: 'steel.nipple', params: nipple, placement: { at: { x, y: 0, z: 0 } } },
    ],
    closures: [{ part: 'ниппель', connector: 'left', to: 'муфта', toConnector: 'right', ...closure }],
  });
  /** Центр ниппеля, при котором его левый торец стоит на месте посадки в правом конце муфты. */
  const seated = () => {
    const assembly = new Assembly(registry, loop(0));
    const [muff, nip] = assembly.parts.map((part) => part.model);
    const fixed = muff.connectors.find((c) => c.id === 'right')!;
    const moving = nip.connectors.find((c) => c.id === 'left')!;
    const x = fixed.position.x - ConnectorMating.engagement(fixed, moving) - moving.position.x;
    assembly.dispose();
    return x;
  };

  it('торец на месте посадки — замыкание сходится', () => {
    const assembly = new Assembly(registry, loop(seated()));
    expect(assembly.errors).toEqual([]);
    expect(assembly.closures).toHaveLength(1);
    expect(assembly.closures[0]).toMatchObject({ label: 'ниппель.left → муфта.right', closed: true, check: { compatible: true } });
    expect(assembly.closures[0].gap).toBeLessThan(1e-9);
    assembly.dispose();
  });

  it('зазор больше допуска — не сходится, зазор измерен', () => {
    const assembly = new Assembly(registry, loop(seated() + 0.002));
    expect(assembly.closures[0].closed).toBe(false);
    expect(assembly.closures[0].gap).toBeCloseTo(0.002, 9);
    expect(assembly.closures[0].check.compatible).toBe(true);
    assembly.dispose();
  });

  it('зазор в пределах допуска — сходится', () => {
    const assembly = new Assembly(registry, loop(seated() + CLOSURE_TOLERANCE.gap / 2));
    expect(assembly.closures[0].closed).toBe(true);
    assembly.dispose();
  });

  it('несовместимая пара не сходится даже на месте', () => {
    const assembly = new Assembly(registry, loop(seated(), { part: 'муфта', connector: 'left', to: 'муфта', toConnector: 'right' }));
    expect(assembly.closures[0].check).toMatchObject({ compatible: false, reason: 'gender' });
    expect(assembly.closures[0].closed).toBe(false);
    assembly.dispose();
  });

  it('перекос осей не сходится', () => {
    const definition = loop(seated());
    definition.parts[1].placement!.rotation = { x: 0, y: 0, z: 5 };
    const assembly = new Assembly(registry, definition);
    expect(assembly.closures[0].misalignment).toBeCloseTo(MathUtils.degToRad(5), 9);
    expect(assembly.closures[0].closed).toBe(false);
    assembly.dispose();
  });

  it('нет разъёма — ошибка описания, замыкание не добавлено', () => {
    const assembly = new Assembly(registry, loop(seated(), { toConnector: 'top' }));
    expect(assembly.errors).toEqual(['замыкание ниппель.left → муфта.top: нет детали или разъёма']);
    expect(assembly.closures).toEqual([]);
    assembly.dispose();
  });

  it('setAngle пересчитывает замыкание: поворот H-блока размыкает второй порт', () => {
    const assembly = new Assembly(registry, steelBottomHBlock('right'));
    expect(assembly.closures[0].closed).toBe(true);
    assembly.setAngle('H-блок', 30);
    expect(assembly.closures[0].closed).toBe(false);
    expect(assembly.closures[0].gap).toBeGreaterThan(0.01);
    assembly.setAngle('H-блок', 0);
    expect(assembly.closures[0].closed).toBe(true);
    assembly.dispose();
  });
});
