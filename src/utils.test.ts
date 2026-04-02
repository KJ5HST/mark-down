import { describe, it, expect } from 'vitest';
import {
  generateTitle,
  headingToSlug,
  parseTaskListItem,
  buildExportHtml,
} from './utils';

// ==========================================
// generateTitle
// ==========================================

describe('generateTitle', () => {
  it('shows Untitled for null path', () => {
    expect(generateTitle(null, false)).toBe('Untitled — Mark Down');
  });

  it('shows filename from path', () => {
    expect(generateTitle('/Users/test/README.md', false)).toBe('README.md — Mark Down');
  });

  it('shows dirty indicator when edited', () => {
    expect(generateTitle('/Users/test/README.md', true)).toBe('README.md — Edited — Mark Down');
  });

  it('shows Untitled with dirty indicator', () => {
    expect(generateTitle(null, true)).toBe('Untitled — Edited — Mark Down');
  });

  it('extracts filename from deep path', () => {
    expect(generateTitle('/a/b/c/d/notes.md', false)).toBe('notes.md — Mark Down');
  });

  it('handles path ending with slash', () => {
    // edge case: trailing slash gives empty pop()
    expect(generateTitle('/Users/test/', false)).toBe('Untitled — Mark Down');
  });

  it('handles simple filename (no directory)', () => {
    expect(generateTitle('file.md', false)).toBe('file.md — Mark Down');
  });
});

// ==========================================
// headingToSlug
// ==========================================

describe('headingToSlug', () => {
  it('converts simple heading', () => {
    expect(headingToSlug('Hello World')).toBe('hello-world');
  });

  it('lowercases text', () => {
    expect(headingToSlug('Getting Started')).toBe('getting-started');
  });

  it('strips special characters', () => {
    expect(headingToSlug("What's New?")).toBe('whats-new');
  });

  it('collapses multiple spaces', () => {
    expect(headingToSlug('Hello   World')).toBe('hello-world');
  });

  it('trims whitespace', () => {
    expect(headingToSlug('  Hello World  ')).toBe('hello-world');
  });

  it('preserves hyphens', () => {
    expect(headingToSlug('well-known-text')).toBe('well-known-text');
  });

  it('handles numbers', () => {
    expect(headingToSlug('Chapter 1')).toBe('chapter-1');
  });

  it('handles underscores', () => {
    expect(headingToSlug('snake_case_heading')).toBe('snake_case_heading');
  });

  it('strips parentheses and brackets', () => {
    expect(headingToSlug('API (v2) [beta]')).toBe('api-v2-beta');
  });

  it('handles emoji-like characters', () => {
    expect(headingToSlug('Features ✨')).toBe('features-');
  });

  it('handles empty string', () => {
    expect(headingToSlug('')).toBe('');
  });

  it('handles all special characters', () => {
    expect(headingToSlug('!@#$%^&*()')).toBe('');
  });
});

// ==========================================
// parseTaskListItem
// ==========================================

describe('parseTaskListItem', () => {
  it('parses unchecked item', () => {
    const result = parseTaskListItem('[ ] Buy milk');
    expect(result).toEqual({ checked: false, text: 'Buy milk' });
  });

  it('parses checked item with lowercase x', () => {
    const result = parseTaskListItem('[x] Done task');
    expect(result).toEqual({ checked: true, text: 'Done task' });
  });

  it('parses checked item with uppercase X', () => {
    const result = parseTaskListItem('[X] Done task');
    expect(result).toEqual({ checked: true, text: 'Done task' });
  });

  it('returns null for non-task item', () => {
    expect(parseTaskListItem('Regular list item')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseTaskListItem('')).toBeNull();
  });

  it('handles item with no text after checkbox', () => {
    const result = parseTaskListItem('[x] ');
    expect(result).toEqual({ checked: true, text: '' });
  });

  it('preserves text with special characters', () => {
    const result = parseTaskListItem('[ ] Install `vitest` & run tests');
    expect(result).toEqual({ checked: false, text: 'Install `vitest` & run tests' });
  });

  it('returns null for malformed checkbox', () => {
    expect(parseTaskListItem('[y] Wrong marker')).toBeNull();
    expect(parseTaskListItem('[] Missing space')).toBeNull();
    expect(parseTaskListItem('[  ] Too many spaces')).toBeNull();
  });
});

// ==========================================
// buildExportHtml
// ==========================================

describe('buildExportHtml', () => {
  it('wraps body content in HTML document', () => {
    const html = buildExportHtml('<h1>Hello</h1>');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('</html>');
  });

  it('includes viewport meta tag', () => {
    const html = buildExportHtml('');
    expect(html).toContain('viewport');
    expect(html).toContain('width=device-width');
  });

  it('includes CSS styles', () => {
    const html = buildExportHtml('');
    expect(html).toContain('<style>');
    expect(html).toContain('font-family');
    expect(html).toContain('max-width: 800px');
  });

  it('includes code styling', () => {
    const html = buildExportHtml('');
    expect(html).toContain('SF Mono');
    expect(html).toContain('pre {');
  });

  it('includes table styling', () => {
    const html = buildExportHtml('');
    expect(html).toContain('border-collapse');
    expect(html).toContain('th, td');
  });

  it('includes blockquote styling', () => {
    const html = buildExportHtml('');
    expect(html).toContain('blockquote');
    expect(html).toContain('border-left');
  });

  it('preserves body content exactly', () => {
    const content = '<p>Test <strong>bold</strong> and <em>italic</em></p>';
    const html = buildExportHtml(content);
    expect(html).toContain(content);
  });

  it('handles empty body', () => {
    const html = buildExportHtml('');
    expect(html).toContain('<body>\n\n</body>');
  });
});
