class GestureDetector {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.handLandmarker = null;
        this.isDetecting = false;
        this.lastHandPosition = null;
        this.lastPalmAngle = null; // Track palm rotation angle
        this.lastFingerPositions = null; // Track finger positions for flick detection
        this.isPinching = false; // Track pinch state
        this.gestureCallbacks = [];
        this.lastGestureTime = 0;
        this.gestureCooldown = 600; // ms between gestures (reduced for better responsiveness)
        this.enableVisualCursor = true; // Default to true, can be disabled by controllers

        this.init();
    }

    async init() {
        try {
            // Import MediaPipe Vision
            const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
            const { HandLandmarker, FilesetResolver } = vision;

            // Initialize MediaPipe
            const filesetResolver = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
            );

            this.handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 1,
                minHandDetectionConfidence: 0.3,  // Lowered from 0.5 for better tracking
                minHandPresenceConfidence: 0.3,   // Lowered from 0.5 for better tracking
                minTrackingConfidence: 0.3        // Lowered from 0.5 for better tracking
            });

            console.log("Hand Landmarker initialized successfully");
            this.startDetection();
        } catch (error) {
            console.error("Error initializing Hand Landmarker:", error);
            this.emitStatus('error', error.message);
        }
    }

    startDetection() {
        this.isDetecting = true;
        this.detectHands();
    }

    detectHands() {
        if (!this.isDetecting || !this.handLandmarker) return;

        const detect = async () => {
            try {
                if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
                    // Set canvas size to match video
                    if (this.canvas.width !== this.video.videoWidth) {
                        console.log(`Video ready! Resolution: ${this.video.videoWidth}x${this.video.videoHeight}`);
                        this.canvas.width = this.video.videoWidth;
                        this.canvas.height = this.video.videoHeight;
                    }

                    // Clear canvas
                    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

                    // Detect hands
                    const startTimeMs = performance.now();
                    const results = this.handLandmarker.detectForVideo(this.video, startTimeMs);

                    if (results.landmarks && results.landmarks.length > 0) {
                        // Draw hand landmarks
                        this.drawHandLandmarks(results.landmarks[0]);

                        // Detect gestures
                        this.detectGesture(results.landmarks[0]);

                        this.emitStatus('handDetected', true);
                    } else {
                        this.emitStatus('handDetected', false);
                        this.lastHandPosition = null;
                        this.lastPalmAngle = null; // Reset palm angle tracking
                    }
                }
            } catch (error) {
                console.error("Frame processing error:", error);
                // Continue loop even on error
            }

            if (this.isDetecting) {
                requestAnimationFrame(detect);
            }
        };

        detect();
    }

    drawHandLandmarks(landmarks) {
        const ctx = this.ctx;

        // Visual Cursor Logic (Built-in)
        // Can be disabled if an external controller (like MouseController) wants to handle smoothing/physics
        if (this.enableVisualCursor) {
            const cursor = document.getElementById('hand-cursor');
            if (cursor) {
                // Index finger tip is landmark 8
                const indexTip = landmarks[8];
                // Mirror X coordinate for intuitive cursor movement
                const screenX = (1 - indexTip.x) * window.innerWidth;
                const screenY = indexTip.y * window.innerHeight;

                cursor.style.left = `${screenX}px`;
                cursor.style.top = `${screenY}px`;
                cursor.classList.add('active');

                // Add pinching class if thumb and index are close
                const thumbTip = landmarks[4];
                const distance = Math.sqrt(
                    Math.pow(indexTip.x - thumbTip.x, 2) +
                    Math.pow(indexTip.y - thumbTip.y, 2)
                );

                // Use a generic visual threshold for the basic cursor
                if (distance < 0.05) {
                    cursor.classList.add('pinching');
                } else {
                    cursor.classList.remove('pinching');
                }
            }
        }

        // Draw connections
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8], // Index
            [0, 9], [9, 10], [10, 11], [11, 12], // Middle
            [0, 13], [13, 14], [14, 15], [15, 16], // Ring
            [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [5, 9], [9, 13], [13, 17] // Palm
        ];

        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;

        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];

            ctx.beginPath();
            ctx.moveTo(startPoint.x * this.canvas.width, startPoint.y * this.canvas.height);
            ctx.lineTo(endPoint.x * this.canvas.width, endPoint.y * this.canvas.height);
            ctx.stroke();
        });

        // Draw landmarks
        ctx.fillStyle = '#FF0000';
        landmarks.forEach(landmark => {
            ctx.beginPath();
            ctx.arc(
                landmark.x * this.canvas.width,
                landmark.y * this.canvas.height,
                5,
                0,
                2 * Math.PI
            );
            ctx.fill();
        });
    }

    isHandOpen(landmarks) {
        // Check if hand is open by comparing finger tip Y positions with middle joints
        // Lower Y = higher on screen (fingers pointing up when extended)

        // Index finger: tip (8) should be above middle joint (6)
        const indexExtended = landmarks[8].y < landmarks[6].y;

        // Middle finger: tip (12) should be above middle joint (10)
        const middleExtended = landmarks[12].y < landmarks[10].y;

        // Ring finger: tip (16) should be above middle joint (14)
        const ringExtended = landmarks[16].y < landmarks[14].y;

        // Count extended fingers
        const extendedCount = [indexExtended, middleExtended, ringExtended].filter(Boolean).length;
        const isOpen = extendedCount >= 2;

        // Debug: log when hand is closed
        if (!isOpen) {
            console.log(`🤛 Hand CLOSED - only ${extendedCount}/3 fingers extended`);
        }

        return isOpen;
    }

    getDistance(point1, point2) {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getHandScale(landmarks) {
        // Distance from Wrist (0) to Middle Finger MCP (9)
        // This represents the "palm size" which stays consistent regardless of finger movement
        return this.getDistance(landmarks[0], landmarks[9]);
    }

    getNormalizedDistance(point1, point2, scale) {
        const rawDistance = this.getDistance(point1, point2);
        // Returning distance relative to the hand size
        return scale > 0 ? rawDistance / scale : 10;
    }

    detectGesture(landmarks) {
        const now = Date.now();
        const wrist = landmarks[0];
        const indexTip = landmarks[8];
        const middleFingerBase = landmarks[9];

        // 1. Calculate Core Metrics (Always needed for tracking)
        const scale = this.getHandScale(landmarks);
        const rawPinchDistance = this.getNormalizedDistance(landmarks[4], landmarks[8], scale);
        const isOpen = this.isHandOpen(landmarks);

        // 2. Emit Frame Data Immediately (Continuous Tracking)
        this.emitHandFrame({
            landmarks,
            cursor: { x: (1 - indexTip.x) * window.innerWidth, y: indexTip.y * window.innerHeight },
            pinchDistance: rawPinchDistance,
            handScale: scale,
            isPinching: this.isPinching,
            handOpen: isOpen
        });

        // 3. Gesture Detection Guard: Cooldown
        if (now - this.lastGestureTime < this.gestureCooldown) {
            return;
        }

        const currentPosition = {
            x: wrist.x,
            y: wrist.y,
            time: now
        };

        // 4. Gesture Detection Guard: Hand Open
        if (!isOpen) {
            this.lastHandPosition = currentPosition;
            this.lastPalmAngle = null;
            return;
        }

        let gesture = null;

        // ROTATION DETECTION: Track palm angle changes
        // Calculate current palm angle
        const palmDeltaX = middleFingerBase.x - wrist.x;
        const palmDeltaY = middleFingerBase.y - wrist.y;

        const currentPalmAngle = { x: palmDeltaX, y: palmDeltaY };

        if (this.lastPalmAngle) {
            const angleChangeX = currentPalmAngle.x - this.lastPalmAngle.x;
            const angleChangeY = currentPalmAngle.y - this.lastPalmAngle.y;
            const rotationChangeThreshold = 0.15;

            if (Math.abs(angleChangeY) > Math.abs(angleChangeX) && Math.abs(angleChangeY) > rotationChangeThreshold) {
                if (angleChangeY < -rotationChangeThreshold) gesture = 'tilt-up';
                else if (angleChangeY > rotationChangeThreshold) gesture = 'tilt-down';
            }
            else if (Math.abs(angleChangeX) > rotationChangeThreshold) {
                if (angleChangeX < -rotationChangeThreshold) gesture = 'tilt-right';
                else if (angleChangeX > rotationChangeThreshold) gesture = 'tilt-left';
            }
        }
        this.lastPalmAngle = currentPalmAngle;

        // FINGER FLICK DETECTION
        const middleTip = landmarks[12];
        const currentFingers = {
            index: { x: indexTip.x - wrist.x, y: indexTip.y - wrist.y },
            middle: { x: middleTip.x - wrist.x, y: middleTip.y - wrist.y },
            time: now
        };

        if (this.lastFingerPositions) {
            const deltaTime = (now - this.lastFingerPositions.time) / 1000;
            if (deltaTime > 0) {
                const indexVelY = (currentFingers.index.y - this.lastFingerPositions.index.y) / deltaTime;
                const middleVelY = (currentFingers.middle.y - this.lastFingerPositions.middle.y) / deltaTime;
                const indexVelX = (currentFingers.index.x - this.lastFingerPositions.index.x) / deltaTime;
                const middleVelX = (currentFingers.middle.x - this.lastFingerPositions.middle.x) / deltaTime;

                const flickThreshold = 1.2;

                if (!gesture) {
                    const maxRelVelY = Math.max(Math.abs(indexVelY), Math.abs(middleVelY));
                    const maxRelVelX = Math.max(Math.abs(indexVelX), Math.abs(middleVelX));

                    if (maxRelVelY > maxRelVelX && maxRelVelY > flickThreshold) {
                        if (indexVelY < -flickThreshold || middleVelY < -flickThreshold) gesture = 'finger-flick-down';
                        else if (indexVelY > flickThreshold || middleVelY > flickThreshold) gesture = 'finger-flick-up';
                    } else if (maxRelVelX > flickThreshold) {
                        if (indexVelX < -flickThreshold || middleVelX < -flickThreshold) gesture = 'finger-flick-right';
                        else if (indexVelX > flickThreshold || middleVelX > flickThreshold) gesture = 'finger-flick-left';
                    }
                }
            }
        }
        this.lastFingerPositions = currentFingers;

        // SWIPE DETECTION
        if (!gesture && this.lastHandPosition) {
            const deltaX = currentPosition.x - this.lastHandPosition.x;
            const deltaY = currentPosition.y - this.lastHandPosition.y;
            const deltaTime = (now - this.lastHandPosition.time) / 1000;
            const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const speed = magnitude / Math.max(deltaTime, 0.001);
            const threshold = 0.03;
            const minSpeed = 0.15;

            if (magnitude > threshold && speed > minSpeed) {
                if (Math.abs(deltaY) > Math.abs(deltaX)) {
                    if (deltaY < -threshold) gesture = 'swipe-up';
                    else if (deltaY > threshold) gesture = 'swipe-down';
                } else {
                    if (deltaX < -threshold) gesture = 'swipe-right';
                    else if (deltaX > threshold) gesture = 'swipe-left';
                }
            }
        }

        if (gesture) {
            let data = null;
            if (gesture.startsWith('finger-flick') && this.lastFingerPositions) {
                const deltaTime = (now - this.lastFingerPositions.time) / 1000;
                if (deltaTime > 0) {
                    const velocity = gesture.includes('left') || gesture.includes('right')
                        ? Math.max(Math.abs((currentFingers.index.x - this.lastFingerPositions.index.x) / deltaTime), Math.abs((currentFingers.middle.x - this.lastFingerPositions.middle.x) / deltaTime))
                        : Math.max(Math.abs((currentFingers.index.y - this.lastFingerPositions.index.y) / deltaTime), Math.abs((currentFingers.middle.y - this.lastFingerPositions.middle.y) / deltaTime));
                    data = { velocity };
                }
            }
            console.log(`Gesture detected: ${gesture}`, data);
            this.emitGesture(gesture, data);
            this.lastGestureTime = now;
        }

        // PINCH DETECTION (Always keep state updated)
        const pinchThreshold = 0.4;
        if (rawPinchDistance < pinchThreshold) {
            if (!this.isPinching) {
                this.isPinching = true;
                this.emitGesture('pinch-start');
            }
        } else if (this.isPinching) {
            this.isPinching = false;
            this.emitGesture('pinch-end');
        }

        this.lastHandPosition = currentPosition;
    }

    emitHandFrame(data) {
        window.dispatchEvent(new CustomEvent('handFrame', {
            detail: data
        }));
    }

    emitGesture(gesture, data = null) {
        this.gestureCallbacks.forEach(callback => callback(gesture, data));

        // Also emit as a CustomEvent for global listeners
        window.dispatchEvent(new CustomEvent('handGesture', {
            detail: { gesture, data }
        }));
    }

    emitStatus(type, data) {
        const event = new CustomEvent('detectorStatus', {
            detail: { type, data }
        });
        window.dispatchEvent(event);
    }

    onGesture(callback) {
        this.gestureCallbacks.push(callback);
    }

    stop() {
        this.isDetecting = false;
    }
}

export default GestureDetector;
