class NavigationController {
    constructor(gestureDetector) {
        this.gestureDetector = gestureDetector;
        this.scrollAmount = 300; // pixels to scroll
        this.currentGesture = 'None';
        this.lastAction = 'None';
        this.handDetected = false;

        // Continuous scrolling state
        this.scrollInterval = null;
        this.activeContinuousGesture = null;

        this.init();
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
                this.updateStatus();
            }
        });

        this.updateStatus();
    }

    handleGesture(gesture, data) {
        this.currentGesture = this.formatGestureName(gesture);
        this.updateStatus();

        // Handle continuous gesture lifecycle
        if (gesture.includes('tilt')) {
            this.startContinuousScroll(gesture);
        } else if (gesture === 'pinch-start') {
            this.handleClick();
        } else if (gesture === 'pinch-end') {
            // No specific action for end yet
        } else {
            // Impulse gestures (swipes, flicks)
            this.stopContinuousScroll();

            // Calculate intensity for flicks
            let intensity = 1;
            if (data && data.velocity) {
                // Map velocity to intensity (e.g., 1.5 to 5.0 velocity -> 1.0 to 3.0 intensity)
                intensity = Math.min(Math.max(data.velocity / 1.5, 1), 4);
            }

            switch (gesture) {
                case 'swipe-down':
                case 'finger-flick-down':
                    this.scrollDown(intensity);
                    break;
                case 'swipe-up':
                case 'finger-flick-up':
                    this.scrollUp(intensity);
                    break;
                case 'swipe-left':
                    this.navigateNext(); // Snap to next section
                    break;
                case 'swipe-right':
                    this.navigatePrev(); // Snap to prev section
                    break;
            }
        }

        // Reset gesture display after a delay
        setTimeout(() => {
            this.currentGesture = 'None';
            this.updateStatus();
        }, 1000);
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

    startContinuousScroll(gesture) {
        if (this.activeContinuousGesture === gesture) return;

        this.stopContinuousScroll();
        this.activeContinuousGesture = gesture;

        const scrollStep = gesture.includes('down') ? 10 : -10;
        this.scrollInterval = setInterval(() => {
            window.scrollBy(0, scrollStep);
            this.lastAction = `Continuous ${gesture.includes('down') ? 'Down' : 'Up'}`;
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
        // Simulate a click at the center of the viewport or cursor position
        // For now, just show feedback
        this.lastAction = 'Pinch Click';
        this.showFeedback('🖱️ Click!');
        this.updateStatus();

        // Practical implementation: find element under cursor or center
        const x = window.innerWidth / 2;
        const y = window.innerHeight / 2;
        const elem = document.elementFromPoint(x, y);
        if (elem) elem.click();
    }

    navigatePrev() {
        const sections = Array.from(document.querySelectorAll('section'));
        const currentScroll = window.scrollY;
        const target = [...sections].reverse().find(s => s.offsetTop < currentScroll - 10);

        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
            this.lastAction = 'Section Up';
            this.showFeedback('⏮ Section Up');
        }
        this.updateStatus();
    }

    navigateNext() {
        const sections = Array.from(document.querySelectorAll('section'));
        const currentScroll = window.scrollY;
        const target = sections.find(s => s.offsetTop > currentScroll + 10);

        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
            this.lastAction = 'Section Down';
            this.showFeedback('⏭ Section Down');
        }
        this.updateStatus();
    }

    navigateNext() {
        const sections = Array.from(document.querySelectorAll('section'));
        const currentScroll = window.scrollY;
        const target = sections.find(s => s.offsetTop > currentScroll + 10);

        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
            this.lastAction = 'Section Down';
            this.showFeedback('⏭ Section Down');
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
