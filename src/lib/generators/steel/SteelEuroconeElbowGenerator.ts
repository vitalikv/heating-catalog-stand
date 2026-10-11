import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { angleCorner, EUROCONE_TIP, euroconeArm, orientParts, threadedArm, threadedSize, unionNut } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';

export interface SteelEuroconeElbowParams {
  /** Резьба евроконуса обоих концов; VALTEC выпускает только 3/4. */
  nominal: string;
  /** Плечо от оси до торца, м. */
  armLength: number;
}
type Layout = { nut: ThreadedSize; cone: ThreadedSize };

/**
 * Угольник под евроконус (позиция 87) по образцу VALTEC VTr.092.NE 3/4 × 3/4 (фото-каталог, с. 65;
 * размеров в каталогах нет — условные). Вход — накидная гайка на выход евроконуса коллектора или клапана,
 * выход — наружный евроконус под фитинг (адаптер 63); поворот на 90°. Никелированная латунь.
 * Заготовка: вход по −X, выход вниз (−Y).
 */
export class SteelEuroconeElbowGenerator extends BaseGenerator<SteelEuroconeElbowParams, Layout> {
  readonly id = 'steel.eurocone-elbow';
  readonly version = 1;
  readonly title = 'Угольник под евроконус';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'nominal', label: 'Евроконус', options: ['3/4'] },
    specs.length('armLength', 'Плечо', { min: 0.015, max: 0.06 }),
  ];
  readonly defaults: SteelEuroconeElbowParams = { nominal: '3/4', armLength: 0.028 };

  protected override layout(p: SteelEuroconeElbowParams): Layout {
    return { nut: threadedSize(p.nominal, 'internal'), cone: threadedSize(p.nominal, 'external') };
  }

  /** На каждом плече после резьбы остаётся гладкий участок не короче 5 мм, как у H-блока. */
  protected override relations(p: SteelEuroconeElbowParams, d: Layout): ValidationError[] {
    const minimum = Math.max(d.nut.depth, d.cone.depth + EUROCONE_TIP) + 0.005;
    return p.armLength <= minimum ? [ParamSchema.tooShort('armLength', minimum)] : [];
  }

  protected create(p: SteelEuroconeElbowParams, d: Layout): GeneratedModel {
    const inlet = ConnectorFrame.left;
    const outlet = ConnectorFrame.bottom;
    const merger = new MaterialGroupMerger();
    merger.add(
      ...orientParts([...threadedArm(d.nut, 'internal', p.armLength), ...unionNut(d.nut, p.armLength - d.nut.depth / 2)], inlet.direction),
      ...orientParts(euroconeArm(d.cone, p.armLength), outlet.direction),
      // Конус у основания выхода не заходит на резьбу.
      ...angleCorner(d.nut, d.cone, inlet.direction, outlet.direction, p.armLength - EUROCONE_TIP - d.cone.depth),
    );
    return createMeshModel({
      title: `Угольник евроконус ${p.nominal}(г) × ${p.nominal}(н)`,
      ...merger.merge(),
      connectors: [
        connector('inlet', inlet, p.armLength, { nominal: p.nominal, joint: 'eurocone', gender: 'internal', depth: d.nut.depth }),
        connector('outlet', outlet, p.armLength, { nominal: p.nominal, joint: 'eurocone', gender: 'external', depth: d.cone.depth + EUROCONE_TIP }),
      ],
    });
  }
}
