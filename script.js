const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('overlay');
const canvasCtx = canvasElement.getContext('2d');

let currentMode = null;
let earringImg = null;
let necklaceImg = null;
let earringSrc = '';
let necklaceSrc = '';
let lastSnapshotDataURL = '';
let currentType = '';
let smoothedLandmarks = null;

// store smoothed positions for earrings & necklace
let smoothedFacePoints = {};

// ---------- Image loading helpers ----------
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
}

function changeEarring(src) {
  earringSrc = src;
  loadImage(earringSrc).then(img => {
    if (img) earringImg = img;
  });
}

function changeNecklace(src) {
  necklaceSrc = src;
  loadImage(necklaceSrc).then(img => {
    if (img) necklaceImg = img;
  });
}

// ---------- Category & options ----------
function toggleCategory(category) {
  document.getElementById('subcategory-buttons').style.display = 'flex';
  const subButtons = document.querySelectorAll('#subcategory-buttons button');

  subButtons.forEach(btn => {
    btn.style.display = btn.innerText.toLowerCase().includes(category)
      ? 'inline-block'
      : 'none';
  });

  document.getElementById('jewelry-options').style.display = 'none';
}

function selectJewelryType(type) {
  currentType = type;
  document.getElementById('jewelry-options').style.display = 'flex';

  // Clear previously loaded images when switching category
  earringImg = null;
  necklaceImg = null;
  earringSrc = '';
  necklaceSrc = '';

  let start = 1, end = 15;

  switch (type) {
    case 'gold_earrings':     end = 16; break;
    case 'gold_necklaces':    end = 19; break;
    case 'diamond_earrings':  end = 9;  break;
    case 'diamond_necklaces': end = 6;  break;
    default:                  end = 15;
  }

  insertJewelryOptions(type, 'jewelry-options', start, end);
}

function insertJewelryOptions(type, containerId, startIndex, endIndex) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  for (let i = startIndex; i <= endIndex; i++) {
    const filename = `${type}${i}.png`;
    const btn = document.createElement('button');
    const img = document.createElement('img');
    img.src = `${type}/${filename}`;
    btn.appendChild(img);

    btn.onclick = () => {
      if (type.includes('earrings')) {
        changeEarring(`${type}/${filename}`);
      } else {
        changeNecklace(`${type}/${filename}`);
      }
    };

    container.appendChild(btn);
  }
}

// ---------- Mediapipe FaceMesh ----------
const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6
});

faceMesh.onResults((results) => {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    const newLandmarks = results.multiFaceLandmarks[0];

    if (!smoothedLandmarks) {
      smoothedLandmarks = newLandmarks;
    } else {
      smoothedLandmarks = smoothedLandmarks.map((prev, i) => ({
        x: prev.x * 0.8 + newLandmarks[i].x * 0.2,
        y: prev.y * 0.8 + newLandmarks[i].y * 0.2,
        z: prev.z * 0.8 + newLandmarks[i].z * 0.2,
      }));
    }

    drawJewelry(smoothedLandmarks, canvasCtx);
  } else {
    smoothedLandmarks = null;
  }
});

// Camera
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({ image: videoElement });
  },
  width: 1280,
  height: 720
});

videoElement.addEventListener('loadedmetadata', () => {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
});

camera.start();

// ---------- Helpers for smoothing ----------
function smoothPoint(prev, current, factor = 0.4) {
  if (!prev) return current;
  return {
    x: prev.x * (1 - factor) + current.x * factor,
    y: prev.y * (1 - factor) + current.y * factor
  };
}

// ---------- Jewelry positioning & sizing ----------
function drawJewelry(landmarks, ctx) {
  if (!landmarks) return;

  const cw = canvasElement.width;
  const ch = canvasElement.height;

  // Use eye distance as a reference for scaling
  const Leye = landmarks[33];
  const Reye = landmarks[263];
  const dx = (Reye.x - Leye.x) * cw;
  const dy = (Reye.y - Leye.y) * ch;
  const eyeDist = Math.hypot(dx, dy); // approximate face width

  // Key landmarks
  const leftEarLm  = landmarks[132];
  const rightEarLm = landmarks[361];
  const neckLm     = landmarks[152];

  // Raw positions
  let leftEarPos = {
    x: leftEarLm.x * cw,
    y: leftEarLm.y * ch
  };
  let rightEarPos = {
    x: rightEarLm.x * cw,
    y: rightEarLm.y * ch
  };
  let neckPos = {
    x: neckLm.x * cw,
    y: neckLm.y * ch
  };

  // Smooth positions across frames
  smoothedFacePoints.leftEar  = smoothPoint(smoothedFacePoints.leftEar,  leftEarPos,  0.4);
  smoothedFacePoints.rightEar = smoothPoint(smoothedFacePoints.rightEar, rightEarPos, 0.4);
  smoothedFacePoints.neck     = smoothPoint(smoothedFacePoints.neck,     neckPos,     0.4);

  // ===== Earrings =====
  if (earringImg) {
    const w = eyeDist * 0.42;
    const h = w * (earringImg.height / earringImg.width);
    const yOffset = -h * 0.10;

    ctx.drawImage(
      earringImg,
      smoothedFacePoints.leftEar.x - w / 2,
      smoothedFacePoints.leftEar.y + yOffset,
      w,
      h
    );
    ctx.drawImage(
      earringImg,
      smoothedFacePoints.rightEar.x - w / 2,
      smoothedFacePoints.rightEar.y + yOffset,
      w,
      h
    );
  }

  // ===== Necklace (new tuning) =====
  if (necklaceImg) {
    // Overall size
    const w = eyeDist * 1.8; // widen a bit
    const h = w * (necklaceImg.height / necklaceImg.width);

    // Place the CENTER of the necklace box slightly below neck point
    const centerYOffset = eyeDist * 0.55; // higher/lower on chest
    const drawX = smoothedFacePoints.neck.x - w / 2;
    const drawY = smoothedFacePoints.neck.y + centerYOffset - h / 2;

    ctx.drawImage(necklaceImg, drawX, drawY, w, h);
  }
}

// ---------- Snapshot logic (unchanged) ----------
function takeSnapshot() {
  if (!smoothedLandmarks) {
    alert("Face not detected. Please try again.");
    return;
  }

  const snapshotCanvas = document.createElement('canvas');
  const ctx = snapshotCanvas.getContext('2d');
  snapshotCanvas.width = videoElement.videoWidth;
  snapshotCanvas.height = videoElement.videoHeight;

  ctx.drawImage(videoElement, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
  drawJewelry(smoothedLandmarks, ctx);

  lastSnapshotDataURL = snapshotCanvas.toDataURL('image/png');
  document.getElementById('snapshot-preview').src = lastSnapshotDataURL;
  document.getElementById('snapshot-modal').style.display = 'block';
}

function saveSnapshot() {
  const link = document.createElement('a');
  link.href = lastSnapshotDataURL;
  link.download = `jewelry-tryon-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function shareSnapshot() {
  if (navigator.share) {
    fetch(lastSnapshotDataURL)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], 'jewelry-tryon.png', { type: 'image/png' });
        navigator.share({
          title: 'Jewelry Try-On',
          text: 'Check out my look!',
          files: [file]
        });
      })
      .catch(console.error);
  } else {
    alert('Sharing not supported on this browser.');
  }
}

function closeSnapshotModal() {
  document.getElementById('snapshot-modal').style.display = 'none';
}

// Info modal toggle
function toggleInfoModal() {
  const modal = document.getElementById('info-modal');
  modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
}
