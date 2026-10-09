import { MathUtils, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { GeneratorRegistry, MaterialLibrary } from '../src/lib/index';
import { Assembly } from '../src/stand/Assembly';
import { STAND_ASSEMBLIES } from '../src/stand/assemblies';

const registry = new GeneratorRegistry(new MaterialLibrary());

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
      const moving = assembly.parts.find((placed) => placed.name === part.name)!.model;
      const fixed = assembly.parts.find((placed) => placed.name === part.attach!.to)!.model;
      const a = fixed.connectors.find((c) => c.id === part.attach!.toConnector)!;
      const b = moving.connectors.find((c) => c.id === part.attach!.connector)!;
      const da = new Vector3().copy(a.direction).transformDirection(fixed.root.matrixWorld);
      const db = new Vector3().copy(b.direction).transformDirection(moving.root.matrixWorld);
      expect(da.dot(db), part.name).toBeCloseTo(-1, 9);
      const ua = new Vector3().copy(a.up).transformDirection(fixed.root.matrixWorld);
      const ub = new Vector3().copy(b.up).transformDirection(moving.root.matrixWorld);
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

    const xs = assembly.parts.map(({ model }) => model.root.position.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    assembly.dispose();
  });
});

describe('доворот на угол стыка', () => {
  it('угол на ниппеле повёрнут на 90°: второй выход смотрит вдоль Z', () => {
    const definition = STAND_ASSEMBLIES.find((assembly) => assembly.label.startsWith('Тройник'))!;
    const assembly = new Assembly(registry, definition);
    const elbow = assembly.parts.find(({ name }) => name === 'угол')!.model;
    const top = elbow.connectors.find((c) => c.id === 'top')!;
    const direction = new Vector3().copy(top.direction).transformDirection(elbow.root.matrixWorld);
    expect(Math.abs(direction.z)).toBeCloseTo(1, 9);
    assembly.dispose();
  });
});
