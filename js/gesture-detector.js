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
        this.isPinkyTap = false; // Track pinky tap state
        this.isMiddlePinch = false;
        this.gestureCallbacks = [];
        this.isMirror = true;
        this.showLandmarkIndices = false; // New property for analytics
        this.showGimbalLines = false; // Toggle for orientation debugging
        this.gestureCooldown = 400; // ms between gestures (reduced for better responsiveness)
        this.enableVisualCursor = true; // Default to true, can be disabled by controllers


        this.init();
    }


    get isMirror() {
        return this._isMirror;
    }

    set isMirror(value) {
        this._isMirror = value;
        this.applyMirrorEffect();
    }

    applyMirrorEffect() {
        if (!this.video || !this.canvas) return;

        const transform = this._isMirror ? 'scaleX(-1)' : 'none';
        this.video.style.transform = transform;
        this.canvas.style.transform = transform;

        console.log(`Mirror Mode: ${this._isMirror ? 'ON' : 'OFF'}`);
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
                        this.detectGesture(
                            results.landmarks[0],
                            results.worldLandmarks ? results.worldLandmarks[0] : null,
                            results.handedness && results.handedness[0] ? results.handedness[0][0] : null
                        );



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
        landmarks.forEach((landmark, index) => {
            const x = landmark.x * this.canvas.width;
            const y = landmark.y * this.canvas.height;

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();

            if (this.showLandmarkIndices) {
                ctx.save();
                ctx.translate(x + 5, y + 5);
                // If the entire canvas is mirrored by CSS, we must pre-mirror the text 
                // so it looks normal after the CSS transform.
                if (this.isMirror) {
                    ctx.scale(-1, 1);
                }
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 12px Arial';
                ctx.fillText(index, 0, 0);
                ctx.restore();
                ctx.fillStyle = '#FF0000'; // Reset for next dot
            }

        });


        // Draw Green Lines connecting finger tips
        // Tips: Thumb(4), Index(8), Middle(12), Ring(16), Pinky(20)
        const tipIndices = [4, 8, 12, 16, 20];
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < tipIndices.length; i++) {
            const tip = landmarks[tipIndices[i]];
            const x = tip.x * this.canvas.width;
            const y = tip.y * this.canvas.height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();


        // Palm Center Calculation and Drawing
        // User Spec: Midpoint between wrist [0] and middle finger MCP [9]
        const middleMCP = landmarks[9];
        const wrist = landmarks[0];
        const palmCenter = {
            x: (wrist.x + middleMCP.x) / 2,
            y: (wrist.y + middleMCP.y) / 2
        };


        // Draw Palm Center as a larger red dot
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(
            palmCenter.x * this.canvas.width,
            palmCenter.y * this.canvas.height,
            8, // Larger for visibility
            0,
            2 * Math.PI
        );
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF'; // White border for distinction
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Debug Gimbal Vectors (Blue Lines)
        if (this.showGimbalLines) {
            ctx.strokeStyle = '#3b82f6'; // Blue
            ctx.lineWidth = 4;

            // 1. Palm Center to Thumb MCP [2]
            const thumbMCP = landmarks[2];
            ctx.beginPath();
            ctx.moveTo(palmCenter.x * this.canvas.width, palmCenter.y * this.canvas.height);
            ctx.lineTo(thumbMCP.x * this.canvas.width, thumbMCP.y * this.canvas.height);
            ctx.stroke();

            // 2. Yaw Vector: Pinky MCP [17] to Index MCP [5]
            const indexMCP = landmarks[5];
            const pinkyMCP = landmarks[17];
            ctx.beginPath();
            ctx.moveTo(indexMCP.x * this.canvas.width, indexMCP.y * this.canvas.height);
            ctx.lineTo(pinkyMCP.x * this.canvas.width, pinkyMCP.y * this.canvas.height);
            ctx.stroke();

            // 3. Pitch Vector: Middle MCP [9] to Wrist [0]
            ctx.beginPath();
            ctx.moveTo(middleMCP.x * this.canvas.width, middleMCP.y * this.canvas.height);
            ctx.lineTo(wrist.x * this.canvas.width, wrist.y * this.canvas.height);
            ctx.stroke();
        }

        this.currentPalmCenter = palmCenter;

    }

    isHandOpen(landmarks) {
        // Hybrid 'Hand Open' Guard User Spec: 
        // As long as the Index Finger [8] is extended and tracked, keep the Aerial Mouse active.

        // Index finger: tip (8) should be above MCP (5) or PIP (6)
        // We use a slightly more lenient check: Tip Y vs PIP Y
        const indexExtended = landmarks[8].y < landmarks[6].y;

        // For general "is the hand open" (used for navigation gestures), 
        // we still check for at least 2 fingers to avoid accidental swipes while clicking.
        const middleExtended = landmarks[12].y < landmarks[10].y;
        const ringExtended = landmarks[16].y < landmarks[14].y;

        const extendedCount = [indexExtended, middleExtended, ringExtended].filter(Boolean).length;

        // This 'isOpen' is primarily for allowing Swipe/Flick/Tilt
        return extendedCount >= 2;
    }

    isIndexTracked(landmarks) {
        // Essential check for cursor movement
        return landmarks[8].y < landmarks[5].y;
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

    detectGesture(landmarks, worldLandmarks, handedness) {
        const now = Date.now();
        const wrist = landmarks[0];
        const indexTip = landmarks[8];
        const middleFingerBase = landmarks[9];

        // 1. Calculate Core Metrics
        const scale = this.getHandScale(landmarks);
        const rawPinchDistance = this.getNormalizedDistance(landmarks[4], landmarks[8], scale);
        const isOpen = this.isHandOpen(landmarks);

        // HAND GIMBAL SYSTEM (3D Orientation using World Landmarks)
        // User Spec: Use Wrist-to-Middle for Pitch, Index-to-Pinky for Yaw
        let pitchDegrees = 0;
        let yawDegrees = 0;
        let isFacingCamera = true;
        let worldWristZ = 0;

        if (worldLandmarks) {
            const wWrist = worldLandmarks[0];
            const wMiddleMCP = worldLandmarks[9];
            const wIndexMCP = worldLandmarks[5];
            const wPinkyMCP = worldLandmarks[17];
            worldWristZ = wWrist.z;

            // Pitch: Vertical Vector (Wrist -> Middle MCP)
            // Median Formula for zero-pivot orientation
            const dy = worldLandmarks[9].y - worldLandmarks[0].y;
            const dz = worldLandmarks[9].z - worldLandmarks[0].z;
            pitchDegrees = Math.atan2(dz, -dy) * (180 / Math.PI);

            // Yaw: Horizontal Vector (Index MCP -> Pinky MCP)
            const yX = wPinkyMCP.x - wIndexMCP.x;
            const yZ = wPinkyMCP.z - wIndexMCP.z;

            // atan2(depth, horizontal) - Normalize X-span to ignore handedness flip here
            yawDegrees = Math.atan2(yZ, Math.abs(yX)) * (180 / Math.PI);

            // Handedness Correction: Mirror Yaw for Left Hand
            // User Spec: If 'Left', multiply by -1 to sync physical 'Tilting Right' values
            const handLabel = handedness ? handedness.categoryName : 'Right';
            if (handLabel === 'Left') {
                yawDegrees = -yawDegrees;
            }

            // Facing Guard Thresholds (Relaxed)
            isFacingCamera = Math.abs(pitchDegrees) < 55 && Math.abs(yawDegrees) < 60;

        }

        // Calculate absolute palm angle for legacy 2D Tilt (Continuous Scroll fallback)
        const pCenter = this.currentPalmCenter;
        const palmDX = (pCenter ? pCenter.x : (wrist.x + middleFingerBase.x) / 2) - wrist.x;
        const palmDY = (pCenter ? pCenter.y : (wrist.y + middleFingerBase.y) / 2) - wrist.y;
        const currentAngle = Math.atan2(palmDY, palmDX);
        const neutralAngle = -Math.PI / 2;
        let angleDiff = currentAngle - neutralAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;




        // 2. Emit Frame Data Immediately (Continuous Tracking)
        this.emitHandFrame({
            landmarks,
            cursor: { x: (1 - indexTip.x) * window.innerWidth, y: indexTip.y * window.innerHeight },
            palmCenter: this.currentPalmCenter ? {
                x: (1 - this.currentPalmCenter.x) * window.innerWidth,
                y: this.currentPalmCenter.y * window.innerHeight
            } : null,
            pinchDistance: rawPinchDistance,
            tiltAngle: angleDiff,
            pitch: pitchDegrees,
            yaw: yawDegrees,
            worldWristZ: worldWristZ,
            isFacingCamera: isFacingCamera,
            handedness: handedness ? handedness.categoryName : 'N/A',
            handScale: scale,
            isMiddlePinch: this.isMiddlePinch,
            isPinching: this.isPinching,
            handOpen: isOpen,
            handDetected: true
        });




        // 3. Gesture Detection Guard: Cooldown
        if (now - this.lastGestureTime < this.gestureCooldown) {
            return;
        }

        // Anchor Point Decoupling: Use Palm Center as the 'Anchor'
        const currentPosition = {
            x: this.currentPalmCenter.x,
            y: this.currentPalmCenter.y,
            time: now
        };

        // 4. Hybrid Guard Logic
        // Mouse Cursor works as long as index is tracked.
        // Navigation (Swipe/Flick/Tilt) requires an open hand.
        if (!isOpen) {
            this.lastHandPosition = currentPosition;
            this.lastFingerPositions = null;
            return;
        }

        // 5. Facing Direction Guard
        // User Spec: Prevent navigation gestures when the hand is not facing the camera.
        if (typeof isFacingCamera !== 'undefined' && !isFacingCamera) {
            this.lastHandPosition = currentPosition;
            this.lastFingerPositions = null;
            return;
        }

        let gesture = null;

        let data = null;

        // TILT DETECTION (Variable Scroll)
        // User Spec: Unit Sync (Degrees)
        const tiltThreshold = 20; // Degrees
        if (Math.abs(pitchDegrees) > tiltThreshold || Math.abs(yawDegrees) > tiltThreshold) {
            if (Math.abs(pitchDegrees) > Math.abs(yawDegrees)) {
                // Vertical priority
                gesture = pitchDegrees > 0 ? 'tilt-down' : 'tilt-up';
                data = { angle: pitchDegrees };
            } else {
                // Horizontal priority
                gesture = yawDegrees > 0 ? 'tilt-left' : 'tilt-right';
                data = { angle: yawDegrees };
            }
        }


        // FINGER FLICK DETECTION
        const middleTip = landmarks[12];
        const currentFingers = {
            index: { x: indexTip.x - wrist.x, y: indexTip.y - wrist.y },
            middle: { x: middleTip.x - wrist.x, y: middleTip.y - wrist.y },
            time: now
        };

        if (!gesture && this.lastFingerPositions) {
            const deltaTime = (now - this.lastFingerPositions.time) / 1000;

            // FLICK SHIELD: Only allow flicks if the palm is stationary
            // This prevents accidental "swipe-flick" collisions
            const palmStabilityThreshold = 0.15;

            // Calculate current palm speed for the shield
            let palmSpeed = 0;
            if (this.lastHandPosition) {
                const palmDeltaX = currentPosition.x - this.lastHandPosition.x;
                const palmDeltaY = currentPosition.y - this.lastHandPosition.y;
                const palmDeltaTime = (now - this.lastHandPosition.time) / 1000;
                const magnitude = Math.sqrt(palmDeltaX * palmDeltaX + palmDeltaY * palmDeltaY);
                palmSpeed = magnitude / Math.max(palmDeltaTime, 0.001);
            }

            if (deltaTime > 0 && palmSpeed < palmStabilityThreshold) {
                const indexVelY = (currentFingers.index.y - this.lastFingerPositions.index.y) / deltaTime;
                const middleVelY = (currentFingers.middle.y - this.lastFingerPositions.middle.y) / deltaTime;
                const indexVelX = (currentFingers.index.x - this.lastFingerPositions.index.x) / deltaTime;
                const middleVelX = (currentFingers.middle.x - this.lastFingerPositions.middle.x) / deltaTime;

                const flickThreshold = 1.5;
                const maxRelVelY = Math.max(Math.abs(indexVelY), Math.abs(middleVelY));
                const maxRelVelX = Math.max(Math.abs(indexVelX), Math.abs(middleVelX));

                if (maxRelVelY > maxRelVelX && maxRelVelY > flickThreshold) {
                    gesture = (indexVelY < -flickThreshold || middleVelY < -flickThreshold) ? 'finger-flick-down' : 'finger-flick-up';
                } else if (maxRelVelX > flickThreshold) {
                    gesture = (indexVelX < -flickThreshold || middleVelX < -flickThreshold) ? 'finger-flick-right' : 'finger-flick-left';
                }
            }
        }

        if (gesture) {
            // Calculate velocity for flicks if not already set
            if (!data && gesture.startsWith('finger-flick') && this.lastFingerPositions) {
                const deltaTime = (now - this.lastFingerPositions.time) / 1000;
                const velocity = gesture.includes('left') || gesture.includes('right')
                    ? Math.max(Math.abs((currentFingers.index.x - this.lastFingerPositions.index.x) / deltaTime), Math.abs((currentFingers.middle.x - this.lastFingerPositions.middle.x) / deltaTime))
                    : Math.max(Math.abs((currentFingers.index.y - this.lastFingerPositions.index.y) / deltaTime), Math.abs((currentFingers.middle.y - this.lastFingerPositions.middle.y) / deltaTime));
                data = { velocity };
            }
            console.log(`Gesture detected: ${gesture}`, data);
            this.emitGesture(gesture, data);
            this.lastGestureTime = now;
        }

        // UTILITY ACTIONS (Always processed for shielding but separated from navigation gestures)
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

        const pinkyTip = landmarks[20];
        const pinkyMCP = landmarks[17];
        const pinkyDistance = this.getNormalizedDistance(pinkyTip, pinkyMCP, scale);
        const pinkyClickThreshold = 0.52; // Slightly wider for ease

        // Pinky Snap Guard: Compare current distance vs last frame to check for rapid snap
        if (this.lastPinkyDistance !== undefined) {
            const pinkyVelocity = (this.lastPinkyDistance - pinkyDistance); // > 0 means closing
            const snapThreshold = 0.08; // Required closing speed to count as a "tap"

            if (pinkyDistance < pinkyClickThreshold) {
                if (!this.isPinkyTap && pinkyVelocity > snapThreshold) {
                    this.isPinkyTap = true;
                    this.emitGesture('pinky-click');
                }
            } else if (pinkyDistance > pinkyClickThreshold + 0.1) {
                this.isPinkyTap = false;
            }
        }
        this.lastPinkyDistance = pinkyDistance;

        // Middle Pinch detection (Zoom Lever)
        const middleMCP = landmarks[9];
        const middleDistance = this.getNormalizedDistance(middleTip, middleMCP, scale);
        const middlePinchThreshold = 0.52;
        this.isMiddlePinch = middleDistance < middlePinchThreshold;

        this.lastHandPosition = currentPosition;

        this.lastFingerPositions = currentFingers;
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
