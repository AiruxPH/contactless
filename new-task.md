I have built a modular contactless navigation system using MediaPipe. I need to improve the gesture accuracy and 'mouse' feel by moving away from fixed pixel thresholds to adaptive, normalized physics. Please help me update the following logic:

1. Adaptive Scaling (Hand-Size Normalization):
In js/gesture-detector.js, I need to stop using hardcoded distance thresholds (like 0.05 for pinches).

The Logic: Calculate a handScale based on the distance between the Wrist (Landmark 0) and the Middle Finger Base (Landmark 9).

The Goal: Update getDistance or create a getNormalizedDistance function so that a 'pinch' or a 'flick' is detected the same way whether the hand is 1 meter or 30 centimeters from the camera.

2. Frictionless Cursor Smoothing (EMA Filtering):
In js/mouse-controller.js, the cursor is currently too jittery.

The Logic: Implement an Exponential Moving Average (EMA) for the cursorX and cursorY coordinates.

The Goal: Instead of snapping to new coordinates, the cursor should 'drift' smoothly toward the target (e.g., current = (target * 0.2) + (current * 0.8)) to create a weightless, premium feel.

3. Precision Click-Locking:
Update the startInteraction method in js/mouse-controller.js.

The Logic: To prevent 'cursor slip' during a pinch, implement a temporary coordinate lock.

The Goal: When isPinching becomes true, freeze the cursorX and cursorY values for 150ms to ensure the click hits the exact button the user intended.

4. Visual Polish (AntiGravity Style):
Update css/style.css and the updateLoop in js/mouse-controller.js to reflect gesture intensity:

Interactive Glow: Increase the box-shadow/glow of the #hand-cursor based on the pinchDistance—the closer the fingers get, the tighter and brighter the glow becomes.

Magnetic Targets: Add logic to 'snap' the cursor slightly toward .target-button elements when it enters their bounding box.

The goal is to make the interface feel like it’s controlled by intention and light, rather than raw, noisy sensor data.