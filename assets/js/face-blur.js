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

        // Load only the tiny model for speed
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        faceApiLoaded = true;
        console.log('✅ Face detection models loaded');
        return true;
    } catch (e) {
        console.warn('⚠️ Face detection unavailable:', e);
        return false;
    }
}

export async function blurFacesInImage(imageFile) {
    try {
        // Wait for face-api to be available (max 5 seconds)
        if (typeof faceapi === 'undefined') {
            console.log('⏳ Waiting for face-api.js to load...');
            const available = await waitForFaceApi(5000);
            if (!available) {
                console.warn('⚠️ face-api.js not loaded, skipping face blur');
                return imageFile;
            }
        }

        // Load models if not already loaded
        const modelsLoaded = await loadFaceDetectionModels();
        if (!modelsLoaded) return imageFile;

        // Create image element
        const img = await createImageFromFile(imageFile);

        // Detect faces with very sensitive settings to catch more faces
        const detections = await faceapi.detectAllFaces(
            img,
            new faceapi.TinyFaceDetectorOptions({
                inputSize: 608,        // Maximum size for best detection
                scoreThreshold: 0.2    // Very low threshold = very sensitive
            })
        );

        if (!detections || detections.length === 0) {
            console.log('✅ No faces detected');
            return imageFile;
        }

        console.log(`🔍 Detected ${detections.length} face(s), blurring facial features...`);

        // Create canvas and blur faces
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Apply blur only to facial features (eyes area) for each detected face
        detections.forEach(detection => {
            const box = detection.box;

            // Only blur the upper-middle portion where eyes are located
            // This preserves helmet/no-helmet visibility while protecting identity
            const eyeRegionHeight = box.height * 0.4; // Upper 40% of face (eyes/forehead area)
            const eyeRegionY = box.y + box.height * 0.15; // Start slightly below top

            const x = Math.max(0, box.x);
            const y = Math.max(0, eyeRegionY);
            const width = Math.min(canvas.width - x, box.width);
            const height = Math.min(canvas.height - y, eyeRegionHeight);

            // Extract eye region only
            const faceData = ctx.getImageData(x, y, width, height);

            // Apply strong blur to eyes area
            blurImageData(faceData, 20);

            // Put blurred region back
            ctx.putImageData(faceData, x, y);
        });

        // Convert canvas back to blob
        const blurredBlob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/jpeg', 0.85);
        });

        console.log(`✅ Blurred ${detections.length} face(s)`);
        return blurredBlob;

    } catch (e) {
        console.error('Face blur error:', e);
        // Return original image if blur fails
        return imageFile;
    }
}

function createImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

function blurImageData(imageData, radius) {
    // Simple box blur implementation
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Apply multiple passes for stronger blur
    for (let pass = 0; pass < 3; pass++) {
        const tempData = new Uint8ClampedArray(data);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, count = 0;

                // Sample surrounding pixels
                for (let dy = -radius; dy <= radius; dy += 2) {
                    for (let dx = -radius; dx <= radius; dx += 2) {
                        const nx = x + dx;
                        const ny = y + dy;

                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const idx = (ny * width + nx) * 4;
                            r += tempData[idx];
                            g += tempData[idx + 1];
                            b += tempData[idx + 2];
                            count++;
                        }
                    }
                }

                const idx = (y * width + x) * 4;
                data[idx] = r / count;
                data[idx + 1] = g / count;
                data[idx + 2] = b / count;
            }
        }
    }
}
