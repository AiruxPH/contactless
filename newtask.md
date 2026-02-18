# Task: Solidify Scrolling & Remove Redundant Logic

## Objective
Reduce the 12 existing scrolling gestures to 2 highly stable modes: Continuous Gimbal Drifting and High-Velocity Finger Flicks.

## Technical Requirements

### 1. Cleanup `js/navigation-controller.js`
- **Remove Swipes:** Delete all 'swipe-up/down/left/right' logic. We will rely on Flicks for impulse movement.
- **Refine Continuous Mode:** Focus purely on `Pitch` (Vertical) and `Yaw` (Horizontal) degrees.
- **Adaptive Speed:** Ensure the `18 * Math.pow(intensity, 1.5)` curve is applied to all continuous movement.

### 2. Cleanup `js/gesture-detector.js`
- **Flick Shield:** Only detect `finger-flick` gestures if `palmSpeed < 0.15` (meaning the hand is stationary).
- **Snap Guard:** Maintain the `pinkyVelocity` check to ensure the Pinky Click remains an independent utility action that doesn't trigger scrolls.

### 3. UI Sync
- Update the **Quick Guide** in `index.html` and `gallery.html` to reflect the new simplified controls: 
  - 🖐️ **Tilt:** Continuous Drift
  - ☝️ **Flick:** Power Scroll