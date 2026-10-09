import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import { SphereGeometryBuilder } from '../geometry/SphereGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { PpPipeSizes } from '../sizes/PpPipeSizes';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';
import { PP_THREAD_MATERIALS, PpThreadInsert } from './PpThreadInsert';
import type { ThreadSideCode } from './SteelElbowGenerator';

/** Параметры в формате cdm из gl2. */
export interface PpThreadElbowParams {
  /** Сторона резьбы на правом выходе. */
  side: ThreadSideCode;
  /** Наружный диаметр ПП-трубы, мм, строкой. */
  r1: string;
  /** Дюймовый номинал резьбы. */
  r2: string;
  /** Длина плеча от оси до торца раструба, м. */
  m1: number;
}

/** Длина раструба и резьбового участка (x_1 в gl2), м. */
const SOCKET_LENGTH = 0.015;

/**
 * Полипропиленовый угол 90° с резьбой (перенос pl_ugol_90_rezba_1): вверх — раструб
 * под пайку, вправо — металлическая резьбовая вставка в 12-гранном корпусе.
 */
export class PpThreadElbowGenerator implements ModelGenerator<PpThreadElbowParams> {
  readonly id = 'pl_ugol_90_rezba_1';
  readonly title = 'Угол ПП 90° с резьбой';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'side', label: 'Резьба', options: ['v', 'n'], optionLabels: { v: 'внутренняя', n: 'наружная' } },
    { kind: 'choice', key: 'r1', label: 'Труба, мм', options: PpPipeSizes.nominals },
    { kind: 'choice', key: 'r2', label: 'Номинал резьбы', options: ThreadSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина плеча', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly spheres = new SphereGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: PpThreadElbowParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0 && params.m1 <= SOCKET_LENGTH) errors.push(ParamSchema.tooShort('m1', SOCKET_LENGTH));
    return errors;
  }

  build(params: PpThreadElbowParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d1 = PpPipeSizes.diameters(params.r1)!;
    const insert = new PpThreadInsert(params.side, params.r2, d1);
    const x1 = SOCKET_LENGTH;
    const x2 = params.m1 - x1;
    const pipe = { outerDiameter: d1.n, innerDiameter: d1.v };
    const vertical = { rotation: { x: 0, y: 0, z: -Math.PI / 2 } };
    const quarter = { phiLength: Math.PI / 2, rotation: { x: Math.PI / 2, y: 0, z: 0 } };
    const bodyCenter = x2 + x1 / 2;

    const merger = new MaterialGroupMerger();
    merger.add(
      // Вправо: труба, корпус вставки, резьбовая втулка
      ...this.sleeves.build({ ...pipe, length: x2, center: { x: x2 / 2, y: 0, z: 0 } }),
      ...this.sleeves.build({
        length: x1,
        outerDiameter: insert.body.n,
        innerDiameter: insert.body.v,
        outerSegments: 12,
        center: { x: bodyCenter, y: 0, z: 0 },
        materials: { outer: PP_THREAD_MATERIALS.plasticFlat },
      }),
      ...this.sleeves.build({
        length: x1,
        outerDiameter: insert.thread.n,
        innerDiameter: insert.thread.v,
        center: { x: insert.insertCenter(bodyCenter, x1), y: 0, z: 0 },
        materials: insert.materials,
      }),
      // Вверх: труба и раструб
      ...this.sleeves.build({ ...pipe, ...vertical, length: x2, center: { x: 0, y: x2 / 2, z: 0 } }),
      ...this.sleeves.build({ ...pipe, ...vertical, length: x1, center: { x: 0, y: x2 + x1 / 2, z: 0 } }),
      this.spheres.build({ ...quarter, radius: d1.n / 2 }),
      this.spheres.build({ ...quarter, radius: d1.v / 2 }),
    );

    // Раструб: торец — конец плеча, глубина — длина раструба. Резьба: торец — край втулки,
    // глубина — длина втулки. В gl2 точки стояли в центрах раструба и втулки.
    const face = insert.face(params.m1, x1);
    return MeshModel.create({
      title: `Угол ${params.r1}x${params.r2}${insert.suffix}`,
      geometry: merger.merge(),
      materials: [this.materials.get('plastic'), this.materials.get('plasticFlat'), this.materials.get('metal'), this.materials.get('thread')],
      connectors: [
        {
          id: 'right',
          position: ConnectorFrame.point(ConnectorFrame.right, face),
          ...ConnectorFrame.right,
          depth: x1,
          nominal: params.r2,
          joint: 'thread',
          gender: insert.gender,
        },
        {
          id: 'top',
          position: ConnectorFrame.point(ConnectorFrame.top, params.m1),
          ...ConnectorFrame.top,
          depth: x1,
          nominal: params.r1,
          joint: 'pp-socket',
          gender: 'internal',
        },
      ],
    });
  }
}
