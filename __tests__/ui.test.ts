import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';

describe('stat row layout', () => {
  const html = readFileSync('index.html', 'utf-8');
  const dom = new JSDOM(html);
  const document = dom.window.document;

  it('renders six stat rows with major and legacy bars', () => {
    const statRows = Array.from(document.querySelectorAll('.stat-row'));
    expect(statRows).toHaveLength(6);
    statRows.forEach(row => {
      const major = row.querySelector('.stat-bar.major');
      const legacy = row.querySelector('.stat-bar.legacy');
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
});
