import {
  BackSide,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";
import { curlColumns } from "./pageCurlShape";
import { createGraphicsSession } from "./service";
export function createPageCurl(
  canvas: HTMLCanvasElement,
  image: HTMLCanvasElement,
  progress: () => number,
  firstFrame: () => void,
  fail: () => void,
) {
  const width = (2 * canvas.clientWidth) / canvas.clientHeight;
  return createGraphicsSession(
    canvas,
    [
      ({ scene }) => {
        const texture = new CanvasTexture(image);
        texture.colorSpace = SRGBColorSpace;
        texture.generateMipmaps = false;
        texture.minFilter = LinearFilter;
        const geometry = new PlaneGeometry(width, 2, 52, 6);
        const positions = geometry.getAttribute("position");
        const colors = new Float32BufferAttribute(new Float32Array(positions.count * 3), 3);
        geometry.setAttribute("color", colors);
        const front = new MeshBasicMaterial({ map: texture, vertexColors: true, toneMapped: false });
        const back = new MeshBasicMaterial({
          color: new Color(0xf7f3e8),
          vertexColors: true,
          side: BackSide,
          toneMapped: false,
        });
        const a = new Mesh(geometry, front),
          b = new Mesh(geometry, back);
        a.frustumCulled = false;
        b.frustumCulled = false;
        scene.add(a, b);
        return {
          update() {
            const p = progress();
            const strips = Array.from({ length: 7 }, (_, row) =>
              curlColumns(p + (0.5 - row / 6) * 0.46 * p * (1 - p), 52),
            );
            for (let i = 0; i < positions.count; i++) {
              const row = Math.floor(i / 53);
              const col = strips[row]?.[i % 53];
              if (!col) continue;
              positions.setX(i, (col.x - 0.5) * width);
              positions.setZ(i, col.z * width * 0.65);
              positions.setY(i, 1 - row / 3 + col.z * (0.12 - row * 0.013));
              colors.setXYZ(i, col.shade, col.shade, col.shade);
            }
            positions.needsUpdate = true;
            colors.needsUpdate = true;
          },
          dispose() {
            scene.remove(a, b);
            texture.dispose();
            geometry.dispose();
            front.dispose();
            back.dispose();
          },
        };
      },
    ],
    fail,
    2,
    { compile: () => {}, activity: () => {}, firstFrame, ephemeralCanvas: true },
  );
}
