import { snowEffect } from "./effects/snow";
import { treeEffect } from "./effects/tree";
import { createGraphicsSession } from "./service";

export const createChristmasScene = (canvas: HTMLCanvasElement, failed: () => void) =>
  createGraphicsSession(canvas, [treeEffect, snowEffect], failed, 5.2);
