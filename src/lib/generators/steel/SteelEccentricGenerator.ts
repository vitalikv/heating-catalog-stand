import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { orientParts, threadedArm, threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';

export interface SteelEccentricParams {
  /** Наружная резьба к водорозетке (слева, −X). */
  nominalLeft: string;
  /** Наружная резьба к смесителю (справа, +X). */
  nominalRight: string;
  /** Смещение осей, м: ось правого конца выше левой по +Y. */
  offset: number;
  /** Длина между торцами, м. */
  length: number;
  /** Декоративная чашка у стены (у левого конца). */
  cup: 'cup' | 'none';
}

type Layout = { left: ThreadedSize; right: ThreadedSize; leftArm: number; rightArm: number; body: number };

/** Чашка VTr.670: диаметр 55 мм; глубина и толщина — условно. */
const CUP = { diameter: 0.055, depth: 0.012, wall: 0.001 };

/**
 * Эксцентрик Н–Н (позиция 15) по VALTEC VTr.670 (каталог 2017, с. 82): 1/2 × 3/4, длина 43 мм,
 * смещение осей 9 мм, декоративная чашка Ø55. Других сочетаний концов VALTEC не выпускает —
 * В–Н и В–В не добавлены. Корпус — шестигранник между плечами, охватывающий обе оси (условно).
 */
export class SteelEccentricGenerator extends BaseGenerator<SteelEccentricParams, Layout> {
  readonly id = 'steel.eccentric';
  readonly version = 1;
  readonly title = 'Эксцентрик Н–Н';
  readonly defaults: SteelEccentricParams = { nominalLeft: '1/2', nominalRight: '3/4', offset: 0.009, length: 0.043, cup: 'cup' };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('nominalLeft', 'Резьба к водорозетке'),
    specs.threadNominal('nominalRight', 'Резьба к смесителю'), specs.length('offset', 'Смещение осей', { min: 0, max: 0.03 }),
    specs.length('length', 'Длина'),
    { kind: 'choice', key: 'cup', label: 'Чашка', options: ['cup', 'none'], optionLabels: { cup: 'есть', none: 'нет' } }];

  protected override layout(p: SteelEccentricParams): Layout {
    const left = threadedSize(p.nominalLeft, 'external');
    const right = threadedSize(p.nominalRight, 'external');
    return { left, right, leftArm: left.depth + 0.004, rightArm: right.depth + 0.004, body: Math.max(left.n, right.n) + p.offset + 0.004 };
  }

  protected override relations(p: SteelEccentricParams, d: Layout): ValidationError[] {
    const min = d.leftArm + d.rightArm + 0.006;
    return p.length <= min ? [ParamSchema.tooShort('length', min)] : [];
  }

  protected create(p: SteelEccentricParams, d: Layout): GeneratedModel {
    const half = p.length / 2;
    const bodyStart = -half + d.leftArm;
    const bodyEnd = half - d.rightArm;
    const merger = new MaterialGroupMerger();
    merger.add(
      ...orientParts(threadedArm(d.left, 'external', d.leftArm), ConnectorFrame.left.direction, { x: bodyStart, y: 0, z: 0 }),
      ...orientParts(threadedArm(d.right, 'external', d.rightArm), ConnectorFrame.right.direction, { x: bodyEnd, y: p.offset, z: 0 }),
      ...sleeves.build({ material: 'metal', length: bodyEnd - bodyStart, outerDiameter: d.body / Math.cos(Math.PI / 6), innerDiameter: 0,
        outerSegments: 6, center: { x: (bodyStart + bodyEnd) / 2, y: p.offset / 2, z: 0 }, materials: { outer: 'metalFlat' } }),
    );
    if (p.cup === 'cup') {
      // Колокол от корпуса к стене, открыт в сторону −X: закрывает резьбу водорозетки.
      merger.add(...sleeves.build({ material: 'metal', length: CUP.depth, outerDiameterStart: CUP.diameter, outerDiameter: d.body,
        innerDiameterStart: CUP.diameter - 2 * CUP.wall, innerDiameter: d.left.n, center: { x: bodyStart - CUP.depth / 2, y: 0, z: 0 } }));
    }
    return createMeshModel({
      title: `Эксцентрик ${p.nominalLeft} × ${p.nominalRight}, ${Math.round(p.offset * 1000)} мм${p.cup === 'cup' ? ', с чашкой' : ''}`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, half, { nominal: p.nominalLeft, joint: 'thread', gender: 'external', depth: d.left.depth }),
        connector('right', ConnectorFrame.right, { x: half, y: p.offset, z: 0 }, { nominal: p.nominalRight, joint: 'thread', gender: 'external', depth: d.right.depth }),
      ],
    });
  }
}
