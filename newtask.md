# Task: Implement Phone-Style "Touch & Flick" Navigation

## Objective
Transform the current navigation logic into a physical simulation that mimics how we scroll on a smartphone. Use the 3D Gimbal as a "virtual thumb" and the Flick Shield as a "page flipper."

## Technical Requirements

### 1. Axis Locking (The Stability Pillar)
Update `js/navigation-controller.js` to prioritize intent.
- **Vertical Priority:** If the absolute `Pitch` (vertical tilt) is greater than the absolute `Yaw` (horizontal tilt), ignore all horizontal drift data until the hand returns to the neutral zone.
- **Horizontal Priority:** If `Yaw` is triggered first (e.g., in the Gallery), ignore vertical drift. This prevents diagonal "jitter" while reading.

### 2. Physical Momentum & Friction (The Polish)
Introduce "weight" to the scrolling so it doesn't stop abruptly.
- **Velocity Accumulation:** Instead of moving the page exactly by the tilt degrees, use the degree value to add "acceleration" to a local velocity variable.
- **Friction (Decay):** Apply a friction coefficient (e.g., `0.92`) so that when the hand returns to neutral, the page glides to a smooth stop over a few milliseconds rather than freezing instantly.

### 3. Smart-Flick Integration (Page Flips)
Sync the high-velocity snaps with the navigation speed.
- **The Trigger:** Ensure `finger-flick` gestures remain guarded by `palmSpeed < 0.15` in `js/gesture-detector.js`.
- **The Result:** Mapping a flick to a large, one-time scroll increment (e.g., 600px) to simulate a "hard swipe" on a phone screen.

### 4. Mathematical Curve Sync
- Continue using `18 * Math.pow(intensity, 1.5)` as the base multiplier for the acceleration variable to maintain precise control at low angles.