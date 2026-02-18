# Task: Synchronize Handedness for 3D Gimbal

## Context
The current 3D orientation logic (Yaw/Pitch) is inconsistent because it does not account for the mirror-image anatomy of the left and right hands. This causes horizontal tilt-scrolling to be reversed when switching hands.

## Objective
Ensure that 'Tilting Right' moves the content the same way regardless of whether the user is using their Left or Right hand.

## Technical Requirements

### 1. Update `js/gesture-detector.js`
- **Yaw Inversion:** Inside the `worldLandmarks` logic, use the `handedness` label to normalize the Yaw degrees.
- **The Logic:** - If `handedness` is 'Left', multiply the final `yawDegrees` by `-1`.
    - This ensures that a "Pinky-Down" rotation on the left hand produces the same positive/negative value as a "Pinky-Down" rotation on the right hand.
- **Gimbal Synchronization:** Ensure the `emitHandFrame` event sends the corrected, normalized degrees so that the `NavigationController` receives consistent data.

### 2. Update `js/analytics-controller.js`
- **Visual Confirmation:** Ensure the 'Handedness' metric in the Data Station correctly reflects 'Left' or 'Right' in real-time.
- **Sync Status:** Add a small indicator or log entry that confirms when 'Handedness Correction' is active.

### 3. Navigation Sync (`js/navigation-controller.js`)
- **Global Units:** Double-check that horizontal tilt gestures ('tilt-left', 'tilt-right') are triggered using the newly normalized handedness data so they are consistent across both hands.