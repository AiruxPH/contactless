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

        // Update raw target from detector
        if (data.cursor) {
            this.targetX = data.cursor.x;
            this.targetY = data.cursor.y;
        }
    }

    handleGesture(gesture) {
        if (gesture === 'pinky-click') {
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
        const lerpFactor = 0.15; // Lower = smoother/slower, Higher = snappier/jitterier

        this.cursorX = (targetX * lerpFactor) + (this.cursorX * (1 - lerpFactor));
        this.cursorY = (targetY * lerpFactor) + (this.cursorY * (1 - lerpFactor));

        // DOM update is handled in updateLoop for now to keep the loop structure clean,
        // or we can move it here as per user snippet. 
        // User snippet included DOM update here. Let's strictly follow it.
        // Actually, updateLoop handles DOM update in step 4. 
        // I will keep the math here and let updateLoop handle the centralized DOM update 
        // to avoid conflicts with other visual effects (glow, transform) which are calculated in updateLoop.
    }

    updateLoop() {
        requestAnimationFrame(() => this.updateLoop());

        // 1. Click Locking
        if (this.lockCursor) {
            // Keep target at current cursor position (freeze)
            // Or rather, ignore new targets? 
            // The user said "freeze the cursorX and cursorY values".
            // If we freeze cursorX/Y, the EMA in step 3 will pull it towards targetX/Y unless we freeze target or force cursor.
            // Let's freeze the targetX/Y to the current cursorX/Y so the EMA stabilizes there.
            this.targetX = this.cursorX;
            this.targetY = this.cursorY;
        }

        // 2. Magnetic Targets
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

        // 3. EMA Smoothing (User Spec: Logic moved to helper)
        this.updateCursorSmoothing(this.targetX, this.targetY);

        // 4. Update Cursor DOM
        if (this.cursor) {
            this.cursor.style.left = `${this.cursorX}px`;
            this.cursor.style.top = `${this.cursorY}px`;
            this.cursor.style.display = 'block';

            // 5. Visual Polish
            const pinchStrength = Math.max(0, 1 - ((this.currentPinchDistance || 1) * 2));
            const glowSize = 10 + (pinchStrength * 20);

            // User Spec: Unique Green cue for Pinky Click, Cyan for Zoom
            let glowColor;
            if (this.isDown) {
                glowColor = 'rgba(0, 255, 0, 1)'; // Solid Green for Click
                this.cursor.classList.add('clicking');
            } else {
                this.cursor.classList.remove('clicking');
                if (this.isPinchingZoom) {
                    glowColor = `rgba(0, 242, 254, ${0.4 + pinchStrength * 0.6})`; // Cyan for Zoom
                    this.cursor.classList.add('pinching');
                } else {
                    glowColor = 'rgba(0, 242, 254, 0.3)'; // Dim Cyan hover
                    this.cursor.classList.remove('pinching');
                }
            }

            this.cursor.style.boxShadow = `0 0 ${glowSize}px ${glowColor}`;
            this.cursor.style.backgroundColor = this.isDown ? '#00FF00' : 'transparent'; // Turn green on click

            this.cursor.style.transform = magnetized ? 'translate(-50%, -50%) scale(1.2)' : 'translate(-50%, -50%) scale(1.0)';
        }

        // Check if hovering zoom target OR already locked in zoom
        const elem = document.elementFromPoint(this.cursorX, this.cursorY);
        const isHoveringZoom = elem && elem.closest('#zoom-target');

        // ZOOM LOGIC: Active if hovering OR locked (current pinch in progress)
        if ((isHoveringZoom || this.isZoomLocked) && this.currentPinchDistance !== undefined) {
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
            if (stateEl) stateEl.textContent = this.isDown ? 'CLICKING' : 'HOVER';
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
