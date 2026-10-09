import { Box3, Group, MathUtils, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Assembly, createModelObject, GeneratorRegistry, MaterialLibrary } from '../src/lib/index';
import { STAND_ASSEMBLIES } from '../src/stand/assemblies';

const registry = new GeneratorRegistry();

describe.each(STAND_ASSEMBLIES)('сборка «$label»', (definition) => {
  const expectFailure = definition.label.startsWith('Ошибка');

  it(expectFailure ? 'строится, стык помечен несовместимым' : 'строится, все стыки совместимы', () => {
    const assembly = new Assembly(registry, definition);
    expect(assembly.errors).toEqual([]);
    expect(assembly.parts).toHaveLength(definition.parts.length);
    expect(assembly.joints).toHaveLength(definition.parts.filter((part) => part.attach).length);
    expect(assembly.joints.every(({ check }) => check.compatible)).toBe(!expectFailure);
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
