import { CylinderGeometry } from 'three';
import { connector } from '../core/connector';
import { ConnectorFrame } from '../core/ConnectorFrame';
import type { ConnectorJoint, GeneratedModel } from '../core/contracts';
import { createMeshModel } from '../core/MeshModel';

/** Граней по окружности — radiusSegments в TubeN. */
const RADIAL_SEGMENTS = 12;

/**
 * Прямая труба (геометрия createTubeWF_1 / TubeN из gl2 без редактирования точек): открытый
 * цилиндр по наружному диаметру. ПП и МП отличаются номиналами и способом соединения.
 * label — 'ПП' или 'МП' для названия; nominal — наружный диаметр, мм, строкой.
 */
export function createStraightPipe(label: string, joint: ConnectorJoint, nominal: string, length: number): GeneratedModel {
  // Номинал — наружный диаметр трубы: он же внутренний диаметр раструба и гильзы (v = d).
  const diameter = Number(nominal) / 1000;
  const half = length / 2;

  const cylinder = new CylinderGeometry(diameter / 2, diameter / 2, length, RADIAL_SEGMENTS, 1, true);
  cylinder.rotateZ(-Math.PI / 2);
  const geometry = cylinder.toNonIndexed();
  cylinder.dispose();

  // Труба входит в фитинг: разъём наружный, глубина — половина трубы, ввод ограничивает фитинг.
  const end = { depth: half, nominal, joint, gender: 'external' } as const;
  return createMeshModel({
    // Название как в gl2 ('труба 20 (1м)', длина до 0,01 м) с типом трубы.
    title: `Труба ${label} ${nominal} (${Math.round(length * 100) / 100}м)`,
    geometry,
    materials: ['pipe'],
    connectors: [connector('start', ConnectorFrame.left, half, end), connector('end', ConnectorFrame.right, half, end)],
  });
}
