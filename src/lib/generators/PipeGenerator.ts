import { CylinderGeometry } from 'three';
import type { ConnectorJoint, GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { ParamSchema } from '../params/ParamSchema';
import { MpPipeSizes } from '../sizes/MpPipeSizes';
import { PpPipeSizes } from '../sizes/PpPipeSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';

/** 'pp' — полипропилен, 'mp' — металлопластик. */
export type PipeType = 'pp' | 'mp';

export interface PipeParams {
  type: PipeType;
  /** Номинал ПП-трубы по sizeTubePP — наружный диаметр, мм, строкой; при type 'pp'. */
  ppSize?: string;
  /** Номинал МП-трубы по sizeTubeMP; при type 'mp'. */
  mpSize?: string;
  /** Длина, м. */
  length: number;
}

/** Граней по окружности — radiusSegments в TubeN. */
const RADIAL_SEGMENTS = 12;

const TYPE_LABELS: Readonly<Record<PipeType, string>> = { pp: 'ПП', mp: 'МП' };
const JOINTS: Readonly<Record<PipeType, ConnectorJoint>> = { pp: 'pp-socket', mp: 'mp-press' };

/**
 * Прямая труба (геометрия createTubeWF_1 / TubeN из gl2 без редактирования точек).
 * ПП и МП строятся одинаково — открытый цилиндр по наружному диаметру; отличаются
 * номиналами и способом соединения разъёмов.
 */
export class PipeGenerator implements ModelGenerator<PipeParams> {
  readonly id = 'createTubeWF_1';
  readonly title = 'Труба';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'type', label: 'Тип', options: ['pp', 'mp'], optionLabels: { pp: 'Полипропилен', mp: 'Металлопластик' } },
    { kind: 'choice', key: 'ppSize', label: 'Диаметр, мм', options: PpPipeSizes.nominals, when: { key: 'type', values: ['pp'] } },
    { kind: 'choice', key: 'mpSize', label: 'Диаметр, мм', options: MpPipeSizes.nominals, when: { key: 'type', values: ['mp'] } },
    { kind: 'length', key: 'length', label: 'Длина', min: 0.01, max: 10, step: 0.001 },
  ];

  validate(params: PipeParams): ValidationError[] {
    return ParamSchema.validate(this.paramSpecs, params);
  }

  build(params: PipeParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const nominal = params.type === 'pp' ? params.ppSize! : params.mpSize!;
    // Номинал — наружный диаметр трубы: он же внутренний диаметр раструба и гильзы (v = d).
    const diameter = Number(nominal) / 1000;
    const half = params.length / 2;

    const cylinder = new CylinderGeometry(diameter / 2, diameter / 2, params.length, RADIAL_SEGMENTS, 1, true);
    cylinder.rotateZ(-Math.PI / 2);
    const geometry = cylinder.toNonIndexed();
    cylinder.dispose();

    // Труба входит в фитинг: разъём наружный, глубина — половина трубы, ввод ограничивает фитинг.
    const common = { depth: half, nominal, joint: JOINTS[params.type], gender: 'external' } as const;
    return MeshModel.create({
      // Название как в gl2 ('труба 20 (1м)', длина до 0,01 м) с типом трубы.
      title: `Труба ${TYPE_LABELS[params.type]} ${nominal} (${Math.round(params.length * 100) / 100}м)`,
      geometry,
      materials: ['pipe'],
      connectors: [
        { id: 'start', position: { x: -half, y: 0, z: 0 }, ...ConnectorFrame.left, ...common },
        { id: 'end', position: { x: half, y: 0, z: 0 }, ...ConnectorFrame.right, ...common },
      ],
    });
  }
}
