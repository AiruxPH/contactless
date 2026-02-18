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

        // We hook into the detector's raw landmark drawing or add a new listener?
        // GestureDetector doesn't emit raw landmarks publicly in a stream. 
        // We might need to modify GestureDetector to emit 'frame' event or similar.
        // For now, let's rely on reading the position from the cursor element update in GestureDetector
        // OR better: Listen to the 'handDetected' event ?? No, that's status.
        // Let's monkey-patch or listen to the custom event 'handGesture' ? No, that's for gestures.

        // Since GestureDetector handles the cursor drawing internally, we can read the cursor's style left/top
        // But that's reading DOM which is slow. 
        // Best approach: Add a callback to GestureDetector for "onFrame" or "onLandmarks".

        // **Self-Correction**: GestureDetector already moves the #hand-cursor element.
        // We just need to trigger clicks/drags based on that position.
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

        // Handle Dragging / Zooming
        if (this.isDragging && this.zoomElement) {
            const deltaY = this.dragStartY - this.cursorY;
            // moving up (positive delta) -> Zoom In
            // moving down (negative delta) -> Zoom Out

            const zoomSensitivity = 0.005;
            let newZoom = this.initialZoom + (deltaY * zoomSensitivity);
            newZoom = Math.min(Math.max(newZoom, 0.5), 3); // Clamp 0.5x to 3x

            this.currentZoom = newZoom;
            this.zoomElement.style.transform = `scale(${newZoom})`;
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
