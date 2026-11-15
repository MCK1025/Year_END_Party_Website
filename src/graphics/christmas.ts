import { snowfall } from "./effects/snow";
import { treeLights } from "./effects/tree";
import { createGraphicsSession } from "./service";

export const createChristmasScene = (
  canvas: HTMLCanvasElement,
  failed: () => void,
  initiallyPaused = false,
) => createGraphicsSession(canvas, [treeLights(canvas), snowfall(canvas)], failed, 5.2, { initiallyPaused });
