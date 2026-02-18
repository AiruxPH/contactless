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

        // Physics
        this.smoothingFactor = 0.2; // 0.2 = heavy smoothing
        this.clickLockTime = 0;
        this.lockDuration = 150; // ms
        this.lockedCoords = null;

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
        if (gesture === 'pinch-start') {
            this.startInteraction();
        } else if (gesture === 'pinch-end') {
            this.endInteraction();
        }
    }

    startInteraction() {
        this.isDown = true;

        // Lock cursor
        this.clickLockTime = Date.now();
        this.lockedCoords = { x: this.cursorX, y: this.cursorY };

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

    updateLoop() {
        requestAnimationFrame(() => this.updateLoop());

        // 1. Click Locking
        if (this.clickLockTime > 0 && Date.now() - this.clickLockTime < this.lockDuration) {
            if (this.lockedCoords) {
                this.targetX = this.lockedCoords.x;
                this.targetY = this.lockedCoords.y;
            }
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

        // 3. EMA Smoothing
        this.cursorX += (this.targetX - this.cursorX) * this.smoothingFactor;
        this.cursorY += (this.targetY - this.cursorY) * this.smoothingFactor;

        // 4. Update Cursor DOM
        if (this.cursor) {
            this.cursor.style.left = `${this.cursorX}px`;
            this.cursor.style.top = `${this.cursorY}px`;
            this.cursor.style.display = 'block';

            // 5. Visual Polish
            const pinchStrength = Math.max(0, 1 - ((this.currentPinchDistance || 1) * 2));
            const glowSize = 10 + (pinchStrength * 20);
            const glowColor = this.isDown ? 'rgba(0, 255, 0, 0.8)' : `rgba(0, 242, 254, ${0.4 + pinchStrength * 0.6})`;
            this.cursor.style.boxShadow = `0 0 ${glowSize}px ${glowColor}`;

            this.cursor.style.transform = magnetized ? 'translate(-50%, -50%) scale(1.2)' : 'translate(-50%, -50%) scale(1.0)';
        }

        // Check if hovering zoom target
        const elem = document.elementFromPoint(this.cursorX, this.cursorY);
        const isZoomTarget = elem && elem.closest('#zoom-target');

        if (isZoomTarget && this.currentPinchDistance !== undefined) {
            const minD = 0.03;
            const maxD = 0.15;
            const clampedD = Math.min(Math.max(this.currentPinchDistance, minD), maxD);
            const t = (clampedD - minD) / (maxD - minD);
            const targetZoom = 0.5 + (t * 2.0);

            const lerpFactor = 0.1;
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
