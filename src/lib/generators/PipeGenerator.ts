import { CylinderGeometry } from 'three';
import { BaseGenerator } from '../core/BaseGenerator';
import { connector } from '../core/connector';
import { ConnectorFrame } from '../core/ConnectorFrame';
import type { ConnectorJoint, GeneratedModel, ParamSpec } from '../core/contracts';
import { createMeshModel } from '../core/MeshModel';
import { specs } from '../params/specs';
import { MpPipeSizes } from '../sizes/MpPipeSizes';
import { PpPipeSizes } from '../sizes/PpPipeSizes';

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
export class PipeGenerator extends BaseGenerator<PipeParams> {
  readonly id = 'createTubeWF_1';
  readonly title = 'Труба';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'type', label: 'Тип', options: ['pp', 'mp'], optionLabels: { pp: 'Полипропилен', mp: 'Металлопластик' } },
    { kind: 'choice', key: 'ppSize', label: 'Диаметр, мм', options: PpPipeSizes.nominals, when: { key: 'type', values: ['pp'] } },
    { kind: 'choice', key: 'mpSize', label: 'Диаметр, мм', options: MpPipeSizes.nominals, when: { key: 'type', values: ['mp'] } },
    specs.length('length', 'Длина', { min: 0.01, max: 10, step: 0.001 }),
  ];

  protected create(params: PipeParams): GeneratedModel {
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
    return createMeshModel({
      // Название как в gl2 ('труба 20 (1м)', длина до 0,01 м) с типом трубы.
      title: `Труба ${TYPE_LABELS[params.type]} ${nominal} (${Math.round(params.length * 100) / 100}м)`,
      geometry,
      materials: ['pipe'],
      connectors: [
        connector('start', ConnectorFrame.left, { x: -half, y: 0, z: 0 }, common),
        connector('end', ConnectorFrame.right, { x: half, y: 0, z: 0 }, common),
      ],
    });
  }
}
