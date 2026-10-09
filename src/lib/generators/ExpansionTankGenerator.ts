import { CylinderGeometry, SphereGeometry } from 'three';
import type { BufferGeometry } from 'three';
import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';

/** Объёмы из наборов start.js: в gl2 — строка name, только для названия. */
export const EXPANSION_TANK_VOLUMES = ['6л', '8л', '10л', '12л', '18л', '24л'] as const;

/** Параметры в формате cdm из gl2. */
export interface ExpansionTankParams {
  /** Диаметр бака, м. */
  d: number;
  /** Высота бака с днищами, м. */
  h1: number;
  /** Номинал наружной резьбы штуцера, например '3/4'. */
  r1: string;
  /** Объём для названия: '6л'. */
  name: string;
}

const SEGMENTS = 32;
/** Днища — полусферы, сжатые по высоте вдвое. */
const DOME_SCALE = 0.5;
/** Втулка под штуцером (h3) и резьба штуцера (h4), м. */
const COLLAR = 0.01;
const FITTING = 0.015;
/** Втулка заходит в нижнее днище на 5 мм. */
const COLLAR_INSET = 0.005;

/** Расширительный бак: цилиндр с днищами, штуцер с наружной резьбой вниз (перенос cr_rash_bak_1). */
export class ExpansionTankGenerator implements ModelGenerator<ExpansionTankParams> {
  readonly id = 'cr_rash_bak_1';
  readonly title = 'Бак расширительный';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'length', key: 'd', label: 'Диаметр', min: 0.05, max: 1, step: 0.001 },
    { kind: 'length', key: 'h1', label: 'Высота', min: 0.05, max: 2, step: 0.001 },
    { kind: 'choice', key: 'r1', label: 'Резьба штуцера (н)', options: ThreadSizes.nominals },
    { kind: 'choice', key: 'name', label: 'Объём', options: EXPANSION_TANK_VOLUMES },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();

  validate(params: ExpansionTankParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    // Цилиндрическая часть h2 = h1 − d/2 нулевой высоты считается ошибкой.
    if (errors.length === 0 && params.h1 <= params.d / 2) errors.push(ParamSchema.tooShort('h1', params.d / 2));
    return errors;
  }

  build(params: ExpansionTankParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d2 = ThreadSizes.diameters(params.r1, 'external')!;
    const radius = params.d / 2;
    const h2 = params.h1 - radius;
    // Низ нижнего днища; от него вниз — втулка и штуцер.
    const bottom = -h2 / 2 - radius * DOME_SCALE;
    const collarTop = bottom + COLLAR_INSET;
    const down = { x: 0, y: 0, z: -Math.PI / 2 };
    const fitting = { outerDiameter: d2.n, innerDiameter: d2.v, rotation: down };

    const shell = new CylinderGeometry(radius, radius, h2, SEGMENTS, 1, true);
    const merger = new MaterialGroupMerger();
    merger.add(
      { geometry: this.nonIndexed(shell), material: 'red' },
      { geometry: this.dome(radius, Math.PI, h2 / 2), material: 'red' },
      { geometry: this.dome(radius, 0, -h2 / 2), material: 'red' },
      ...this.sleeves.build({ material: 'metal', ...fitting, length: COLLAR, center: { x: 0, y: collarTop - COLLAR / 2, z: 0 } }),
      ...this.sleeves.build({ material: 'thread', ...fitting, length: FITTING, center: { x: 0, y: collarTop - COLLAR - FITTING / 2, z: 0 } }),
    );

    // Торец — конец штуцера, глубина — его резьба. В gl2 точка — в центре штуцера.
    return MeshModel.create({
      title: `Расш.бак ${params.name}`,
      ...merger.merge(),
      connectors: [
        {
          id: 'bottom',
          position: { x: 0, y: collarTop - COLLAR - FITTING, z: 0 },
          ...ConnectorFrame.bottom,
          depth: FITTING,
          nominal: params.r1,
          joint: 'thread',
          gender: 'external',
        },
      ],
    });
  }

  /**
   * Днище: полусфера SphereGeometry(r, 32, 32, 0, π), повёрнутая вниз (rotateX π/2),
   * для верхнего — ещё на turnZ = π, сжатая по Y и сдвинутая на y.
   */
  private dome(radius: number, turnZ: number, y: number): BufferGeometry {
    const sphere = new SphereGeometry(radius, SEGMENTS, SEGMENTS, 0, Math.PI);
    sphere.rotateX(Math.PI / 2).rotateZ(turnZ);
    sphere.scale(1, DOME_SCALE, 1);
    sphere.translate(0, y, 0);
    return this.nonIndexed(sphere);
  }

  private nonIndexed(indexed: BufferGeometry): BufferGeometry {
    const geometry = indexed.toNonIndexed();
    indexed.dispose();
    return geometry;
  }
}
