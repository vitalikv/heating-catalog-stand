import {
  AmbientLight,
  AxesHelper,
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  type Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** Сцена просмотра. Свет и камера повторяют настройки src-heating. */
export class Viewer {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(75, 1, 0.001, 100);
  readonly renderer: WebGLRenderer;
  readonly controls: OrbitControls;
  readonly grid: GridHelper;
  readonly axes: AxesHelper;

  private readonly container: HTMLElement;
  private readonly resizeObserver: ResizeObserver;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene.background = new Color(0xffffff);
    this.scene.add(new AmbientLight(0xffffff, 0.5 * Math.PI));

    const cameraLight = new DirectionalLight(0xffffff, 1.5);
    cameraLight.position.set(0, 0.5, 1);
    cameraLight.target.position.set(0, 0, -1);
    this.camera.add(cameraLight, cameraLight.target);
    this.scene.add(this.camera);

    // Детали отопления — сантиметры, поэтому сетка 0,5 м с шагом 1 см.
    this.grid = new GridHelper(0.5, 50, 0x999999, 0xe0e0e0);
    this.axes = new AxesHelper(0.1);
    this.scene.add(this.grid, this.axes);

    this.camera.position.set(0.12, 0.08, 0.15);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  /** Наводит камеру на объект, сохраняя направление взгляда. */
  frame(object: Object3D): void {
    const box = new Box3().setFromObject(object);
    if (box.isEmpty()) return;

    const center = box.getCenter(new Vector3());
    const radius = box.getSize(new Vector3()).length() / 2;
    const distance = radius / Math.sin((this.camera.fov * Math.PI) / 360);
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();

    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(direction, distance * 1.2);
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
