import type { OrthographicCamera, Scene } from "three";

export type EffectContext = { readonly scene: Scene; readonly camera: OrthographicCamera };
export type GraphicsEffect = {
  readonly update: (elapsedSeconds: number) => void;
  readonly dispose: () => void;
};
export type EffectFactory = (context: EffectContext) => GraphicsEffect;
export type GraphicsSession = {
  readonly ready: Promise<void>;
  readonly setPaused: (paused: boolean) => void;
  readonly dispose: () => void;
};
