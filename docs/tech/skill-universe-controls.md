# Skill Universe Control Scheme

The Skill Universe viewer supports a hybrid mouse and touch orbit workflow. After the 2024-05 controls refresh the following gestures are available:

## Desktop
- **Pan:** Click and drag with the left mouse button.
- **Rotate:** Click and drag with the right mouse button. Holding <kbd>Shift</kbd> while left-dragging also rotates.
- **Zoom:** Use the scroll wheel or press and drag with the middle mouse button.

## Touch
- **Orbit:** Drag with a single finger.
- **Zoom:** Pinch with two fingers. The camera can be repositioned while pinching.
- **Pan:** Drag with three fingers when finer target adjustments are needed.

## Manual regression checklist
Perform these steps whenever the Skill Universe renderer or control wiring is modified:

1. Open the Skill Universe view on a desktop browser.
2. Drag with the **left** mouse button and confirm the scene pans without changing tilt.
3. Drag with the **right** mouse button and confirm the camera tilts vertically and orbits horizontally.
4. Scroll the wheel and drag with the **middle** mouse button to confirm zoom in/out works smoothly.
5. Repeat steps 2–4 after selecting a star to ensure tweens cancel and manual control resumes immediately.
6. On a touch device (or emulator), drag with a single finger to orbit around the focus target.
7. Use a two-finger pinch to dolly the camera in and out and verify that the view can still be panned during the gesture.
8. Drag with three fingers to translate the camera target without changing orbit tilt.

Document the date and environment of the run in QA notes or release tickets as needed.
