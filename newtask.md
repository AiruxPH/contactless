# Task: Stabilize Jittery Cursor & Navigation Physics

## Objective
Implement signal filtering to eliminate landmark noise. Ensure that the cursor and scrolling remain perfectly still when the hand is stable, only reacting to deliberate intent.

## Technical Requirements

### 1. Velocity Dead-Zones (The Noise Gate)
Update `js/navigation-controller.js` to ignore micro-velocities.
- **Threshold Gate:** Inside the physics loop, if `Math.sqrt(velocityX^2 + velocityY^2) < 0.5`, force both velocities to absolute zero.
- **Why:** This prevents the "drifting" feel where the page creeps slowly because of landmark vibration.

### 2. Weighted Moving Average (Smoothing)
Refine how tilt intensity is calculated in `js/navigation-controller.js`.
- **Smoothing Factor:** Instead of using the raw `pitchIntensity` from a single frame, average it with the previous frame: `this.pitchIntensity = (this.pitchIntensity * 0.7) + (newIntensity * 0.3)`.
- **Result:** This "Low-Pass Filter" ignores sudden spikes in data (jitter) and only tracks the smooth trend of your hand's tilt.

### 3. Flick Velocity Guard
Stabilize the `injectFlickImpulse` logic.
- **Minimum Impact:** Require a higher velocity threshold from the `GestureDetector` before injecting impulse.
- **Snap Guard:** Confirm that `finger-flick` events only trigger if the hand has been open and stable for at least 3 frames to avoid "jitter-flicks".

### 4. Cursor Stabilization (`js/mouse-controller.js`)
- **Exponential Smoothing:** Increase the `smoothingFactor` logic. If the hand speed is low, aggressively increase smoothing to "anchor" the cursor in place.