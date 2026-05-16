import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const SKIPPED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'coverage',
  'dist',
  'build'
]);

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.svg',
  '.ts',
  '.yml',
  '.yaml'
]);

function isTextFile(path: string): boolean {
  const dotIndex = path.lastIndexOf('.');
  if (dotIndex === -1) {
    return false;
  }
  return TEXT_EXTENSIONS.has(path.slice(dotIndex));
}

function collectTextFiles(directory: string, files: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      continue;
    }

    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      collectTextFiles(path, files);
    } else if (stats.isFile() && isTextFile(path)) {
      files.push(path);
    }
  }

  return files;
}

describe('repository hygiene', () => {
  it('does not contain unresolved merge conflict markers', () => {
    const markers = ['<'.repeat(7), '='.repeat(7), '>'.repeat(7)];
    const offenders: string[] = [];

    for (const file of collectTextFiles('.')) {
      const contents = readFileSync(file, 'utf-8');
      const lines = contents.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (markers.includes(line.trim())) {
          offenders.push(`${relative('.', file)}:${index + 1}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
