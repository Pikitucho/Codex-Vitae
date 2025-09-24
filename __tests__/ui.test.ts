import { readFileSync } from 'fs';

// jsdom does not ship TypeScript definitions in this project configuration.
// Using require keeps the dependency untyped for the purposes of these DOM smoke tests.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JSDOM } = require('jsdom');

describe('stat row layout', () => {
  const html = readFileSync('index.html', 'utf-8');
  const dom = new JSDOM(html);
  const document = dom.window.document;

  it('renders six stat rows with major and legacy bars', () => {
    const statRows = Array.from(document.querySelectorAll('.stat-row')) as any[];
    expect(statRows).toHaveLength(6);
    statRows.forEach(row => {
      const major = (row as any).querySelector('.stat-bar.major');
      const legacy = (row as any).querySelector('.stat-bar.legacy');
      expect(major).not.toBeNull();
      expect(legacy).not.toBeNull();
      if (major) {
        expect(major.classList.contains('major')).toBe(true);
      }
      if (legacy) {
        expect(legacy.classList.contains('legacy')).toBe(true);
      }
    });
  });

  it('includes perk progression overview metrics with unique identifiers', () => {
    expect(document.getElementById('perk-character-level')).not.toBeNull();
    expect(document.getElementById('perk-stats-to-next')).not.toBeNull();
    expect(document.getElementById('perk-leading-stat')).not.toBeNull();

    expect(document.querySelectorAll('#perk-progress-legacy-bar')).toHaveLength(1);
    expect(document.querySelectorAll('#perk-progress-legacy-text')).toHaveLength(1);
  });
});
