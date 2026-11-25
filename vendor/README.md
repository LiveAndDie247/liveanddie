# vendored third-party files (served locally, loaded only when a command needs them)

- `mediapipe/` - MediaPipe Tasks Vision 0.10.14 (`vision_bundle.mjs`, wasm) and the models
  `hand_landmarker.task`, `pose_landmarker_lite.task`, `selfie_segmenter.tflite`.
  (c) Google LLC, Apache License 2.0. https://github.com/google-ai-edge/mediapipe
  Used by `cam --hands / --synth / --into / --dance`. All inference runs on the visitor's device.
