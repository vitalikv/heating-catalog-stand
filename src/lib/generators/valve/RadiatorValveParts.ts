import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { SEAT_DEPTH } from '../manifold/ManifoldInserts';
import { EUROCONE_TIP, euroconeArm, orientParts, threadedArm, threadedSize, unionNut, valveHead } from '../ThreadedParts';

/**
 * Форма корпуса: angle — вход снизу, головка вверх; straight — вход слева, головка вверх;
 * axial — вход снизу, головка соосна выходу к радиатору и смотрит от него (−X), как VALTEC VT.179.
 */
export type RadiatorValveForm = 'angle' | 'straight' | 'axial';
/** Головка: колпачок, встроенная термоголовка либо 'none' — открытое посадочное место M30×1,5. */
export type RadiatorValveHead = 'cap' | 'thermostatic' | 'none';
/** Сторона трубы: внутренняя резьба номинала клапана либо наружный евроконус 3/4 (VALTEC *.NER). */
export type RadiatorPipeEnd = 'internal' | 'eurocone';

export interface RadiatorValveDimensions { nominal: string; armLength: number }

/** Плечи от оси штока до торцов, м, и исполнение концов. */
export interface RadiatorValveShape {
  nominal: string;
  inletLength: number;
  radiatorLength: number;
  /** Нет — внутренняя резьба (параметры версии 1). */
  pipeEnd?: RadiatorPipeEnd;
}

/** Евроконус выпускается только 1/2 к радиатору × 3/4 ЕК к трубе (VT.031/032/019/020.NER). */
export const EUROCONE_VALVE_NOMINAL = '1/2';
const EUROCONE_NOMINAL = '3/4';
/** Посадочное место: шейка до резьбы M30×1,5 и сама резьба, м — условно. */
const SEAT = { neck: 0.012, neckDiameter: 0.026, diameter: 0.03 };
const HEAD_NOMINAL = 'M30x1.5';

export function radiatorValveLayout(p: { nominal: string; pipeEnd?: RadiatorPipeEnd }) {
  const body = threadedSize(p.nominal, 'internal');
  return {
    /** Размер корпуса — по внутренней резьбе номинала, как у исполнения В–Н. */
    body,
    pipe: p.pipeEnd === 'eurocone' ? threadedSize(EUROCONE_NOMINAL, 'external') : body,
    outer: threadedSize(p.nominal, 'external'),
  };
}
export type RadiatorValveLayout = ReturnType<typeof radiatorValveLayout>;

/** Параметр pipeEnd; addedIn — для генераторов, где он появился позже. */
export function pipeEndSpec(addedIn?: number): ParamSpec {
  return { kind: 'choice', key: 'pipeEnd', label: 'К трубе', options: ['internal', 'eurocone'],
    optionLabels: { internal: 'резьба (в)', eurocone: 'евроконус 3/4' }, ...(addedIn ? { addedIn } : {}) };
}

/** Параметр head; 'none' — посадочное место под термоголовку или привод. */
export const HEAD_SPEC: ParamSpec = { kind: 'choice', key: 'head', label: 'Головка', options: ['cap', 'thermostatic', 'none'],
  optionLabels: { cap: 'колпачок', thermostatic: 'термоголовка', none: 'нет (M30×1,5)' } };

/**
 * Минимальные плечи: со стороны трубы — резьба или евроконус и половина корпуса,
 * к радиатору — резьба и гайка полусгона. Ключи плеч у старых генераторов совпадают (armLength):
 * тогда одна ошибка по большему минимуму, как в версии 1.
 */
export function radiatorValveErrors(p: RadiatorValveShape, d: RadiatorValveLayout,
  keys = { inlet: 'inletLength', radiator: 'radiatorLength' }): ValidationError[] {
  if (p.pipeEnd === 'eurocone' && p.nominal !== EUROCONE_VALVE_NOMINAL) {
    return [{ code: 'incompatible', param: 'pipeEnd', message: `Евроконус 3/4 — только у клапанов ${EUROCONE_VALVE_NOMINAL}` }];
  }
  const pipeEnd = p.pipeEnd === 'eurocone' ? d.pipe.depth + EUROCONE_TIP : d.pipe.depth;
  const inletMin = pipeEnd + d.body.n / 2;
  const radiatorMin = 2 * d.outer.depth + 0.004;
  if (keys.inlet === keys.radiator) {
    const min = Math.max(inletMin, radiatorMin);
    return p.inletLength <= min ? [ParamSchema.tooShort(keys.inlet, min)] : [];
  }
  return [
    ...(p.inletLength <= inletMin ? [ParamSchema.tooShort(keys.inlet, inletMin)] : []),
    ...(p.radiatorLength <= radiatorMin ? [ParamSchema.tooShort(keys.radiator, radiatorMin)] : []),
  ];
}

/** Посадочное место M30×1,5 по +X от height: шейка и резьба. */
function headSeat(height: number): GeometryPart[] {
  const thread = height + SEAT.neck;
  return [
    ...sleeves.build({ material: 'metal', length: SEAT.neck, outerDiameter: SEAT.neckDiameter, innerDiameter: 0,
      center: { x: height + SEAT.neck / 2, y: 0, z: 0 } }),
    ...sleeves.build({ material: 'metal', length: SEAT_DEPTH, outerDiameter: SEAT.diameter, innerDiameter: 0,
      center: { x: thread + SEAT_DEPTH / 2, y: 0, z: 0 }, materials: { outer: 'thread' } }),
  ];
}

/** Конец со стороны трубы по +X до reach: внутренняя резьба либо наружная резьба 3/4 с носиком евроконуса. */
function pipeArm(d: RadiatorValveLayout, pipeEnd: RadiatorPipeEnd | undefined, reach: number): GeometryPart[] {
  return pipeEnd === 'eurocone' ? euroconeArm(d.pipe, reach) : threadedArm(d.pipe, 'internal', reach);
}

/**
 * Корпус с полусгоном: выход к радиатору +X; вход −X (straight) либо −Y (angle, axial);
 * головка +Y либо −X (axial). Порт head — только у открытого посадочного места.
 */
export function createRadiatorValve(p: RadiatorValveShape, d: RadiatorValveLayout,
  form: RadiatorValveForm, head: RadiatorValveHead, title: string): GeneratedModel {
  const input = form === 'straight' ? ConnectorFrame.left : ConnectorFrame.bottom;
  const headFrame = form === 'axial' ? ConnectorFrame.left : ConnectorFrame.top;
  const headBase = d.body.n / 2;
  const merger = new MaterialGroupMerger();
  merger.add(...orientParts(pipeArm(d, p.pipeEnd, p.inletLength), input.direction),
    ...threadedArm(d.outer, 'external', p.radiatorLength), ...unionNut(d.outer, p.radiatorLength - 1.5 * d.outer.depth),
    ...sleeves.build({ material: 'metal', length: d.body.n, outerDiameter: d.body.n * 1.2,
      innerDiameter: 0, rotation: { x: 0, y: 0, z: Math.PI / 2 } }),
    ...(head === 'none' ? orientParts(headSeat(headBase), headFrame.direction) : valveHead(headBase, head === 'thermostatic', headFrame.direction)));
  const connectors: Connector[] = [
    connector('inlet', input, p.inletLength, p.pipeEnd === 'eurocone'
      ? { nominal: EUROCONE_NOMINAL, joint: 'eurocone', gender: 'external', depth: d.pipe.depth + EUROCONE_TIP }
      : { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: d.pipe.depth }),
    connector('radiator', ConnectorFrame.right, p.radiatorLength, { nominal: p.nominal, joint: 'thread', gender: 'external', depth: d.outer.depth }),
  ];
  if (head === 'none') {
    connectors.push(connector('head', headFrame, headBase + SEAT.neck + SEAT_DEPTH,
      { nominal: HEAD_NOMINAL, joint: 'valve-head', gender: 'external', depth: SEAT_DEPTH }));
  }
  const nominal = p.pipeEnd === 'eurocone' ? `${p.nominal} × ${EUROCONE_NOMINAL} ЕК` : p.nominal;
  return createMeshModel({ title: `${title} ${nominal}`, ...merger.merge(), connectors });
}


/**
 * Ручка ручной регулировки по +X от base до top: рифлёный пластиковый маховичок, расширяющийся кверху,
 * со скруглённым верхом (VALTEC VT.004, VT.022/025) — форма условная.
 */
export function radiatorHandle(base: number, top: number, diameter: number): GeometryPart[] {
  const crown = top - Math.min(0.006, (top - base) / 4);
  return [
    ...sleeves.build({ material: 'plastic', length: crown - base, outerDiameterStart: diameter * 0.8, outerDiameter: diameter,
      innerDiameter: 0, outerSegments: 12, center: { x: (base + crown) / 2, y: 0, z: 0 }, materials: { outer: 'plasticFlat' } }),
    ...sleeves.build({ material: 'plastic', length: top - crown, outerDiameterStart: diameter, outerDiameter: diameter * 0.7,
      innerDiameter: 0, center: { x: (crown + top) / 2, y: 0, z: 0 } }),
  ];
}
