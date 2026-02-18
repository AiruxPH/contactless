# Task: Post-Crash Stabilization & Performance Cleanup

## 1. Landmark Array Guard (`js/gesture-detector.js`)
To prevent the 'Cannot read properties of undefined' error from ever returning:
- At the very top of `drawHandLandmarks` and `detectGesture`, add a strict length check: 
  `if (!landmarks || landmarks.length < 21) return;`.

## 2. Sync Handedness Data (`js/gesture-detector.js`)
- Update the handedness parsing to match the latest MediaPipe standard:
  Change `results.handedness[0][0]` to `results.handedness[0]`.
- Why: This ensures your `yawDegrees` (Horizontal Tilt) math receives the correct 'Left' or 'Right' label.

## 3. Restore the "Noise Gate" (`js/navigation-controller.js`)
Ensure the jitter fix we discussed is fully active:
- In `startPhysicsLoop`, verify that if the combined velocity is `< 0.8`, it is forced to `0`.
- In the `handFrame` listener, ensure the 70/30 smoothing is applied to intensities:
  `this.pitchIntensity = (this.pitchIntensity * 0.7) + (newIntensity * 0.3);`.

## 4. Optimization for Three.js Simulator
- Ensure that the `emitHandFrame` call happens **before** you pass landmarks to any Three.js functions. 
- This guarantees the Mouse and Navigation controllers get the 'Clean' 2D data before the simulator potentially transforms it for 3D space.