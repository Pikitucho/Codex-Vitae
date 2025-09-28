# Avatar Stage Defaults

The avatar stage now loads without a baked-in illustration. When the dashboard boots, the `<img id="captured-photo">` node is rendered without a `src` and remains hidden until the user scans or uploads an asset. This keeps the experience focused on personal avatars rather than a stock illustration.

## How the empty state works

- The stage keeps the `.is-placeholder` class so the layered gradients in `CSS/style.css` provide a polished empty slate.
- Once a capture or upload completes, the application swaps the hidden `<img>` for either the captured photo or a `<model-viewer>` instance and removes the placeholder styling.
- Clearing an avatar simply removes the `src`, hides the element again, and reapplies the placeholder class—no default image file is involved.

## Customizing the presentation

- To change the look of the empty stage, adjust the `.avatar-stage` and `.avatar-stage.is-placeholder` rules. Gradients and box shadows intentionally sell the idea of a waiting holographic bay.
- Teams that still want a branded fallback image can inject one by providing a URL in the profile data; the UI will treat it like any other uploaded photo.
- If you need additional guidance text, consider adding a caption or button copy near the scan/upload controls rather than reintroducing a static portrait.

With this setup every profile starts from a clean slate, and the avatar slot reflects the user's own scans or uploads exclusively.
