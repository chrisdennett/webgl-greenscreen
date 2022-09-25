import { getFlippedVideoCanvas } from "./utils/getFlippedVideoCanvas.js";
import { reloadAfterMs } from "./utils/setupWebcam.js";
import { drawArtCanvas } from "./utils/drawArtCanvas.js";
import {
  drawGreenscreen,
  setupGreenScreenShader,
} from "./utils/drawGreenscreen.js";

// app elements
const videoColorSelector = document.querySelector("#videoHolder");
const video = document.querySelector("#videoElement");

const selfieCanvas = document.createElement("canvas");
const selfieCtx = selfieCanvas.getContext("2d");
const greenscreenCanvas = setupGreenScreenShader();

let glfxCanvas, texture;

let cameraSetUp = false;
const useMediaPipe = false;

// draw loop
export function draw({ webcamRes, params, img1 }) {
  // if (!params) reloadAfterMs();

  if (video.srcObject && !video.srcObject.active) {
    reloadAfterMs();
    return;
  }

  if (useMediaPipe && !cameraSetUp) {
    cameraSetUp = true;
    setUpCamera(webcamRes);
  }

  const frameCanvas = getFlippedVideoCanvas({
    canvas: useMediaPipe ? selfieCanvas : null,
    video: useMediaPipe ? null : video,
    crop: {
      left: params.cropLeft,
      right: params.cropRight,
      top: params.cropTop,
      bottom: params.cropBottom,
    },
    scale: params.size,
    flipX: true,
    flipY: false,
  });

  drawGreenscreen({ sourceCanvas: frameCanvas, params });
  drawGlFxCanvas({ sourceCanvas: greenscreenCanvas, params });
  drawArtCanvas({ sourceCanvas: glfxCanvas, params, img: img1 });

  // controls
  videoColorSelector.style.display = params.showColorDropper
    ? "inherit"
    : "none";
}

function setUpCamera(webcamRes) {
  selfieCanvas.width = webcamRes.w;
  selfieCanvas.height = webcamRes.h;

  function onResults(results) {
    selfieCtx.save();
    selfieCtx.clearRect(0, 0, selfieCanvas.width, selfieCanvas.height);
    selfieCtx.drawImage(results.segmentationMask, 0, 0);

    // Only overwrite missing pixels.
    selfieCtx.globalCompositeOperation = "source-in";
    selfieCtx.drawImage(results.image, 0, 0);

    selfieCtx.restore();
  }

  const selfieSegmentation = new SelfieSegmentation({
    locateFile: (file) => {
      return `/libs/mediapipe/selfie_segmentation/${file}`;
    },
  });

  selfieSegmentation.setOptions({ modelSelection: 1 });
  selfieSegmentation.onResults(onResults);

  const camera = new Camera(video, {
    onFrame: async () => {
      await selfieSegmentation.send({ image: video });
    },
    width: webcamRes.w,
    height: webcamRes.h,
  });
  camera.start();
}

function drawGlFxCanvas({ sourceCanvas, params }) {
  if (!sourceCanvas) return;

  if (!glfxCanvas) {
    // fx loaded in index.html script tag
    glfxCanvas = fx.canvas();
  }

  if (glfxCanvas && sourceCanvas) {
    texture = glfxCanvas.texture(sourceCanvas);
    let gc = glfxCanvas.draw(texture);
    gc.sepia(params.sepia);

    // gc.lensBlur(
    //   params.lensBlurRadius,
    //   params.lensBlurBrightness,
    //   params.lensBlurAngle
    // );
    // gc.triangleBlur(params.triangleBlur);
    gc.brightnessContrast(params.brightness, params.contrast);
    gc.denoise(params.denoise);
    // gc.hueSaturation(params.hue, params.saturation);
    // gc.unsharpMask(params.unsharpRadius, params.unsharpStrength);
    gc.vibrance(params.vibrance);
    gc.ink(params.ink);

    // if (params.edgeWork > 0) {
    //   gc.edgeWork(params.edgeWork);
    // }

    gc.noise(params.noise);

    gc.update();
  }
}
