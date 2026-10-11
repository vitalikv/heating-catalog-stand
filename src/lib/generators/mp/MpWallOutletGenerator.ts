import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ThreadGender, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { shapes } from '../../geometry/ExtrudedShapeBuilder';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { spheres } from '../../geometry/SphereGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { MpPipeSizes } from '../../sizes/MpPipeSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';
import { orientParts, threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';
import { COMPRESSION_NOMINALS, MpCompressionEnd } from './MpCompressionEnd';
import type { CompressionSize } from './MpCompressionEnd';
import { MpPressEnd } from './MpPressEnd';

export interface MpWallOutletParams {
  pipeNominal: string;
  /** Конец трубы: пресс (VTm.254 / 255) или обжим (VTm.354 / 355). */
  pipeEnd: 'press' | 'compression';
  threadNominal: string;
  threadGender: ThreadGender;
  /** От оси резьбы до торца трубного конца, A, м. */
  pipeArm: number;
  /** От плоскости ушек до торца резьбы, B, м. */
  height: number;
}

type Layout = {
  pipe: PartDiameters;
  press: number;
  compression: CompressionSize | null;
  thread: ThreadedSize;
  body: number;
  /** От оси трубы до плоскости ушек, м. */
  base: number;
};

/** Ушки: толщина, размах от оси по Z, ширина по X, отверстие, м — условно. */
export const OUTLET_EARS = { thickness: 0.003, reach: 0.022, width: 0.012, hole: 0.0026 };

/**
 * МП-водорозетка с крепёжными ушками (позиция 35) по VALTEC VTm.254 / 255 (пресс, каталог 2017, с. 49)
 * и VTm.354 / 355 (обжим, с. 39). Резьба выхода вверх (+Y) — от стены; трубный конец вправо (+X);
 * ушки — в плоскости стены y = −base, вдоль Z. Начало координат — пересечение осей резьбы и трубы.
 * A и B — по каталогу; корпус, ушки и положение плоскости стены — условно.
 */
export class MpWallOutletGenerator extends BaseGenerator<MpWallOutletParams, Layout> {
  readonly id = 'mp.wall-outlet';
  readonly version = 1;
  readonly title = 'Водорозетка МП';
  readonly defaults: MpWallOutletParams = { pipeNominal: '16', pipeEnd: 'press', threadNominal: '1/2', threadGender: 'internal', pipeArm: 0.047, height: 0.04 };
  readonly paramSpecs: readonly ParamSpec[] = [specs.mpNominal('pipeNominal'),
    { kind: 'choice', key: 'pipeEnd', label: 'Конец трубы', options: ['press', 'compression'], optionLabels: { press: 'пресс', compression: 'обжим' } },
    specs.threadNominal('threadNominal', 'Резьба'), specs.threadGender(),
    specs.length('pipeArm', 'Плечо к трубе'), specs.length('height', 'Высота от стены')];

  protected override layout(p: MpWallOutletParams): Layout {
    const pipe = MpPipeSizes.require(p.pipeNominal);
    const thread = threadedSize(p.threadNominal, p.threadGender);
    const compression = p.pipeEnd === 'compression' && COMPRESSION_NOMINALS.includes(p.pipeNominal) ? MpCompressionEnd.size(p.pipeNominal) : null;
    const body = Math.max(pipe.n, thread.n * 1.2);
    return { pipe, press: MpPressEnd.pressLength(pipe), compression, thread, body, base: body / 2 + 0.002 };
  }

  protected override relations(p: MpWallOutletParams, l: Layout): ValidationError[] {
    const errors: ValidationError[] = [];
    if (p.pipeEnd === 'compression' && !l.compression) {
      return [{ code: 'incompatible', param: 'pipeEnd', message: `Обжимного конца для трубы ${p.pipeNominal} нет (ряд VTm.300: ${COMPRESSION_NOMINALS.join(', ')})` }];
    }
    const arm = l.compression ? MpCompressionEnd.minReach(l.compression, l.body) : l.press + l.body / 2;
    if (p.pipeArm <= arm) errors.push(ParamSchema.tooShort('pipeArm', arm));
    const height = l.base + l.body / 2 + l.thread.depth;
    if (p.height <= height) errors.push(ParamSchema.tooShort('height', height));
    return errors;
  }

  protected create(p: MpWallOutletParams, l: Layout): GeneratedModel {
    const top = p.height - l.base;
    const merger = new MaterialGroupMerger();
    const quarter = { phiLength: Math.PI / 2, rotation: { x: Math.PI / 2, y: 0, z: 0 } };
    merger.add(
      // Корпус: стакан от стены до начала резьбы и колено к трубному концу.
      ...orientParts(sleeves.build({ material: 'metal', length: top - l.thread.depth + l.base, outerDiameter: l.body, innerDiameter: 0,
        center: { x: (top - l.thread.depth - l.base) / 2, y: 0, z: 0 } }), ConnectorFrame.top.direction),
      ...this.threadPart(l, top, p.threadGender),
      spheres.build({ material: 'metal', ...quarter, radius: l.body / 2 }),
      this.ears(l),
    );
    if (l.compression) {
      merger.add(...MpCompressionEnd.arm(l.compression, p.pipeArm));
    } else {
      const start = p.pipeArm - l.press;
      merger.add(...sleeves.build({ material: 'metal', length: start, outerDiameter: l.pipe.n, innerDiameter: l.pipe.v * 0.6, center: { x: start / 2, y: 0, z: 0 } }),
        ...new MpPressEnd().build(l.pipe, start, l.press, MpPressEnd.right));
    }
    const pipePort = l.compression ? MpCompressionEnd.end(p.pipeNominal, l.compression)
      : { nominal: p.pipeNominal, joint: 'mp-press', gender: 'internal', depth: l.press } as const;
    return createMeshModel({
      title: `Водорозетка ${p.pipeEnd === 'press' ? 'пресс' : 'обжим'} ${p.pipeNominal} × ${p.threadNominal}${p.threadGender === 'internal' ? '(в)' : '(н)'}`,
      ...merger.merge(),
      connectors: [
        connector('thread', ConnectorFrame.top, top, { nominal: p.threadNominal, joint: 'thread', gender: p.threadGender, depth: l.thread.depth }),
        connector('pipe', ConnectorFrame.right, p.pipeArm, pipePort),
      ],
    });
  }

  /** Резьба выхода на торце top: внутренняя — в стакане корпуса, наружная — патрубок. */
  private threadPart(l: Layout, top: number, gender: ThreadGender): GeometryPart[] {
    const span = { length: l.thread.depth, center: { x: top - l.thread.depth / 2, y: 0, z: 0 } };
    return orientParts(gender === 'internal'
      ? sleeves.build({ material: 'metal', ...span, outerDiameter: l.body, innerDiameter: l.thread.n, materials: { inner: 'thread' } })
      : sleeves.build({ material: 'metal', ...span, outerDiameter: l.thread.n, innerDiameter: l.thread.v, materials: { outer: 'thread' } }),
    ConnectorFrame.top.direction);
  }

  /** Ушки в плоскости стены: пластина вдоль Z с отверстиями под саморезы. */
  private ears(l: Layout): GeometryPart {
    const { thickness, reach, width, hole } = OUTLET_EARS;
    // Контур в плоскости XY (X — вдоль трубы, Y — вдоль стены, потом станет Z); выдавливание −90° по X — по +Y.
    return shapes.build({ material: 'metal', depth: thickness,
      points: [{ x: -width / 2, y: -reach }, { x: width / 2, y: -reach }, { x: width / 2, y: reach }, { x: -width / 2, y: reach }],
      holes: [{ x: 0, y: -reach + width / 2, radius: hole }, { x: 0, y: reach - width / 2, radius: hole }],
      rotation: { x: -Math.PI / 2, y: 0, z: 0 }, position: { x: 0, y: -l.base, z: 0 } });
  }
}
