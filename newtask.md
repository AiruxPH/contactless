# Task: Separate Contactless Zoom and Click Gestures

## Context
I am building a contactless navigation system using MediaPipe landmarks. Currently, a 'pinch' (Thumb + Index) is used for both clicking and zooming, which causes accidental clicks while zooming. I want to transition to a new control scheme.

## Objective
Update the existing logic to assign specific fingers to specific tasks:
1. **Zooming:** Reserved for the distance between **Thumb Tip [4]** and **Index Tip [8]**.
2. **Clicking:** Reserved for a **Pinky Tap** (moving **Pinky Tip [20]** toward the palm).

## Technical Requirements

### 1. Update `js/gesture-detector.js`
- **Normalization:** Ensure all finger movements are normalized using the `getHandScale` logic (Wrist [0] to Middle Finger MCP [9]).
- **New Gesture Detection:** Implement `detectPinkyClick`. A click should trigger when the distance between **Pinky Tip [20]** and **Pinky MCP [17]** decreases below a normalized threshold (e.g., 0.5 of hand scale).
- **Emit Events:** Emit a new `pinky-click` event and ensure it is distinct from the existing `pinch-start`.

### 2. Update `js/mouse-controller.js`
- **Decouple Logic:** Move the `startInteraction()` (click) trigger from `pinch-start` to the new `pinky-click` event.
- **Dedicated Zoom:** Update the `updateLoop` to use the normalized distance between [4] and [8] specifically for zooming the `#zoom-target`. 
- **Freeze Filter:** Maintain the 'Click-Lock' feature so that when a `pinky-click` is detected, the cursor coordinates freeze for 150ms to ensure accuracy.

### 3. Visual Feedback
- Update the `#hand-cursor` in `css/style.css` or the JS controller to provide a unique visual cue (like a color change to Green) specifically when the Pinky Click is active, distinguishing it from the 'Pinch/Zoom' glow.