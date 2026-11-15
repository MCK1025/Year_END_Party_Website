import { afterEach, expect, it, vi } from "vitest";
import { createGraphicsSession } from "../../src/graphics/service";

const gpu = vi.hoisted(() => ({
  compile: vi.fn<() => Promise<void>>(),
  dispose: vi.fn(),
  loop: vi.fn(),
}));
vi.mock("three", async (original) => ({
  ...(await original<typeof import("three")>()),
  WebGLRenderer: class {
    compileAsync = gpu.compile;
    dispose = gpu.dispose;
    setAnimationLoop = gpu.loop;
    setPixelRatio() {}
  },
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function surface() {
  class Observer {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", new EventTarget());
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal("ResizeObserver", Observer);
  vi.stubGlobal("IntersectionObserver", Observer);
  return Object.assign(new EventTarget(), { clientWidth: 390, clientHeight: 600 }) as HTMLCanvasElement;
}
it("a late compile from the disposed session cannot resume it or dispose its replacement", async () => {
  let resolveShader = () => {};
  const pending = new Promise<void>((resolve) => {
    resolveShader = resolve;
  });
  gpu.compile.mockReturnValueOnce(pending).mockResolvedValueOnce(undefined);
  const canvas = surface();
  const oldEffect = { update: vi.fn(), dispose: vi.fn() };
  const currentEffect = { update: vi.fn(), dispose: vi.fn() };
  const first = createGraphicsSession(canvas, [() => oldEffect], vi.fn());
  await Promise.resolve();
  first.dispose();
  first.dispose();
  const current = createGraphicsSession(canvas, [() => currentEffect], vi.fn());
  await current.ready;
  const calls = gpu.loop.mock.calls.length;
  resolveShader();
  await first.ready;
  expect(gpu.loop).toHaveBeenCalledTimes(calls);
  expect(gpu.dispose).toHaveBeenCalledTimes(1);
  expect(oldEffect.dispose).toHaveBeenCalledTimes(1);
  expect(currentEffect.dispose).not.toHaveBeenCalled();
  current.dispose();
  expect(currentEffect.dispose).toHaveBeenCalledTimes(1);
});
it("partial initialization releases previous effects and the newly allocated renderer", () => {
  const firstEffect = { update: vi.fn(), dispose: vi.fn() };
  expect(() =>
    createGraphicsSession(
      surface(),
      [
        () => firstEffect,
        () => {
          throw new Error("factory failure");
        },
      ],
      vi.fn(),
    ),
  ).toThrow("factory failure");
  expect(firstEffect.dispose).toHaveBeenCalledTimes(1);
  expect(gpu.dispose).toHaveBeenCalledTimes(1);
});
