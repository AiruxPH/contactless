export default class MouseController {
    constructor(gestureDetector) {
        this.gestureDetector = gestureDetector;
        this.cursor = document.getElementById('hand-cursor');

        // State
        this.cursorX = 0;
        this.cursorY = 0;
        this.isDown = false;
        this.isDragging = false;

        // Smooth Cursor
        this.targetX = 0;
        this.targetY = 0;

        // Zoom state
        this.zoomElement = document.getElementById('zoom-target');
        this.currentZoom = 1;

        this.init();
    }

    init() {
        // High frequency loop for interactions
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

        // Read cursor position from DOM (since GestureDetector updates it)
        // Ideally we'd get this from data, but this works for now without editing GestureDetector heavily
        if (this.cursor) {
            const rect = this.cursor.getBoundingClientRect();
            // Center of the cursor
            this.cursorX = rect.left + rect.width / 2;
            this.cursorY = rect.top + rect.height / 2;
        }

        // Check if hovering zoom target
        const elem = document.elementFromPoint(this.cursorX, this.cursorY);
        const isZoomTarget = elem && elem.closest('#zoom-target');

        if (isZoomTarget && this.currentPinchDistance !== undefined) {
            // Zoom Logic: Hand Aperture
            // Distance ~0.03 (Closed) to ~0.15+ (Open)

            const minD = 0.03;
            const maxD = 0.15;
            const clampedD = Math.min(Math.max(this.currentPinchDistance, minD), maxD);

            // Scale Range: 0.5 to 2.5
            const t = (clampedD - minD) / (maxD - minD); // 0 to 1
            const targetZoom = 0.5 + (t * 2.0); // 0.5 to 2.5

            // Smooth lerp for visual stability
            const lerpFactor = 0.1;
            this.currentZoom = this.currentZoom + (targetZoom - this.currentZoom) * lerpFactor;

            if (this.zoomElement) {
                this.zoomElement.style.transform = `scale(${this.currentZoom.toFixed(2)})`;
            }

            // Update cursor state text for debug
            const stateEl = document.getElementById('cursor-state');
            if (stateEl) stateEl.textContent = `ZOOMING (${Math.round(t * 100)}%)`;
        } else {
            // Reset state text
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
