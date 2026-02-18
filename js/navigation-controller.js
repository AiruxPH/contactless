class NavigationController {
    constructor(gestureDetector) {
        this.gestureDetector = gestureDetector;
        this.currentGesture = 'None';
        this.lastAction = 'None';
        this.handDetected = false;

        // Physics State
        this.velocityX = 0;
        this.velocityY = 0;
        this.friction = 0.92;
        this.activeAxis = null; // 'pitch', 'yaw', or null

        // Intensity & Direction
        this.pitchIntensity = 0;
        this.yawIntensity = 0;
        this.pitchDirection = 0;
        this.yawDirection = 0;

        // Mappings
        this.mappings = this.loadMappings();
        this.defaultMappings = {
            'finger-flick-up': 'scroll_down',
            'finger-flick-down': 'scroll_up',
            'finger-flick-left': 'scroll_right',
            'finger-flick-right': 'scroll_left',
            'pinky-click': 'click'
        };

        this.init();
        this.startPhysicsLoop();
    }

    loadMappings() {
        const saved = localStorage.getItem('gestureMappings');
        if (!saved) return {};
        const actionToGestures = JSON.parse(saved);
        const gestureToAction = {};
        for (const [action, gestures] of Object.entries(actionToGestures)) {
            if (Array.isArray(gestures)) {
                gestures.forEach(gesture => { gestureToAction[gesture] = action; });
            } else {
                gestureToAction[gestures] = action;
            }
        }
        return gestureToAction;
    }

    init() {
        this.gestureDetector.onGesture((gesture, data) => {
            this.handleGesture(gesture, data);
        });

        window.addEventListener('detectorStatus', (e) => {
            const { type, data } = e.detail;
            if (type === 'handDetected') {
                this.handDetected = data;
                if (!data) this.resetPhysics();
                this.updateStatus();
            }
        });

        window.addEventListener('mappingUpdated', () => {
            this.mappings = this.loadMappings();
        });

        // "Joystick Drift" - Continuous Tracking & Axis Locking
        window.addEventListener('handFrame', (e) => {
            const { pitch, yaw, handDetected, handOpen, isFacingCamera } = e.detail;

            if (!handDetected) {
                this.activeAxis = null;
                this.pitchIntensity = 0;
                this.yawIntensity = 0;
                return;
            }

            const deadzone = 12;
            const absPitch = Math.abs(pitch);
            const absYaw = Math.abs(yaw);

            // Axis Reset in Deadzone
            if (absPitch < deadzone && absYaw < deadzone) {
                this.activeAxis = null;
                this.pitchIntensity = 0;
                this.yawIntensity = 0;
                return;
            }

            // Apply dominant axis logic only when starting from neutral
            if (this.activeAxis === null) {
                if (absPitch > absYaw + 5) {
                    this.activeAxis = 'pitch';
                } else if (absYaw > absPitch + 5) {
                    this.activeAxis = 'yaw';
                }
            }

            // Continuous Acceleration (Joystick Drift)
            const maxAngle = 55;
            const powerFactor = (1 - this.friction); // Steady state calibration

            if (this.activeAxis === 'pitch' && handOpen && isFacingCamera) {
                this.pitchIntensity = (absPitch - deadzone) / (maxAngle - deadzone);
                this.pitchIntensity = Math.min(Math.max(this.pitchIntensity, 0), 3.0);
                this.pitchDirection = pitch > 0 ? 1 : -1;

                const accel = (18 * Math.pow(this.pitchIntensity, 1.5)) * powerFactor;
                this.velocityY += accel * this.pitchDirection;
                this.lastAction = 'DRIVING ↑↓';
            } else if (this.activeAxis === 'yaw' && handOpen && isFacingCamera) {
                this.yawIntensity = (absYaw - deadzone) / (maxAngle - deadzone);
                this.yawIntensity = Math.min(Math.max(this.yawIntensity, 0), 3.0);
                this.yawDirection = yaw > 0 ? 1 : -1;

                const accel = (18 * Math.pow(this.yawIntensity, 1.5)) * powerFactor;
                this.velocityX += accel * this.yawDirection;
                this.lastAction = 'DRIVING ←→';
            }
        });

        this.updateStatus();
    }

    startPhysicsLoop() {
        const loop = () => {
            // 1. Friction Decay
            this.velocityX *= this.friction;
            this.velocityY *= this.friction;

            // 2. GLIDING detection (when hand is neutral or lost but still moving)
            const speed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
            if (this.activeAxis === null && speed > 2) {
                this.lastAction = 'GLIDING...';
            } else if (this.activeAxis === null && speed <= 2 && this.lastAction.includes('GLIDING')) {
                this.lastAction = 'Stationary';
            }

            // 3. Application of Velocity
            if (speed > 0.1) {
                const gallery = document.querySelector('.gallery-stage');
                if (gallery && Math.abs(this.velocityX) > 0.1) {
                    gallery.scrollBy({ left: this.velocityX, behavior: 'auto' });
                } else {
                    window.scrollBy({ left: this.velocityX, top: this.velocityY, behavior: 'auto' });
                }
                this.updateStatus();
            }

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    resetPhysics() {
        this.activeAxis = null;
        this.pitchIntensity = 0;
        this.yawIntensity = 0;
    }

    handleGesture(gesture, data) {
        if (gesture.includes('tilt')) return; // Tilts handled by Frame loop

        this.currentGesture = this.formatGestureName(gesture);
        const action = this.getActionForGesture(gesture);

        if (gesture === 'pinky-click') {
            this.handleClick();
        } else if (action && action.startsWith('scroll')) {
            // Snap-Flick (Impulse Injection)
            this.injectFlickImpulse(action, data);
            this.showFeedback('FLICK ⚡');
        }

        setTimeout(() => {
            this.currentGesture = 'None';
            this.updateStatus();
        }, 1000);
    }

    injectFlickImpulse(action, data) {
        // Recalibrate Impulse: Injection / (1 - friction) = Total Distance
        // 48 / 0.08 = 600px Total Glide
        const verticalPower = 600 * (1 - this.friction);
        const horizontalPower = (window.innerWidth * 0.8) * (1 - this.friction);

        switch (action) {
            case 'scroll_up':
                this.velocityY -= verticalPower;
                this.lastAction = 'FLICK Up';
                break;
            case 'scroll_down':
                this.velocityY += verticalPower;
                this.lastAction = 'FLICK Down';
                break;
            case 'scroll_left':
                this.velocityX -= this.isGalleryMode() ? horizontalPower : verticalPower;
                this.lastAction = 'FLICK Left';
                break;
            case 'scroll_right':
                this.velocityX += this.isGalleryMode() ? horizontalPower : verticalPower;
                this.lastAction = 'FLICK Right';
                break;
        }
    }

    getActionForGesture(gesture) {
        return this.mappings[gesture] || this.defaultMappings[gesture] || null;
    }

    isGalleryMode() {
        return !!document.querySelector('.gallery-stage');
    }

    handleClick() {
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
        return gesture.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    updateStatus() {
        const handStatus = document.getElementById('hand-status');
        const hText = this.handDetected ? 'Detected ✓' : 'Not Detected';
        if (handStatus && handStatus.textContent !== hText) {
            handStatus.textContent = hText;
            handStatus.style.color = this.handDetected ? '#4CAF50' : '#f44336';
        }

        const gestureStatus = document.getElementById('gesture-status');
        if (gestureStatus && gestureStatus.textContent !== this.currentGesture) {
            gestureStatus.textContent = this.currentGesture;
        }

        const actionStatus = document.getElementById('action-status');
        if (actionStatus && actionStatus.textContent !== this.lastAction) {
            actionStatus.textContent = this.lastAction;
        }
    }

    showFeedback(message) {
        const feedback = document.getElementById('action-feedback');
        if (!feedback) return;
        feedback.textContent = message;
        feedback.classList.add('show');
        setTimeout(() => feedback.classList.remove('show'), 1500);
    }
}

export default NavigationController;
