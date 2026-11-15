import { BufferAttribute, BufferGeometry, Points, ShaderMaterial } from "three";
import { disposeObject } from "../dispose";
import { artHeight, artWidth, lampLevel, lamps } from "../treeModel";
import type { EffectFactory } from "../types";

// One batch for all lamp cores and halos. The paper and wire beneath them are
// the same vector layers used by the static scene.
export function treeLights(canvas: HTMLCanvasElement): EffectFactory {
  return ({ scene }) => {
    const geometry = new BufferGeometry();
    const positions = new BufferAttribute(new Float32Array(lamps.length * 3), 3);
    geometry.setAttribute("position", positions);
    const diameter = { value: 24 };
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: { dpr: { value: Math.min(devicePixelRatio, 1.5) }, diameter },
      vertexShader: `uniform float dpr,diameter; varying float level;
        void main(){level=position.z;gl_Position=vec4(position.xy,0.,1.);gl_PointSize=diameter*dpr;}`,
      fragmentShader: `varying float level;
        void main(){float r=length(gl_PointCoord-.5)*2.;
          float core=1.-smoothstep(.105,.22,r);
          float glow=exp(-r*r*7.)*(1.-smoothstep(.75,1.,r));
          vec3 color=mix(vec3(1.,.72,.32),vec3(1.,.98,.84),core);
          gl_FragColor=vec4(color,core*(.27+.73*level)+(1.-core)*glow*.56*level);}`,
    });
    const bulbs = new Points(geometry, material);
    bulbs.frustumCulled = false;
    scene.add(bulbs);
    return {
      update(time) {
        const w = Math.max(1, canvas.clientWidth);
        const paper = Math.min(440, w);
        diameter.value = 18 + paper * 0.034;
        lamps.forEach((lamp, i) => {
          positions.setXYZ(
            i,
            ((lamp.x / artWidth - 0.5) * 2 * paper) / w,
            1 - (2 * lamp.y) / artHeight,
            lampLevel(lamp, time),
          );
        });
        positions.needsUpdate = true;
      },
      dispose() {
        disposeObject(bulbs);
      },
    };
  };
}
