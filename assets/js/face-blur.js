// Face detection and blurring for privacy protection
// Uses face-api.js for client-side face detection

let faceApiLoaded = false;

function waitForFaceApi(timeout = 5000) {
    return new Promise((resolve) => {
        if (typeof faceapi !== 'undefined') {
            resolve(true);
            return;
        }

        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            if (typeof faceapi !== 'undefined') {
                clearInterval(checkInterval);
                resolve(true);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                resolve(false);
            }
        }, 100);
    });
}

export async function loadFaceDetectionModels() {
    if (faceApiLoaded) return true;

    try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model';

        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL)
        ]);
        faceApiLoaded = true;
        console.log('✅ Face detection models loaded');
        return true;
    } catch (e) {
        console.warn('⚠️ Face detection unavailable:', e);
        return false;
    }
}

function isLikelyFace(detection, imageWidth, imageHeight) {
    const score = detection.detection.score;
    const box = detection.detection.box;

    if (score < 0.45) return false;
    if (!detection.landmarks || !detection.landmarks.positions?.length) return false;

    if (box.width < 28 || box.height < 28) return false;

    const areaRatio = (box.width * box.height) / (imageWidth * imageHeight);
    if (areaRatio > 0.45) return false;

    const aspectRatio = box.width / box.height;
    if (aspectRatio < 0.55 || aspectRatio > 1.8) return false;

    return true;
}

function getLandmarkFaceBox(landmarks, imageWidth, imageHeight) {
    const points = landmarks.positions.slice(0, 27);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    points.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    });

    const padX = (maxX - minX) * 0.08;
    const padY = (maxY - minY) * 0.08;

    const x = Math.max(0, Math.floor(minX - padX));
    const y = Math.max(0, Math.floor(minY - padY));
    const width = Math.min(imageWidth - x, Math.ceil(maxX - minX + padX * 2));
    const height = Math.min(imageHeight - y, Math.ceil(maxY - minY + padY * 2));

    if (width < 20 || height < 20) return null;

    return { x, y, width, height };
}

export async function blurFacesInImage(imageFile) {
    try {
        if (typeof faceapi === 'undefined') {
            console.log('⏳ Waiting for face-api.js to load...');
            const available = await waitForFaceApi(5000);
            if (!available) {
                console.warn('⚠️ face-api.js not loaded, skipping face blur');
                return imageFile;
            }
        }

        const modelsLoaded = await loadFaceDetectionModels();
        if (!modelsLoaded) return imageFile;

        const img = await createImageFromFile(imageFile);

        const detections = await faceapi
            .detectAllFaces(
                img,
                new faceapi.TinyFaceDetectorOptions({
                    inputSize: 416,
                    scoreThreshold: 0.45
                })
            )
            .withFaceLandmarks(true);

        const faces = detections.filter((detection) =>
            isLikelyFace(detection, img.width, img.height)
        );

        if (!faces.length) {
            console.log('✅ No faces detected');
            return imageFile;
        }

        console.log(`🔍 Detected ${faces.length} face(s), blurring face regions only...`);

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(img, 0, 0);

        faces.forEach((face) => {
            const box = getLandmarkFaceBox(face.landmarks, canvas.width, canvas.height);
            if (!box) return;

            blurRect(ctx, canvas, box.x, box.y, box.width, box.height);
        });

        const blurredBlob = await new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', 0.85);
        });

        console.log(`✅ Blurred ${faces.length} face(s)`);
        return blurredBlob;
    } catch (e) {
        console.error('Face blur error:', e);
        return imageFile;
    }
}

function blurRect(ctx, canvas, x, y, width, height) {
    const sx = Math.max(0, Math.floor(x));
    const sy = Math.max(0, Math.floor(y));
    const sw = Math.min(canvas.width - sx, Math.floor(width));
    const sh = Math.min(canvas.height - sy, Math.floor(height));

    if (sw < 1 || sh < 1) return;

    const source = document.createElement('canvas');
    source.width = sw;
    source.height = sh;
    source.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    const blurred = document.createElement('canvas');
    blurred.width = sw;
    blurred.height = sh;
    const blurredCtx = blurred.getContext('2d');
    blurredCtx.filter = 'blur(10px)';
    blurredCtx.drawImage(source, 0, 0);

    ctx.drawImage(blurred, 0, 0, sw, sh, sx, sy, sw, sh);
}

function createImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(img.src);
            resolve(img);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}
