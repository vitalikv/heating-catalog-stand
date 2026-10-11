import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';

export interface StraightStrainerParams {
  /** Номинал резьбы концов: '1/2' или '3/4'. */
  nominal: string;
  /** Концы: В–В (VALTEC VT.388, VT.385) или Н–В (VT.387, наружная — вход слева). */
  ends: 'internal' | 'external-internal';
  /** Длина между торцами, м. */
  length: number;
  /** Высота от верха концов до низа колбы, м (H на чертеже VALTEC). */
  height: number;
  /** Низ колбы: пробка с накаткой (VT.387, VT.388) или порт G1/2 под пробку либо сливной кран (VT.385). */
  bottom: 'cap' | 'port';
}

type Layout = { internal: ThreadedSize; external: ThreadedSize; port: ThreadedSize };

/** Шестигранник конца к наружному диаметру резьбы; колба к длине — VT.384/388: 37 / 54 (условно). */
const NUT_SCALE = 1.236;
const BOWL_SHARE = 0.68;
/** Наружный конец: доля шестигранника у корпуса (условно). */
const COLLAR_SHARE = 0.35;
/** Пробка колбы — нижние 40 % высоты колбы, накатка 12 граней (условно). */
const CAP_SHARE = 0.4;

/** Верх концов над осью: половина размера шестигранника под ключ — H на чертеже отсчитывается от грани. */
const hexTop = (size: ThreadedSize) => ((size.n * NUT_SCALE) / 2) * Math.cos(Math.PI / 6);

const span = (from: number, to: number) => ({ length: to - from, center: { x: (from + to) / 2, y: 0, z: 0 } });
const spanY = (from: number, to: number) => ({ length: to - from, center: { x: 0, y: (from + to) / 2, z: 0 }, rotation: { x: 0, y: 0, z: Math.PI / 2 } });

/**
 * Прямой сетчатый фильтр (позиция 120) по образцу VALTEC VT.385/387/388 (технический каталог 2017,
 * с. 340–342): проход по X, колба вниз (−Y) — монтаж колбой вниз. Длина и высота для 1/2 — по
 * чертежам, для 3/4 — условно. Корпус, колба и пробка — никелированная латунь.
 */
export class StraightStrainerGenerator extends BaseGenerator<StraightStrainerParams, Layout> {
  readonly id = 'equipment.strainer-straight';
  readonly version = 1;
  readonly title = 'Фильтр прямой';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'nominal', label: 'Резьба', options: ['1/2', '3/4'] },
    { kind: 'choice', key: 'ends', label: 'Концы', options: ['internal', 'external-internal'], optionLabels: { internal: 'В–В', 'external-internal': 'Н–В' } },
    { kind: 'length', key: 'length', label: 'Длина', min: 0.03, max: 0.1, step: 0.0005 },
    { kind: 'length', key: 'height', label: 'Высота H', min: 0.03, max: 0.1, step: 0.0005 },
    { kind: 'choice', key: 'bottom', label: 'Низ колбы', options: ['cap', 'port'], optionLabels: { cap: 'пробка', port: 'порт G1/2' } },
  ];
  readonly defaults: StraightStrainerParams = { nominal: '1/2', ends: 'internal', length: 0.054, height: 0.046, bottom: 'cap' };

  protected override layout(p: StraightStrainerParams): Layout {
    return { internal: threadedSize(p.nominal, 'internal'), external: threadedSize(p.nominal, 'external'), port: threadedSize('1/2', 'internal') };
  }

  protected override relations(p: StraightStrainerParams, d: Layout): ValidationError[] {
    const errors: ValidationError[] = [];
    // Между резьбами остаётся корпус не короче 10 мм; колба опускается ниже концов.
    const minimumLength = 2 * d.internal.depth + 0.01;
    if (p.length <= minimumLength) errors.push(ParamSchema.tooShort('length', minimumLength));
    // Колба опускается ниже гаек концов хотя бы на 10 мм.
    const minimumHeight = 2 * hexTop(d.internal) + 0.01;
    if (p.height <= minimumHeight) errors.push(ParamSchema.tooShort('height', minimumHeight));
    return errors;
  }

  protected create(p: StraightStrainerParams, d: Layout): GeneratedModel {
    const half = p.length / 2;
    const bottom = hexTop(d.internal) - p.height;
    const bowl = p.length * BOWL_SHARE;
    const inlet = p.ends === 'external-internal';
    const merger = new MaterialGroupMerger();

    // Концы: внутренняя резьба в шестиграннике; наружная — шестигранник у корпуса и резьба до торца.
    const end = (sign: -1 | 1, external: boolean) => {
      const face = sign * half;
      const inner = sign * (half - d.internal.depth);
      if (!external) {
        const [from, to] = sign < 0 ? [face, inner] : [inner, face];
        return sleeves.build({ material: 'metal', ...span(from, to), outerDiameter: d.internal.n * NUT_SCALE, innerDiameter: d.internal.v,
          outerSegments: 6, materials: { outer: 'metalFlat', inner: 'thread' } });
      }
      const collar = d.internal.depth * COLLAR_SHARE;
      const collarEnd = sign * (half - d.internal.depth + collar);
      const pairs = [[inner, collarEnd], [collarEnd, face]].map(([a, b]) => (a < b ? [a, b] : [b, a]));
      return [
        ...sleeves.build({ material: 'metal', ...span(pairs[0][0], pairs[0][1]), outerDiameter: d.internal.n * NUT_SCALE, innerDiameter: d.external.v,
          outerSegments: 6, materials: { outer: 'metalFlat' } }),
        ...sleeves.build({ material: 'metal', ...span(pairs[1][0], pairs[1][1]), outerDiameter: d.external.n, innerDiameter: d.external.v,
          materials: { outer: 'thread' } }),
      ];
    };
    merger.add(
      ...end(-1, inlet),
      ...sleeves.build({ material: 'metal', ...span(-half + d.internal.depth, half - d.internal.depth), outerDiameter: d.internal.n, innerDiameter: d.internal.v }),
      ...end(1, false),
    );

    // Колба: от оси вниз; низ — пробка с накаткой или шейка с внутренней резьбой G1/2 (VT.385).
    const connectors: Connector[] = [];
    if (p.bottom === 'cap') {
      const capTop = bottom * (1 - CAP_SHARE);
      merger.add(
        ...sleeves.build({ material: 'metal', ...spanY(capTop, 0), outerDiameter: bowl * 0.9, innerDiameter: 0 }),
        ...sleeves.build({ material: 'metal', ...spanY(bottom, capTop), outerDiameter: bowl, innerDiameter: 0, outerSegments: 12, materials: { outer: 'metalFlat' } }),
      );
    } else {
      const port = d.port;
      const neckTop = bottom + port.depth;
      merger.add(
        ...sleeves.build({ material: 'metal', ...spanY(neckTop, 0), outerDiameter: bowl * 0.9, innerDiameter: 0 }),
        ...sleeves.build({ material: 'metal', ...spanY(bottom, neckTop), outerDiameter: bowl * 0.9, innerDiameter: port.v, materials: { inner: 'thread' } }),
      );
      connectors.push(connector('service', ConnectorFrame.bottom, { x: 0, y: bottom, z: 0 }, { nominal: '1/2', joint: 'thread', gender: 'internal', depth: port.depth }));
    }

    const ends = inlet ? 'н-в' : 'в-в';
    return createMeshModel({
      title: `Фильтр прямой ${p.nominal}(${ends})${p.bottom === 'port' ? ', порт 1/2' : ''}`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, half, inlet
          ? { nominal: p.nominal, joint: 'thread', gender: 'external', depth: d.internal.depth * (1 - COLLAR_SHARE) }
          : { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: d.internal.depth }),
        connector('right', ConnectorFrame.right, half, { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: d.internal.depth }),
        ...connectors,
      ],
    });
  }
}
