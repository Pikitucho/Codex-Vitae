import { readFileSync } from 'fs';
import vm from 'vm';

describe('browser bootstrap scripts', () => {
  it('ships a complete Firebase web config so GitHub Pages can boot without config.runtime.json', async () => {
    const source = readFileSync('config.js', 'utf-8');
    const fetchMock = jest.fn();
    const context: any = {
      window: {},
      console: {
        warn: jest.fn(),
        error: jest.fn(),
        log: jest.fn()
      },
      fetch: fetchMock,
      Promise
    };
    context.window.window = context.window;
    context.window.console = context.console;
    context.window.fetch = fetchMock;

    vm.runInNewContext(source, context, { filename: 'config.js' });

    await expect(context.window.__CODEX_CONFIG_READY__).resolves.toEqual(
      expect.objectContaining({
        firebaseConfig: expect.objectContaining({
          apiKey: expect.any(String),
          authDomain: expect.stringContaining('firebaseapp.com'),
          projectId: expect.any(String),
          appId: expect.any(String)
        })
      })
    );

    expect(context.window.__CODEX_CONFIG__.firebaseConfig.apiKey).not.toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exposes OrbitControls through a mutable Three.js facade instead of mutating the module namespace', () => {
    const source = readFileSync('js/three-bootstrap.js', 'utf-8');

    expect(source).toContain('const threeFacade = { ...THREE, OrbitControls };');
    expect(source).toContain('window.THREE = threeFacade;');
    expect(source).not.toContain('THREE.OrbitControls = OrbitControls;');
  });

  it('loads the preview app without the runtime config script', () => {
    const html = readFileSync('index.html', 'utf-8');
    const main = readFileSync('js/main.js', 'utf-8');
    const configSrc = 'config.js?v=20260517';
    const mainSrc = 'js/main.js?v=20260517';

    expect(html).not.toContain(configSrc);
    expect(html).toContain(mainSrc);
    expect(html).not.toContain('v=20240621');
    expect(html).not.toContain('config.js?v=');
  });


  it('opens the dashboard in preview mode without Firebase SDK scripts', () => {
    const html = readFileSync('index.html', 'utf-8');
    const main = readFileSync('js/main.js', 'utf-8');

    expect(html).toContain('<div id="auth-screen" class="hidden">');
    expect(html).toContain('<div id="app-screen">');
    expect(html).not.toContain('gstatic.com/firebasejs');
    expect(html).not.toContain('model-viewer.min.js');
    expect(main).toContain('const PREVIEW_MODE = true;');
    expect(main).toContain('enterPreviewDashboard();');
  });

});
