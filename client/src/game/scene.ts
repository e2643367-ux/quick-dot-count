// ルミナ・パルス: Babylonは観測フィールドのキャンバスだけを描き、ルールはDotSnapGameに分離する。
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Engine } from "@babylonjs/core/Engines/engine";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Scene } from "@babylonjs/core/scene";
import type { DotPoint } from "./DotSnapGame";

export type FieldBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type GameHandle = {
  scene: Scene;
  setDots: (dots: DotPoint[], visible: boolean) => void;
  setFieldBounds: (bounds: FieldBounds) => void;
  dispose: () => void;
};

const PALETTE: Record<DotPoint["accent"], Color3> = {
  lime: Color3.FromHexString("#DDFE5B"),
  coral: Color3.FromHexString("#FF735C"),
  sky: Color3.FromHexString("#8BD8FF"),
};

export async function createGameScene(engine: Engine, _canvas: HTMLCanvasElement): Promise<GameHandle> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);
  const camera = new FreeCamera("observation-camera", new Vector3(0, 0, 10), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.setTarget(Vector3.Zero());

  const dots: DotPoint[] = [];
  const meshes: ReturnType<typeof MeshBuilder.CreateDisc>[] = [];
  let visible = false;
  let bounds: FieldBounds = { left: 0, top: 0, width: 1, height: 1 };

  const applyProjection = () => {
    const width = Math.max(engine.getRenderWidth(), 1);
    const height = Math.max(engine.getRenderHeight(), 1);
    const aspect = width / height;
    camera.orthoLeft = -aspect;
    camera.orthoRight = aspect;
    camera.orthoTop = 1;
    camera.orthoBottom = -1;

    meshes.forEach((mesh, index) => {
      const dot = dots[index];
      const pixelX = bounds.left + dot.x * bounds.width;
      const pixelY = bounds.top + dot.y * bounds.height;
      mesh.position.x = ((pixelX / width) * 2 - 1) * aspect;
      mesh.position.y = 1 - (pixelY / height) * 2;
      mesh.isVisible = visible;
    });
  };

  const clearDots = () => {
    while (meshes.length) {
      const mesh = meshes.pop();
      mesh?.material?.dispose();
      mesh?.dispose();
    }
  };

  const setDots = (nextDots: DotPoint[], nextVisible: boolean) => {
    clearDots();
    dots.splice(0, dots.length, ...nextDots);
    visible = nextVisible;
    const renderDots = nextDots.slice(0, 180);
    const radius = Math.max(0.006, Math.min(0.043, 0.19 / Math.sqrt(nextDots.length)));
    renderDots.forEach((dot, index) => {
      const mesh = MeshBuilder.CreateDisc(`dot-${index}`, { radius, tessellation: 20 }, scene);
      const material = new StandardMaterial(`dot-material-${index}`, scene);
      material.diffuseColor = PALETTE[dot.accent];
      material.emissiveColor = PALETTE[dot.accent].scale(0.82);
      material.specularColor = Color3.Black();
      mesh.material = material;
      meshes.push(mesh);
    });
    applyProjection();
  };

  const onBeforeRender = () => applyProjection();
  scene.onBeforeRenderObservable.add(onBeforeRender);

  return {
    scene,
    setDots,
    setFieldBounds(nextBounds) {
      bounds = nextBounds;
      applyProjection();
    },
    dispose() {
      scene.onBeforeRenderObservable.removeCallback(onBeforeRender);
      clearDots();
      scene.dispose();
    },
  };
}
