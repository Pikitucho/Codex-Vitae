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
});
