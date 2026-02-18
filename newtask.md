# Task: Refine Navigation to Physical "Touch & Flick" Model

## Objective
Transform the mid-air scrolling into a physical simulation that mimics a smartphone. The 3D Gimbal will act as a 'Virtual Thumb' for continuous dragging (Joystick Drift), and finger snaps will act as 'Hard Swipes' (Snap-Flick).

## Technical Requirements

### 1. Axis Locking & Intent Detection (`js/navigation-controller.js`)
To prevent diagonal drift and jitter, implement an axis-lock:
- **Dominant Axis Logic:** Compare the absolute values of `Pitch` and `Yaw`. 
- If `Math.abs(pitch) > Math.abs(yaw) + 5`, lock the horizontal axis to 0 and focus purely on vertical scrolling.
- If `Math.abs(yaw)` is dominant (primarily in Gallery mode), lock the vertical axis to 0.
- **Reset:** Unlock the axes only when the hand returns to the neutral deadzone (12°).

### 2. The "Joystick Drift" (Continuous Dragging)
Refine the continuous scroll physics to include momentum:
- **Velocity Accumulation:** Instead of scrolling by a fixed degree value, use the tilt intensity to add "acceleration" to a velocity variable.
- **Friction (Decay Factor):** Apply a friction coefficient of `0.92`. When the hand levels out, the velocity should multiply by `0.92` every frame, causing the content to glide to a smooth stop rather than freezing instantly.
- **Curve Sync:** Maintain the `18 * Math.pow(intensity, 1.5)` curve as the base for this acceleration.

### 3. The "Snap-Flick" (Page Flings)
Sync finger snaps with high-impact movement:
- **Impulse Trigger:** When a `finger-flick` is detected (already shielded by `palmSpeed < 0.15`), trigger a one-time large scroll offset.
- **Impact:** Map a flick to a `600px` jump (Vertical) or a `pageTurn` amount (Horizontal Gallery) to mimic 'flinging' a phone screen.

### 4. UI Feedback Sync
- Ensure the **Action Feedback** overlay displays "DRIVING" during continuous drift and "FLICK" during snap-flicks to help the user distinguish the two modes.