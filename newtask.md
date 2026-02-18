# Task: Final Polish for Cursor Snappiness & Gallery Friction

## 1. Update `js/mouse-controller.js`
- Increase `maxLerp` from `0.35` to **`0.5`**. 
- This will work with your existing `Math.pow(lerpT, 2)` logic to make the cursor feel lighter and faster during deliberate moves while remaining stable when still.

## 2. Update `js/navigation-controller.js`
- Update the `friction` logic to be context-aware.
- **The Rule:** If `this.isGalleryMode()` is true, use a friction of **`0.88`**. Otherwise, keep the default **`0.92`**.
- This will give the AntiGravity Gallery cards more "physical weight" and prevent them from flying off-screen too easily.