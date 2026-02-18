export default class MouseController {
    constructor(gestureDetector) {
        this.gestureDetector = gestureDetector;
        this.cursor = document.getElementById('hand-cursor');

        // State
        this.cursorX = window.innerWidth / 2;
        this.cursorY = window.innerHeight / 2;
        this.targetX = window.innerWidth / 2;
        this.targetY = window.innerHeight / 2;

        this.isDown = false;
        this.isDragging = false;
        this.isPinchingZoom = false; // Track pinch state for zoom visuals
        this.isZoomLocked = false;   // Stay in zoom mode even if cursor moves away

        // Physics
        this.smoothingFactor = 0.2; // 0.2 = heavy smoothing
        this.lockCursor = false;

        // Zoom state
        this.zoomElement = document.getElementById('zoom-target');
        this.currentZoom = 1;

        // State for Dynamic Smoothing and Shielding
        this.lastUpdateTime = Date.now();
        this.clickShieldTime = 0; // Timestamp of last pinky click for freezing
        this.clickShieldDuration = 150; // ms
        this.minLerp = 0.05; // Maximum stability (Magnet)
        this.maxLerp = 0.35; // Maximum responsiveness (Snappy)

        this.init();
    }

    init() {
        // Disable built-in detector cursor to take full control
        if (this.gestureDetector) {
            this.gestureDetector.enableVisualCursor = false;
        }

        // High frequency loop for interactions & rendering
        this.updateLoop();

        this.gestureDetector.onGesture((gesture, data) => {
            this.handleGesture(gesture, data);
        });

        // Listen to continuous frame data
        window.addEventListener('handFrame', (e) => {
            this.handleFrame(e.detail);
        });
    }

    handleFrame(data) {
        this.currentPinchDistance = data.pinchDistance;
        this.currentHandOpen = data.handOpen;
        this.isMiddlePinch = data.isMiddlePinch;

        // Update raw target from detector
        if (data.cursor) {
            this.targetX = data.cursor.x;
            this.targetY = data.cursor.y;
        }

        this.isPaused = data.isPaused;
    }

    handleGesture(gesture) {
        if (gesture === 'pinky-click') {
            this.clickShieldTime = Date.now(); // Activate Click Shield
            this.handlePinkyClick();
        } else if (gesture === 'pinch-start') {
            this.isPinchingZoom = true;
            // Immediate check if we should lock zoom
            const elem = document.elementFromPoint(this.cursorX, this.cursorY);
            if (elem && elem.closest('#zoom-target')) {
                this.isZoomLocked = true;
            }
        } else if (gesture === 'pinch-end') {
            this.isPinchingZoom = false;
            this.isZoomLocked = false;
        }
    }


    handlePinkyClick() {
        // Trigger a complete click cycle
        this.startInteraction();
        setTimeout(() => {
            this.endInteraction();
        }, 150); // Standard click duration
    }

    startInteraction() {
        this.isDown = true;

        // Lock cursor (User Spec: Precision Click-Lock)
        this.lockCursor = true;
        setTimeout(() => {
            this.lockCursor = false;
        }, 150); // 150ms lock

        // Trigger generic click
        const elem = this.getElementUnderCursor();
        if (elem) {
            // Create mouse events
            const mouseDownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: this.cursorX,
                clientY: this.cursorY
            });
            elem.dispatchEvent(mouseDownEvent);

            // Check for zoom target
            if (elem.closest('#zoom-target')) {
                this.isDragging = true; // Treat as zoom drag
                // Store initial Y for zoom calculation?
                this.dragStartY = this.cursorY;
                this.initialZoom = this.currentZoom;
            }
        }
    }

    endInteraction() {
        if (this.isDown) {
            const elem = this.getElementUnderCursor();
            if (elem) {
                const mouseUpEvent = new MouseEvent('mouseup', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: this.cursorX,
                    clientY: this.cursorY
                });
                elem.dispatchEvent(mouseUpEvent);

                // If it was a quick tap, trigger click
                if (!this.isDragging) {
                    elem.click();
                }
            }
        }

        this.isDown = false;
        this.isDragging = false;
    }

    updateCursorSmoothing(targetX, targetY) {
        const now = Date.now();
        const dt = (now - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = now;

        // 0. PAUSE GUARD: Lock everything if clench-paused
        if (this.isPaused) return;

        // 1. CLICK SHIELD: Freeze coordinates if we just clicked
        if (now - this.clickShieldTime < this.clickShieldDuration) {
            return; // Lock cursor position completely
        }

        // 2. ADAPTIVE SMOOTHING: Dynamic EMA based on speed
        const dx = targetX - this.cursorX;
        const dy = targetY - this.cursorY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = dist / Math.max(dt, 0.0001);

        // Map speed to lerp factor (faster = more responsive)
        // Normalized speed where we reach max responsiveness
        const speedThreshold = 800; // Pixels per second
        const lerpT = Math.min(1, speed / speedThreshold);

        // Exponential Logic: Use square of lerpT to make slow movement even smoother
        const smoothLerpT = Math.pow(lerpT, 2);
        const adaptiveLerp = this.minLerp + (this.maxLerp - this.minLerp) * smoothLerpT;

        this.cursorX += (targetX - this.cursorX) * adaptiveLerp;
        this.cursorY += (targetY - this.cursorY) * adaptiveLerp;
    }


    updateLoop() {
        requestAnimationFrame(() => this.updateLoop());

        // Click Shield is now handled inside updateCursorSmoothing


        // 1. Magnetic Targets
        const magnetRange = 40;
        const magnets = document.querySelectorAll('.target-button, .action-card, a');
        let magnetized = false;

        if (!this.isDragging) {
            for (const magnet of magnets) {
                const rect = magnet.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const dist = Math.hypot(this.targetX - centerX, this.targetY - centerY);

                if (dist < magnetRange) {
                    this.targetX += (centerX - this.targetX) * 0.15;
                    this.targetY += (centerY - this.targetY) * 0.15;
                    magnetized = true;
                    break;
                }
            }
        }

        this.updateCursorSmoothing(this.targetX, this.targetY);

        // 4. Update Cursor DOM
        if (this.cursor) {
            this.cursor.style.left = `${this.cursorX}px`;
            this.cursor.style.top = `${this.cursorY}px`;
            this.cursor.style.display = 'block';

            // 5. Visual Polish
            const pinchStrength = Math.max(0, 1 - ((this.currentPinchDistance || 1) * 2));
            const glowSize = 10 + (pinchStrength * 20);

            // User Spec: Unique Green cue for Pinky Click, Cyan for Zoom, Orange for Lever
            let glowColor;
            if (this.isDown) {
                glowColor = 'rgba(0, 255, 0, 1)'; // Solid Green for Click
                this.cursor.classList.add('clicking');
            } else {
                this.cursor.classList.remove('clicking');
                if (this.isMiddlePinch) {
                    glowColor = 'rgba(255, 165, 0, 0.8)'; // Orange for Zoom Lever
                    this.cursor.classList.add('zoom-mode');
                } else {
                    this.cursor.classList.remove('zoom-mode');
                }

                if (this.isPinchingZoom && this.isMiddlePinch) {
                    glowColor = `rgba(0, 242, 254, ${0.4 + pinchStrength * 0.6})`; // Cyan for Zoom
                    this.cursor.classList.add('pinching');
                } else {
                    if (!this.isMiddlePinch) glowColor = 'rgba(0, 242, 254, 0.3)'; // Dim Cyan hover
                    this.cursor.classList.remove('pinching');
                }
            }

            this.cursor.style.boxShadow = `0 0 ${glowSize}px ${glowColor}`;
            this.cursor.style.backgroundColor = this.isDown ? '#00FF00' : (this.isMiddlePinch ? 'rgba(255, 165, 0, 0.4)' : 'transparent');

            this.cursor.style.transform = magnetized ? 'translate(-50%, -50%) scale(1.2)' : 'translate(-50%, -50%) scale(1.0)';

            // 6. PAUSE OVERLAY
            if (this.isPaused) {
                this.cursor.style.filter = 'grayscale(1) opacity(0.5)';
                this.cursor.style.border = '2px dashed #fff';
            } else {
                this.cursor.style.filter = 'none';
                this.cursor.style.border = '2px solid rgba(255,255,255,0.8)';
            }
        }

        // Check if hovering zoom target OR already locked in zoom
        const elem = document.elementFromPoint(this.cursorX, this.cursorY);
        const isHoveringZoom = elem && elem.closest('#zoom-target');

        // ZOOM LOGIC: Active ONLY if middle-pinch (lever) is held AND (hovering OR locked)
        if (this.isMiddlePinch && (isHoveringZoom || this.isZoomLocked) && this.currentPinchDistance !== undefined) {
            // 1. Widen thresholds for natural hand movement
            const minD = 0.3; // Fully pinched
            const maxD = 0.8; // Wide open

            // 2. Normalize to 0...1
            const clampedD = Math.min(Math.max(this.currentPinchDistance, minD), maxD);
            let t = (clampedD - minD) / (maxD - minD);

            // 3. Non-linear mapping (Exponential curve for smoother start, faster end)
            // Power of 1.5 gives more precision in the "tight" range
            const smoothedT = Math.pow(t, 1.5);

            // 4. Calculate target zoom (0.5x to 3.0x range)
            const targetZoom = 0.5 + (smoothedT * 2.5);

            const lerpFactor = 0.15; // Slightly faster reaction
            this.currentZoom = this.currentZoom + (targetZoom - this.currentZoom) * lerpFactor;

            if (this.zoomElement) {
                this.zoomElement.style.transform = `scale(${this.currentZoom.toFixed(2)})`;
            }

            const stateEl = document.getElementById('cursor-state');
            if (stateEl) stateEl.textContent = `ZOOMING (${Math.round(t * 100)}%)`;
        } else {
            const stateEl = document.getElementById('cursor-state');
            if (this.isPaused) {
                if (stateEl) stateEl.textContent = 'SYSTEM PAUSED 🔒 (Open Hand to Resume)';
            } else {
                if (stateEl) stateEl.textContent = this.isDown ? 'CLICKING' : 'HOVER';
            }
        }
    }

    getElementUnderCursor() {
        // Hide cursor briefly to find what's underneath
        this.cursor.style.display = 'none';
        const elem = document.elementFromPoint(this.cursorX, this.cursorY);
        this.cursor.style.display = 'block';
        return elem;
    }
}
