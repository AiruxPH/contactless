# Task: Refine 3D Gimbal & Calibration Fix

## Context
I have successfully implemented a 3D Hand Gimbal system using MediaPipe world landmarks. However, the 'Facing Guard' is currently too strict, causing the system to report 'Not Facing' even during natural interaction. I also want to refine the math using the Palm Center as a true median.

## Objectives
1. **Relax Facing Thresholds:** Adjust the logic to allow for natural webcam angles and hand "sway."
2. **Median Anchor Logic:** Use the Palm Center (Midpoint of [0] and [9]) as the absolute zero-pivot for both Pitch and Yaw.
3. **Unit Consistency:** Ensure dead-zones and max angles in the Navigation Controller use matching degree units.

## Technical Requirements

### 1. Update `js/gesture-detector.js`
- **Median Pitch:** Calculate Pitch by comparing the Z-depth of **Wrist [0]** and **Middle MCP [9]**, using the **Palm Center** as the zero-pivot point.
- **Facing Guard Adjustment:** Update `isFacingCamera` thresholds to be more lenient. Change to: `Math.abs(pitchDegrees) < 55 && Math.abs(yawDegrees) < 60`.
- **Text Rendering Fix:** Ensure landmark index labels on the canvas are readable when mirrored by applying `ctx.scale(-1, 1)` before drawing text.

### 2. Update `js/navigation-controller.js`
- **Unit Sync:** Ensure the `deadzone` (currently 12) and `maxAngle` (currently 45) consistently use degrees to drive the `currentContinuousIntensity` calculation.
- **Dead-man Switch:** Add a listener for `handDetected === false`. If the hand is lost, immediately call `stopContinuousScroll()` to prevent the page from scrolling indefinitely.

### 3. Analytics Update (`js/analytics-controller.js`)
- Ensure the **Facing Direction** status in the UI turns Red (False) and Green (True) correctly based on the updated 55°/60° thresholds.

## Implementation Detail: Median Gimbal Math
Please use the following mathematical approach for the Gimbal update:
- **Pivot Point:** Treat the Palm Center as the 3D origin.
- **Pitch Math:** `Math.atan2(worldLandmarks[9].z - worldLandmarks[0].z, -(worldLandmarks[9].y - worldLandmarks[0].y))`.
- **Thresholds:** Set `isFacingCamera` to `true` if `abs(Pitch) < 55` AND `abs(Yaw) < 60`.
- **Dead-man Switch:** In `navigation-controller.js`, ensure `stopContinuousScroll()` is called immediately if `handDetected` is `false`.