
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

function toggleCategory(category) {
  document.getElementById('subcategory-buttons').style.display = 'flex';
  const subButtons = document.querySelectorAll('#subcategory-buttons button');
  subButtons.forEach(btn => {
    btn.style.display = btn.innerText.toLowerCase().includes(category) ? 'inline-block' : 'none';
  });
  document.getElementById('jewelry-options').style.display = 'none';
}

function selectJewelryType(type) {
  currentType = type;
  document.getElementById('jewelry-options').style.display = 'flex';

  // 🔁 Clear previously loaded images when switching category
  earringImg = null;
  necklaceImg = null;
  earringSrc = '';
  necklaceSrc = '';

  let start = 1, end = 15;

  switch (type) {
    case 'gold_earrings':     end = 16; break;
    case 'gold_necklaces':    end = 19; break;
    case 'diamond_earrings':  end = 9; break;
    case 'diamond_necklaces': end = 6; break;
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
  }
});

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

function drawJewelry(landmarks, ctx) {
  const earringScale = 0.07;
  const necklaceScale = 0.18;

  const leftEar = {
    x: landmarks[132].x * canvasElement.width - 6,
    y: landmarks[132].y * canvasElement.height - 16,
  };
  const rightEar = {
    x: landmarks[361].x * canvasElement.width + 6,
    y: landmarks[361].y * canvasElement.height - 16,
  };
  const neck = {
    x: landmarks[152].x * canvasElement.width - 8,
    y: landmarks[152].y * canvasElement.height + 10,
  };

  if (earringImg) {
    const width = earringImg.width * earringScale;
    const height = earringImg.height * earringScale;
    ctx.drawImage(earringImg, leftEar.x - width / 2, leftEar.y, width, height);
    ctx.drawImage(earringImg, rightEar.x - width / 2, rightEar.y, width, height);
  }

  if (necklaceImg) {
    const width = necklaceImg.width * necklaceScale;
    const height = necklaceImg.height * necklaceScale;
    ctx.drawImage(necklaceImg, neck.x - width / 2, neck.y, width, height);
  }
}

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

function toggleInfoModal() {
  const modal = document.getElementById('info-modal');
  modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
}
