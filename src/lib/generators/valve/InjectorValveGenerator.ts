import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { specs } from '../../params/specs';
import { armBodyDiameter, EUROCONE_TIP, euroconeArm, orientParts, threadedArm, threadedSize, unionNut } from '../ThreadedParts';
import { radiatorHandle } from './RadiatorValveParts';

export interface InjectorValveParams {
  /** Ручка: 'top' — сверху (VT.022), 'axial' — по оси, от радиатора (VT.025). */
  handle: 'top' | 'axial';
  /** Зонд-удлинитель потока от торца полусгона в нижний коллектор радиатора; режется по месту. */
  probeLength: number;
}

/**
 * VALTEC VT.022 / VT.025 (каталог 2017, с. 566, 569), м: A — от оси корпуса до торцов выходов,
 * B — шаг выходов, C — от оси ближнего выхода до торца к радиатору, D — диаметр зонда.
 * К радиатору — 1/2 Н с накидной гайкой, к трубам — евроконус 3/4.
 */
const SIZE = { a: 0.028, b: 0.04, c: 0.0385, probe: 0.012 };
const RADIATOR_NOMINAL = '1/2';
const EUROCONE_NOMINAL = '3/4';
/** Ручка и хвостовик корпуса, м — условно. */
const HANDLE = { diameter: 0.028, neck: 0.012, length: 0.03, tail: 0.015 };

/**
 * Инжекторный радиаторный клапан (позиция 101) — узел одноточечного бокового подключения радиатора
 * к однотрубной системе. Корпус по X, к радиатору +X; выходы вниз (−Y): ближний к радиатору (x = 0) —
 * выход из прибора (return), дальний (x = −B) — вход из сети (supply), по паспорту VALTEC.
 * Байпас и рассекатель внутри корпуса — не моделируются; доля затекания (100 / 50 %) на геометрию не влияет.
 */
export class InjectorValveGenerator extends BaseGenerator<InjectorValveParams> {
  readonly id = 'valve.injector';
  readonly version = 1;
  readonly title = 'Клапан радиаторный инжекторный';
  readonly defaults: InjectorValveParams = { handle: 'top', probeLength: 0.2 };
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'handle', label: 'Ручка', options: ['top', 'axial'], optionLabels: { top: 'сверху (VT.022)', axial: 'по оси (VT.025)' } },
    specs.length('probeLength', 'Зонд', { min: 0.05, max: 1.5, step: 0.005 }),
  ];

  protected create(p: InjectorValveParams): GeneratedModel {
    const radiator = threadedSize(RADIATOR_NOMINAL, 'external');
    const pipe = threadedSize(EUROCONE_NOMINAL, 'external');
    const body = armBodyDiameter(pipe, 'external');
    const far = -SIZE.b;
    const start = p.handle === 'axial' ? far - HANDLE.tail : far - body / 2;
    const merger = new MaterialGroupMerger();
    merger.add(
      ...sleeves.build({ material: 'metal', length: body / 2 - start, outerDiameter: body, innerDiameter: 0,
        center: { x: (start + body / 2) / 2, y: 0, z: 0 } }),
      ...threadedArm(radiator, 'external', SIZE.c), ...unionNut(radiator, SIZE.c - 1.5 * radiator.depth),
      ...sleeves.build({ material: 'black', length: p.probeLength, outerDiameter: SIZE.probe, innerDiameter: SIZE.probe * 0.75,
        center: { x: SIZE.c + p.probeLength / 2, y: 0, z: 0 } }),
    );
    for (const x of [0, far]) merger.add(...orientParts(euroconeArm(pipe, SIZE.a), ConnectorFrame.bottom.direction, { x, y: 0, z: 0 }));
    if (p.handle === 'top') {
      const neckTop = body / 2 + HANDLE.neck;
      merger.add(...orientParts([
        ...sleeves.build({ material: 'metal', length: neckTop, outerDiameter: body * 0.7, innerDiameter: 0, center: { x: neckTop / 2, y: 0, z: 0 } }),
        ...radiatorHandle(neckTop, neckTop + HANDLE.length, HANDLE.diameter),
      ], ConnectorFrame.top.direction, { x: far, y: 0, z: 0 }));
    } else {
      merger.add(...orientParts(radiatorHandle(0, HANDLE.length, HANDLE.diameter), ConnectorFrame.left.direction, { x: start, y: 0, z: 0 }));
    }
    const eurocone = { nominal: EUROCONE_NOMINAL, joint: 'eurocone', gender: 'external', depth: pipe.depth + EUROCONE_TIP } as const;
    return createMeshModel({
      title: `Клапан инжекторный ${RADIATOR_NOMINAL} × ${EUROCONE_NOMINAL} ЕК, ручка ${p.handle === 'top' ? 'сверху' : 'по оси'}`,
      ...merger.merge(),
      connectors: [
        connector('radiator', ConnectorFrame.right, SIZE.c, { nominal: RADIATOR_NOMINAL, joint: 'thread', gender: 'external', depth: radiator.depth }),
        connector('return', ConnectorFrame.bottom, { x: 0, y: -SIZE.a, z: 0 }, eurocone),
        connector('supply', ConnectorFrame.bottom, { x: far, y: -SIZE.a, z: 0 }, eurocone),
      ],
    });
  }
}
