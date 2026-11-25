// MediaPipe loader (vendored in /vendor/mediapipe, fetched only when a tracking mode starts).
// Each tracker tries the GPU delegate first; if it fails at start OR keeps failing at run time it is rebuilt on CPU.
const BASE = "/vendor/mediapipe/";
const FILESET = { wasmLoaderPath: BASE + "vision_wasm_internal.js", wasmBinaryPath: BASE + "vision_wasm_internal.wasm" };
let lib = null, lastTs = 0;
async function vision() { if (!lib) lib = await import(BASE + "vision_bundle.mjs"); return lib; }
function ts() { const t = performance.now(); lastTs = t > lastTs ? t : lastTs + 1; return lastTs; }   // strictly increasing
async function make(cls, model, extra, delegates) {
  const v = await vision(); let err;
  for (const delegate of delegates) {
    try { return { det: await v[cls].createFromOptions(FILESET, Object.assign({ baseOptions: { modelAssetPath: BASE + model, delegate }, runningMode: "VIDEO" }, extra)), delegate }; }
    catch (e) { err = e; }
  }
  throw err || new Error("tracker");
}
async function tracker(cls, model, extra, call, valid) {
  let cur = await make(cls, model, extra, ["GPU", "CPU"]), fails = 0, swapping = false, dead = false;
  return {
    run(video) {
      if (swapping || dead || !cur) return null;
      let r = null; try { r = cur.det[call](video, ts()); } catch (e) { r = null; }
      if (r && (!valid || valid(r))) { fails = 0; return r; }
      if (++fails >= 4) {
        if (cur.delegate === "GPU") { swapping = true; const old = cur; cur = null; try { old.det.close(); } catch (e) {}
          make(cls, model, extra, ["CPU"]).then(c => { cur = c; fails = 0; swapping = false; }, () => { dead = true; swapping = false; }); }
        else if (fails >= 90) dead = true;
      }
      return null;
    },
    get dead() { return dead; },
    get delegate() { return cur ? cur.delegate : "-"; },
    close() { try { if (cur) cur.det.close(); } catch (e) {} cur = null; dead = true; }
  };
}
export const hands = (n = 2) => tracker("HandLandmarker", "hand_landmarker.task", { numHands: n }, "detectForVideo");
export const pose = () => tracker("PoseLandmarker", "pose_landmarker_lite.task", { numPoses: 1 }, "detectForVideo");
export const segmenter = () => tracker("ImageSegmenter", "selfie_segmenter.tflite", { outputCategoryMask: false, outputConfidenceMasks: true }, "segmentForVideo", r => !!(r.confidenceMasks && r.confidenceMasks[0]));
