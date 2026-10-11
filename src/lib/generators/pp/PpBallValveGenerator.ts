import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { shapes } from '../../geometry/ExtrudedShapeBuilder';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { spheres } from '../../geometry/SphereGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { PpPipeSizes } from '../../sizes/PpPipeSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';
import { orientParts } from '../ThreadedParts';
import { brassEnd, brassEndParts, ppSocket, ppSocketDepth, ppUnionNut } from './PpUnionParts';
import type { BrassEnd } from './PpUnionParts';

/**
 * Концы: socket — ПП-корпус, раструб × раструб (VALTEC VTp.743 / 744); union-internal — латунный кран,
 * ПП-американка × внутренняя резьба (VTp.742); union — латунный кран, ПП-американки с двух сторон (VTp.745).
 */
export type PpBallValveEnds = 'socket' | 'union-internal' | 'union';

export interface PpBallValveParams {
  pipeNominal: string;
  ends: PpBallValveEnds;
  /** Резьба справа у union-internal. */
  threadNominal: string;
  /** Между торцами A, м. */
  length: number;
  /** От оси до верха ручки (H у VTp.743, B у VTp.742/745), м. */
  height: number;
  /** Длина ручки (B у VTp.743, C у VTp.742/745), м. */
  handleLength: number;
}

type Layout = { d: PartDiameters; socket: number; brass: BrassEnd | null; body: number };

/** Ручка: толщина и ширина, м — условно. */
const HANDLE = { thickness: 0.005, width: 0.014 };

const span = (from: number, to: number) => ({ length: to - from, center: { x: (from + to) / 2, y: 0, z: 0 } });

/**
 * ПП-шаровой кран (позиция 32): корпус с шаром посередине, шток и ручка вверх (+Y), проход по X.
 * Ручка ПП-крана — рычаг вдоль оси над корпусом, латунного — флажок, вынесенный вправо, как на чертежах VALTEC.
 * A, H/B, длина ручки и глубины раструбов — по каталогу 2017 (с. 139–146); диаметры корпуса и гаек — условно.
 */
export class PpBallValveGenerator extends BaseGenerator<PpBallValveParams, Layout> {
  readonly id = 'pp.ball-valve';
  readonly version = 1;
  readonly title = 'Кран шаровой для ПП';
  readonly defaults: PpBallValveParams = { pipeNominal: '20', ends: 'socket', threadNominal: '1/2', length: 0.07, height: 0.034, handleLength: 0.056 };
  readonly paramSpecs: readonly ParamSpec[] = [specs.ppNominal('pipeNominal'),
    { kind: 'choice', key: 'ends', label: 'Концы', options: ['socket', 'union-internal', 'union'],
      optionLabels: { socket: 'ПП, раструб × раструб', 'union-internal': 'латунь, американка × резьба (в)', union: 'латунь, американка × американка' } },
    { ...specs.threadNominal('threadNominal', 'Резьба'), when: { key: 'ends', values: ['union-internal'] } },
    specs.length('length', 'Длина', { max: 0.3 }), specs.length('height', 'Высота'), specs.length('handleLength', 'Ручка', { max: 0.3 })];

  protected override layout(p: PpBallValveParams): Layout {
    const d = PpPipeSizes.require(p.pipeNominal);
    const brass = p.ends === 'union-internal' ? brassEnd(p.threadNominal, 'internal') : null;
    return { d, socket: ppSocketDepth(p.pipeNominal), brass, body: d.n * 1.35 };
  }

  protected override relations(p: PpBallValveParams, l: Layout): ValidationError[] {
    const errors: ValidationError[] = [];
    const right = l.brass ? l.brass.length : l.socket + (p.ends === 'union' ? this.nutLength(l) : 0);
    const left = l.socket + (p.ends === 'socket' ? 0 : this.nutLength(l));
    const min = left + right + l.body * 0.5;
    if (p.length <= min) errors.push(ParamSchema.tooShort('length', min));
    const height = l.body / 2 + HANDLE.thickness + 0.004;
    if (p.height <= height) errors.push(ParamSchema.tooShort('height', height));
    return errors;
  }

  protected create(p: PpBallValveParams, l: Layout): GeneratedModel {
    const half = p.length / 2;
    const plastic = p.ends === 'socket';
    const material = plastic ? 'plastic' : 'metal';
    const merger = new MaterialGroupMerger();
    // Корпус: шар посередине и цилиндр до концов — до раструбов либо до латунного резьбового конца.
    const right = l.brass ? half - l.brass.length : half - l.socket;
    merger.add(spheres.build({ material, radius: l.body / 2 }),
      ...sleeves.build({ material, outerDiameter: l.d.n * 1.1, innerDiameter: l.d.v * 0.7, ...span(-half + l.socket, right) }));
    const pipePort = { nominal: p.pipeNominal, joint: 'pp-socket', gender: 'internal', depth: l.socket } as const;
    const connectors: Connector[] = [connector('left', ConnectorFrame.left, half, pipePort)];
    if (plastic) {
      merger.add(...ppSocket(l.d, -half, -half + l.socket), ...ppSocket(l.d, half - l.socket, half));
      connectors.push(connector('right', ConnectorFrame.right, half, pipePort));
    } else {
      merger.add(...this.unionHalf(l, -half, -1));
      if (l.brass) {
        merger.add(...brassEndParts(l.brass, half - l.brass.length, half));
        connectors.push(connector('right', ConnectorFrame.right, half,
          { nominal: p.threadNominal, joint: 'thread', gender: 'internal', depth: l.brass.size.depth }));
      } else {
        merger.add(...this.unionHalf(l, half, 1));
        connectors.push(connector('right', ConnectorFrame.right, half, pipePort));
      }
    }
    merger.add(...this.handle(p, l, plastic));
    const ends: Record<PpBallValveEnds, string> = { socket: '', 'union-internal': ` × ${p.threadNominal}(в)`, union: ', американки' };
    return createMeshModel({ title: `Кран шаровой ${plastic ? 'ПП' : 'латунный'} ${p.pipeNominal}${ends[p.ends]}`, ...merger.merge(), connectors });
  }

  private nutLength(l: Layout): number {
    return l.d.n * 0.3;
  }

  /** ПП-американка у торца end: приварная ПП-муфта (раструб) и латунная накидная гайка к корпусу; side −1 — слева. */
  private unionHalf(l: Layout, end: number, side: -1 | 1): GeometryPart[] {
    const socketInner = end - side * l.socket;
    const nutInner = socketInner - side * this.nutLength(l);
    return [...ppSocket(l.d, end, socketInner), ...ppUnionNut(l.d.n * 1.45, l.d.n, socketInner, nutInner)];
  }

  /** Шток и ручка: рычаг ПП-крана вдоль оси; флажок латунного — вправо от штока. */
  private handle(p: PpBallValveParams, l: Layout, plastic: boolean): GeometryPart[] {
    const top = p.height;
    const base = top - HANDLE.thickness;
    const stem = orientParts(sleeves.build({ material: plastic ? 'plastic' : 'metal', ...span(l.body / 2 - 0.002, base),
      outerDiameter: plastic ? l.d.n * 0.7 : 0.012, innerDiameter: 0 }), ConnectorFrame.top.direction);
    const from = plastic ? -p.handleLength / 2 : -0.012;
    const to = plastic ? p.handleLength / 2 : p.handleLength - 0.012;
    const w = HANDLE.width / 2;
    // Контур в плоскости XZ: выдавливается по +Z и поворачивается на −90° вокруг X — толщина идёт вверх по +Y.
    const lever = shapes.build({ material: plastic ? 'blue' : 'red', depth: HANDLE.thickness,
      points: [{ x: from, y: -w }, { x: to, y: -w }, { x: to, y: w }, { x: from, y: w }],
      rotation: { x: -Math.PI / 2, y: 0, z: 0 }, position: { x: 0, y: base, z: 0 } });
    return [...stem, lever];
  }
}
