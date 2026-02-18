# Task: Fix Persistent Handedness Error

## Objective
The system is currently misidentifying the Right hand as 'Left'. We need to stop over-correcting the Handedness label and instead trust the anatomical detection from MediaPipe.

## Technical Requirements
1. **Trust the Model:** In `js/gesture-detector.js`, remove the mirror-based toggle for the `handedness` label. Set it to trust the `handedness.categoryName` directly.
2. **Yaw Sync:** Ensure `yawDegrees` is multiplied by `-1` only when the model physically detects a 'Left' hand anatomy.
3. **Mirror Alignment:** Ensure the `isMirror` property only affects the CSS `scaleX(-1)` and does not interfere with the anatomical logic.
4. **Visual Check:** Update `analytics-controller.js` so that if the model says 'Right', the UI displays 'Right' regardless of which side of the screen the hand is on.