# vendored third-party files (served locally, loaded only when a command needs them)

- `mediapipe/` - MediaPipe Tasks Vision 0.10.14 (`vision_bundle.mjs`, wasm) and the models
  `hand_landmarker.task`, `pose_landmarker_lite.task`, `selfie_segmenter.tflite`.
  (c) Google LLC, Apache License 2.0. https://github.com/google-ai-edge/mediapipe
  Used by `cam --hands / --synth / --into / --dance`. All inference runs on the visitor's device.
- `trystero/` - Trystero 0.21.8 (torrent strategy, unbundled ES modules from `src/`). (c) Dan Motzenbecker, MIT.
  https://github.com/dmotz/trystero  Used by `who / talk / party / jam`: browser-to-browser WebRTC, signalled through
  public WebTorrent trackers. There is no live.and.die server.
- `qr/qrcode.js` - qrcode-generator 1.4.4, (c) Kazuhiko Arase, MIT. https://github.com/kazuhikoarase/qrcode-generator  (used by `poster` and tools/make-print-codes.js)
- `qr/jsQR.js` - jsQR 1.4.0, (c) Cosmo Wolfe, Apache License 2.0. https://github.com/cozmo/jsQR  (fallback reader for `scan` where BarcodeDetector is missing)
