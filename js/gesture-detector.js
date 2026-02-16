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

            if (this.isDetecting) {
                requestAnimationFrame(detect);
            }
        };

        detect();
    }

    drawHandLandmarks(landmarks) {
        const ctx = this.ctx;

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

    detectGesture(landmarks) {
        const now = Date.now();
        if (now - this.lastGestureTime < this.gestureCooldown) {
            return; // Still in cooldown
        }

        // Use wrist (landmark 0) for swipe gesture detection
        const wrist = landmarks[0];
        const currentPosition = {
            x: wrist.x,
            y: wrist.y,
            time: now
        };

        let gesture = null;

        // HAND OPEN CHECK: Only detect gestures if hand is open
        if (!this.isHandOpen(landmarks)) {
            // Hand is closed (fist) - don't detect any gestures
            this.lastHandPosition = currentPosition;
            this.lastPalmAngle = null; // Reset rotation tracking when hand closes
            return;
        }

        // ROTATION DETECTION: Track palm angle changes
        // Use wrist (0) and middle finger base (9) to determine palm angle
        const middleFingerBase = landmarks[9];

        // Calculate current palm angle
        const palmDeltaX = middleFingerBase.x - wrist.x;
        const palmDeltaY = middleFingerBase.y - wrist.y;

        // Store current palm orientation
        const currentPalmAngle = {
            x: palmDeltaX,
            y: palmDeltaY
        };

        // Only detect rotation if we have a previous angle to compare
        if (this.lastPalmAngle) {
            // Calculate change in palm angle
            const angleChangeX = currentPalmAngle.x - this.lastPalmAngle.x;
            const angleChangeY = currentPalmAngle.y - this.lastPalmAngle.y;

            // Rotation threshold - how much the angle must change
            const rotationChangeThreshold = 0.15; // Change in angle needed

            // Detect vertical rotation (tilting palm up/down)
            if (Math.abs(angleChangeY) > Math.abs(angleChangeX) && Math.abs(angleChangeY) > rotationChangeThreshold) {
                if (angleChangeY < -rotationChangeThreshold) {
                    gesture = 'tilt-up'; // Palm rotating upward (fingers going up)
                } else if (angleChangeY > rotationChangeThreshold) {
                    gesture = 'tilt-down'; // Palm rotating downward (fingers going down)
                }
            }
            // Detect horizontal rotation (tilting palm left/right)
            else if (Math.abs(angleChangeX) > rotationChangeThreshold) {
                // Invert for mirrored display
                if (angleChangeX < -rotationChangeThreshold) {
                    gesture = 'tilt-right'; // Palm rotating right
                } else if (angleChangeX > rotationChangeThreshold) {
                    gesture = 'tilt-left'; // Palm rotating left
                }
            }
        }

        // Update last palm angle
        this.lastPalmAngle = currentPalmAngle;

        // FINGER FLICK DETECTION: Track movements of individual finger tips relative to wrist
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const currentFingers = {
            index: { x: indexTip.x - wrist.x, y: indexTip.y - wrist.y },
            middle: { x: middleTip.x - wrist.x, y: middleTip.y - wrist.y },
            time: now
        };

        if (this.lastFingerPositions) {
            const deltaTime = (now - this.lastFingerPositions.time) / 1000;
            if (deltaTime > 0) {
                // Calculate velocity relative to wrist
                const indexVelY = (currentFingers.index.y - this.lastFingerPositions.index.y) / deltaTime;
                const middleVelY = (currentFingers.middle.y - this.lastFingerPositions.middle.y) / deltaTime;
                const indexVelX = (currentFingers.index.x - this.lastFingerPositions.index.x) / deltaTime;
                const middleVelX = (currentFingers.middle.x - this.lastFingerPositions.middle.x) / deltaTime;

                const flickThreshold = 1.2; // Lowered from 1.5 for better sensitivity

                if (!gesture) {
                    // Determine if flick is more vertical or horizontal
                    const maxRelVelY = Math.max(Math.abs(indexVelY), Math.abs(middleVelY));
                    const maxRelVelX = Math.max(Math.abs(indexVelX), Math.abs(middleVelX));

                    if (maxRelVelY > maxRelVelX && maxRelVelY > flickThreshold) {
                        // Vertical flicks
                        if (indexVelY < -flickThreshold || middleVelY < -flickThreshold) {
                            gesture = 'finger-flick-down';
                        } else if (indexVelY > flickThreshold || middleVelY > flickThreshold) {
                            gesture = 'finger-flick-up';
                        }
                    } else if (maxRelVelX > flickThreshold) {
                        // Horizontal flicks (Inverted for mirrored display)
                        if (indexVelX < -flickThreshold || middleVelX < -flickThreshold) {
                            gesture = 'finger-flick-right';
                        } else if (indexVelX > flickThreshold || middleVelX > flickThreshold) {
                            gesture = 'finger-flick-left';
                        }
                    }
                }
            }
        }
        // SWIPE DETECTION: Movement-based gestures
        if (!gesture && this.lastHandPosition) {
            const deltaX = currentPosition.x - this.lastHandPosition.x;
            const deltaY = currentPosition.y - this.lastHandPosition.y;
            const deltaTime = (now - this.lastHandPosition.time) / 1000; // Convert to seconds

            // Calculate movement magnitude and speed
            const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const speed = magnitude / Math.max(deltaTime, 0.001); // Prevent division by zero

            const threshold = 0.05; // Lowered threshold for detection at different distances
            const minSpeed = 0.2; // Lowered minimum speed for better distance tolerance

            // Only detect gestures if movement is fast enough
            if (magnitude > threshold && speed > minSpeed) {
                // Detect swipe gestures based on dominant direction
                if (Math.abs(deltaY) > Math.abs(deltaX)) {
                    // Vertical movement is dominant
                    if (deltaY < -threshold) {
                        gesture = 'swipe-up';
                    } else if (deltaY > threshold) {
                        gesture = 'swipe-down';
                    }
                } else {
                    // Horizontal movement is dominant
                    if (deltaX < -threshold) {
                        gesture = 'swipe-right';
                    } else if (deltaX > threshold) {
                        gesture = 'swipe-left';
                    }
                }
            }
        }

        if (gesture) {
            let data = null;

            // Add metadata for certain gestures
            if (gesture.startsWith('finger-flick') && this.lastFingerPositions) {
                const deltaTime = (now - this.lastFingerPositions.time) / 1000;
                if (deltaTime > 0) {
                    const vIndexY = (currentFingers.index.y - this.lastFingerPositions.index.y) / deltaTime;
                    const vMiddleY = (currentFingers.middle.y - this.lastFingerPositions.middle.y) / deltaTime;
                    const vIndexX = (currentFingers.index.x - this.lastFingerPositions.index.x) / deltaTime;
                    const vMiddleX = (currentFingers.middle.x - this.lastFingerPositions.middle.x) / deltaTime;

                    const velocity = gesture.includes('left') || gesture.includes('right')
                        ? Math.max(Math.abs(vIndexX), Math.abs(vMiddleX))
                        : Math.max(Math.abs(vIndexY), Math.abs(vMiddleY));

                    data = { velocity };
                }
            }

            console.log(`Gesture detected: ${gesture}`, data);
            this.emitGesture(gesture, data);
            this.lastGestureTime = now;
        }

        this.lastFingerPositions = currentFingers;

        // PINCH DETECTION: Check if thumb (4) and index (8) are close
        const thumbTip = landmarks[4];
        const indexTipMark = landmarks[8];
        const pinchDistance = this.getDistance(thumbTip, indexTipMark);

        // Dynamic pinch threshold based on hand size
        const handSize = this.getDistance(landmarks[0], landmarks[9]); // Wrist to middle base
        if (pinchDistance < handSize * 0.4) { // Increased threshold for easier pinch
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
