class NavigationController {
    constructor(gestureDetector) {
        this.gestureDetector = gestureDetector;
        this.scrollAmount = 300; // pixels to scroll
        this.currentGesture = 'None';
        this.lastAction = 'None';
        this.handDetected = false;
        this.isMiddlePinch = false;

        // Mappings
        this.mappings = this.loadMappings();
        this.defaultMappings = {
            'finger-flick-up': 'scroll_up',
            'finger-flick-down': 'scroll_down',
            'finger-flick-left': 'scroll_right',
            'finger-flick-right': 'scroll_left',
            'tilt-up': 'scroll_up',
            'tilt-down': 'scroll_down',
            'tilt-left': 'scroll_right',
            'tilt-right': 'scroll_left',
            'pinky-click': 'click'
        };


        // Continuous scrolling state
        this.scrollInterval = null;
        this.activeContinuousGesture = null;
        this.currentContinuousIntensity = 1;

        this.init();
    }

    loadMappings() {
        // Invert the stored mapping (Action -> [Gestures] or Action -> Gesture) 
        // to (Gesture -> Action) for O(1) lookup
        const saved = localStorage.getItem('gestureMappings');
        if (!saved) return {};

        const actionToGestures = JSON.parse(saved);
        const gestureToAction = {};

        for (const [action, gestures] of Object.entries(actionToGestures)) {
            // Handle both legacy (string) and new (array) formats
            if (Array.isArray(gestures)) {
                gestures.forEach(gesture => {
                    gestureToAction[gesture] = action;
                });
            } else {
                // Legacy single gesture support (migration)
                gestureToAction[gestures] = action;
            }
        }
        return gestureToAction;
    }

    init() {
        // Listen for gestures
        this.gestureDetector.onGesture((gesture, data) => {
            this.handleGesture(gesture, data);
        });

        // Listen for detector status
        window.addEventListener('detectorStatus', (e) => {
            const { type, data } = e.detail;
            if (type === 'handDetected') {
                this.handDetected = data;
                if (!data) {
                    this.stopContinuousScroll();
                }
                this.updateStatus();
            }
        });


        // Listen for mapping updates
        window.addEventListener('mappingUpdated', () => {
            this.mappings = this.loadMappings();
        });

        // Listen for continuous frame data to update tilt intensity
        window.addEventListener('handFrame', (e) => {
            const { isMiddlePinch } = e.detail;
            this.isMiddlePinch = isMiddlePinch;

            if (this.activeContinuousGesture && this.activeContinuousGesture.includes('tilt')) {
                const { pitch, yaw } = e.detail;

                // TILT DEAD-ZONE & 2D Logic
                // Pitch drives Vertical, Yaw drives Horizontal
                const isVertical = this.activeContinuousGesture.includes('up') || this.activeContinuousGesture.includes('down');
                const angle = isVertical ? pitch : yaw;
                const deadzone = 12; // Degrees (from Hand Gimbal System)

                if (Math.abs(angle) < deadzone) {
                    this.stopContinuousScroll();
                    return;
                }

                // Update intensity dynamically (normalized)
                const maxAngle = 55; // Sync with Facing Guard
                const intensity = (Math.abs(angle) - deadzone) / (maxAngle - deadzone);
                this.currentContinuousIntensity = Math.min(Math.max(intensity, 0.2), 3.0);

            }
        });



        this.updateStatus();
    }

    getActionForGesture(gesture) {
        // 1. Check Custom Mappings first
        if (this.mappings[gesture]) return this.mappings[gesture];

        // 2. Check Defaults
        return this.defaultMappings[gesture] || null;
    }

    handleGesture(gesture, data) {
        this.currentGesture = this.formatGestureName(gesture);
        this.updateStatus();

        const action = this.getActionForGesture(gesture);

        // Handle continuous gesture lifecycle
        if (gesture.includes('tilt')) {
            // Special handling for tilts as they are continuous
            // Extract angle data if available for variable speed (Unit Sync: Degrees)
            const deadzone = 12;
            const maxAngle = 55;
            let intensity = 1;

            if (data && typeof data.angle === 'number') {
                const angle = Math.abs(data.angle);
                intensity = (angle - deadzone) / (maxAngle - deadzone);
                intensity = Math.min(Math.max(intensity, 0.2), 3.0);
            }
            this.startContinuousScroll(gesture, intensity);
        } else if (gesture === 'pinky-click') {
            this.handleClick();
        } else if (gesture === 'pinch-start') {
            // Pinch no longer clicks, purely for cursor visuals or zoom
        } else {

            // Impulse gestures (swipes, flicks)
            this.stopContinuousScroll();

            // Calculate intensity for flicks (Proportional Scrolling)
            // User Spec: Momentum Smoothing
            let intensity = 1;
            if (data && data.velocity) {
                // Exponential mapping for smoother slow-starts and punchy fast-flicks
                // Map velocity (1.5 - 8.0) to intensity (1.0 - 5.0)
                const baseVel = 1.5;
                const normalizedVel = Math.max(0, data.velocity - baseVel);
                intensity = 1 + Math.pow(normalizedVel / 2, 1.2);
                intensity = Math.min(intensity, 6); // Cap for safety
            }


            // Execute Action
            if (action) {
                this.executeAction(action, intensity);
            } else {
                console.log('No action mapped for:', gesture);
            }
        }

        // Reset gesture display after a delay
        setTimeout(() => {
            this.currentGesture = 'None';
            this.updateStatus();
        }, 1000);
    }

    executeAction(action, intensity) {
        switch (action) {
            case 'scroll_up':
                this.scrollUp(intensity);
                break;
            case 'scroll_down':
                this.scrollDown(intensity);
                break;
            case 'click':
                this.handleClick();
                break;
            case 'scroll_right':
                this.scrollRight(intensity);
                break;
            case 'scroll_left':
                this.scrollLeft(intensity);
                break;
            case 'zoom_in':
                this.zoomIn();
                break;
            case 'zoom_out':
                this.zoomOut();
                break;
        }
    }

    isGalleryMode() {
        return document.querySelector('.gallery-stage') || window.location.pathname.endsWith('gallery.html');
    }

    // Zoom Stubs (for now)
    zoomIn() {
        document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) + 0.1);
        this.lastAction = 'Zoom On';
        this.updateStatus();
    }

    zoomOut() {
        document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) - 0.1);
        this.lastAction = 'Zoom Out';
        this.updateStatus();
    }

    handleSubmit() {
        // Placeholder
    }

    scrollUp(intensity = 1) {
        window.scrollBy({
            top: -this.scrollAmount * intensity,
            behavior: 'smooth'
        });
        this.lastAction = `Scrolled Up (${intensity.toFixed(1)}x)`;
        this.showFeedback('↑ Scrolling Up');
        this.updateStatus();
    }

    scrollDown(intensity = 1) {
        window.scrollBy({
            top: this.scrollAmount * intensity,
            behavior: 'smooth'
        });
        this.lastAction = `Scrolled Down (${intensity.toFixed(1)}x)`;
        this.showFeedback('↓ Scrolling Down');
        this.updateStatus();
    }

    scrollLeft(intensity = 1) {
        const gallery = document.querySelector('.gallery-stage');

        // "Page Turn" Physics: Simulating a larger, smoother movement
        const pageTurnAmount = window.innerWidth * 0.85;
        const isStandaloneGallery = document.body.style.overflow === 'hidden' ||
            window.location.pathname.endsWith('gallery.html');

        const scrollAmount = isStandaloneGallery ? pageTurnAmount : (this.scrollAmount * 2.5);

        if (gallery) {
            gallery.scrollBy({
                left: -scrollAmount * intensity,
                behavior: 'smooth'
            });
        } else {
            window.scrollBy({
                left: -scrollAmount * intensity,
                behavior: 'smooth'
            });
        }
        this.lastAction = `Page Back (${intensity.toFixed(1)}x)`;
        this.showFeedback('⏮ Page Back');
        this.updateStatus();
    }

    scrollRight(intensity = 1) {
        const gallery = document.querySelector('.gallery-stage');

        const pageTurnAmount = window.innerWidth * 0.85;
        const isStandaloneGallery = document.body.style.overflow === 'hidden' ||
            window.location.pathname.endsWith('gallery.html');

        const scrollAmount = isStandaloneGallery ? pageTurnAmount : (this.scrollAmount * 2.5);

        if (gallery) {
            gallery.scrollBy({
                left: scrollAmount * intensity,
                behavior: 'smooth'
            });
        } else {
            window.scrollBy({
                left: scrollAmount * intensity,
                behavior: 'smooth'
            });
        }
        this.lastAction = `Page Next (${intensity.toFixed(1)}x)`;
        this.showFeedback('Page Next ⏭');
        this.updateStatus();
    }

    startContinuousScroll(gesture, intensity = 1) {
        if (this.activeContinuousGesture === gesture) {
            // Update intensity if already running
            this.currentContinuousIntensity = intensity;
            return;
        }

        this.stopContinuousScroll();
        this.activeContinuousGesture = gesture;
        this.currentContinuousIntensity = intensity;

        const isVertical = gesture.includes('up') || gesture.includes('down');
        const direction = (gesture.includes('down') || gesture.includes('right')) ? 1 : -1;

        this.scrollInterval = setInterval(() => {
            // Adaptive Speed: 18 * Math.pow(intensity, 1.5) curve
            const scrollStep = 18 * Math.pow(this.currentContinuousIntensity, 1.5) * direction;

            if (isVertical) {
                window.scrollBy(0, scrollStep);
            } else {
                const gallery = document.querySelector('.gallery-stage');
                if (gallery) {
                    gallery.scrollBy({ left: scrollStep, behavior: 'auto' });
                } else {
                    window.scrollBy(scrollStep, 0);
                }
            }

            const directionName = this.formatGestureName(gesture.replace('tilt-', ''));
            const speedPct = Math.round(this.currentContinuousIntensity * 100);
            this.lastAction = `Continuous ${directionName} (${speedPct}%)`;
            this.updateStatus();
        }, 16); // ~60fps
    }

    stopContinuousScroll() {
        if (this.scrollInterval) {
            clearInterval(this.scrollInterval);
            this.scrollInterval = null;
            this.activeContinuousGesture = null;
        }
    }

    handleClick() {
        // Use coordinates from the specialized MouseController if it exists (global sync)
        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;

        const cursor = document.getElementById('hand-cursor');
        if (cursor && cursor.style.left) {
            x = parseFloat(cursor.style.left);
            y = parseFloat(cursor.style.top);
        }

        const elem = document.elementFromPoint(x, y);
        if (elem) {
            this.lastAction = 'Pinky Click';
            this.showFeedback('🖱️ Click!');
            elem.click();
        }
        this.updateStatus();
    }



    formatGestureName(gesture) {
        return gesture.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    updateStatus() {
        // Update hand detection status
        const handStatus = document.getElementById('hand-status');
        const handStatusItem = handStatus.closest('.status-item');
        if (this.handDetected) {
            handStatus.textContent = 'Detected ✓';
            handStatus.style.color = '#4CAF50';
            handStatusItem.classList.add('status-active');
            handStatusItem.classList.remove('status-inactive');
        } else {
            handStatus.textContent = 'Not Detected';
            handStatus.style.color = '#f44336';
            handStatusItem.classList.add('status-inactive');
            handStatusItem.classList.remove('status-active');
        }

        // The gesture detection has a cooldown period of 600ms to prevent multiple triggers from a single gesture. This makes the interaction feel more natural and controlled while remaining responsive.
        // Update gesture
        const gestureStatus = document.getElementById('gesture-status');
        const gestureStatusItem = gestureStatus.closest('.status-item');
        gestureStatus.textContent = this.currentGesture;

        if (this.currentGesture !== 'None') {
            gestureStatusItem.classList.add('gesture-detected');
        } else {
            gestureStatusItem.classList.remove('gesture-detected');
        }

        // Update last action
        const actionStatus = document.getElementById('action-status');
        actionStatus.textContent = this.lastAction;
    }

    showFeedback(message) {
        const feedback = document.getElementById('action-feedback');
        feedback.textContent = message;
        feedback.classList.add('show');

        setTimeout(() => {
            feedback.classList.remove('show');
        }, 1500);
    }
}

export default NavigationController;
