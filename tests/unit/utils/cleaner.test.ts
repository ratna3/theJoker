/**
 * DataCleaner Unit Tests
 * Phase 10: Testing & Optimization
 */

import { DataCleaner } from '../../../src/utils/cleaner';

describe('DataCleaner', () => {
  // ============================================
  // stripHtml Tests
  // ============================================
  
  describe('stripHtml', () => {
    it('should remove basic HTML tags', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const result = DataCleaner.stripHtml(input);
      expect(result).toBe('Hello World');
    });

    it('should remove script tags and their content', () => {
      const input = 'Before<script>alert("test")</script>After';
      const result = DataCleaner.stripHtml(input);
      expect(result).toBe('BeforeAfter');
    });

    it('should remove style tags and their content', () => {
      const input = 'Text<style>.class { color: red; }</style>More';
      const result = DataCleaner.stripHtml(input);
      expect(result).toBe('TextMore');
    });

    it('should remove HTML comments', () => {
      const input = 'Before<!-- comment -->After';
      const result = DataCleaner.stripHtml(input);
      expect(result).toBe('BeforeAfter');
    });

    it('should decode HTML entities', () => {
      const input = '&amp; &lt; &gt; &quot; &#39;';
      const result = DataCleaner.stripHtml(input);
      expect(result).toBe("& < > \" '");
    });

    it('should decode numeric HTML entities', () => {
      const input = '&#65; &#x41;'; // A in decimal and hex
      const result = DataCleaner.stripHtml(input);
      expect(result).toBe('A A');
    });

    it('should handle empty input', () => {
      expect(DataCleaner.stripHtml('')).toBe('');
      expect(DataCleaner.stripHtml(null as unknown as string)).toBe('');
    });

    it('should add newlines for block elements', () => {
      const input = '<div>First</div><div>Second</div>';
      const result = DataCleaner.stripHtml(input);
      expect(result).toContain('First');
      expect(result).toContain('Second');
    });
  });

  // ============================================
  // normalizeWhitespace Tests
  // ============================================

  describe('normalizeWhitespace', () => {
    it('should collapse multiple spaces to single space', () => {
      const input = 'Hello    World';
      const result = DataCleaner.normalizeWhitespace(input);
      expect(result).toBe('Hello World');
    });

    it('should collapse multiple newlines', () => {
      const input = 'Line1\n\n\n\nLine2';
      const result = DataCleaner.normalizeWhitespace(input);
      expect(result).toBe('Line1\n\nLine2');
    });

    it('should trim each line', () => {
      const input = '  Line1  \n  Line2  ';
      const result = DataCleaner.normalizeWhitespace(input);
      expect(result).toBe('Line1\nLine2');
    });

    it('should handle tabs', () => {
      const input = 'Hello\t\tWorld';
      const result = DataCleaner.normalizeWhitespace(input);
      expect(result).toBe('Hello World');
    });

    it('should handle empty input', () => {
      expect(DataCleaner.normalizeWhitespace('')).toBe('');
    });
  });

  // ============================================
  // deduplicate Tests
  // ============================================

  describe('deduplicate', () => {
    it('should remove duplicates based on key', () => {
      const items = [
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
        { id: 1, name: 'First Duplicate' },
      ];
      const result = DataCleaner.deduplicate(items, 'id');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('First');
      expect(result[1].name).toBe('Second');
    });

    it('should preserve order (keep first occurrence)', () => {
      const items = [
        { id: 1, order: 1 },
        { id: 2, order: 2 },
        { id: 1, order: 3 },
      ];
      const result = DataCleaner.deduplicate(items, 'id');
      expect(result[0].order).toBe(1);
    });

    it('should handle empty array', () => {
      const result = DataCleaner.deduplicate([], 'id');
      expect(result).toEqual([]);
    });

    it('should handle null input', () => {
      const result = DataCleaner.deduplicate(null as unknown as any[], 'id');
      expect(result).toEqual([]);
    });
  });

  // ============================================
  // deduplicateSimple Tests
  // ============================================

  describe('deduplicateSimple', () => {
    it('should remove duplicate strings', () => {
      const items = ['a', 'b', 'a', 'c', 'b'];
      const result = DataCleaner.deduplicateSimple(items);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should remove duplicate numbers', () => {
      const items = [1, 2, 1, 3, 2];
      const result = DataCleaner.deduplicateSimple(items);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle empty array', () => {
      expect(DataCleaner.deduplicateSimple([])).toEqual([]);
    });
  });

  // ============================================
  // cleanUrl Tests
  // ============================================

  describe('cleanUrl', () => {
    it('should normalize URL', () => {
      const result = DataCleaner.cleanUrl('HTTPS://Example.COM/Page');
      expect(result).toContain('example.com');
    });

    it('should remove tracking parameters', () => {
      const result = DataCleaner.cleanUrl('https://example.com?utm_source=test&name=value');
      expect(result).not.toContain('utm_source');
      expect(result).toContain('name=value');
    });

    it('should remove trailing slashes', () => {
      const result = DataCleaner.cleanUrl('https://example.com/page/');
      expect(result).toBe('https://example.com/page');
    });

    it('should add protocol if missing', () => {
      const result = DataCleaner.cleanUrl('example.com/page');
      expect(result).toBe('https://example.com/page');
    });

    it('should handle relative URLs', () => {
      const result = DataCleaner.cleanUrl('/path/to/page');
      expect(result).toBe('/path/to/page');
    });

    it('should handle empty input', () => {
      expect(DataCleaner.cleanUrl('')).toBe('');
    });

    it('should handle malformed URLs gracefully', () => {
      const result = DataCleaner.cleanUrl('not a url at all');
      expect(result).toBeTruthy();
    });
  });

  // ============================================
  // extractDomain Tests
  // ============================================

  describe('extractDomain', () => {
    it('should extract domain from URL', () => {
      const result = DataCleaner.extractDomain('https://www.example.com/page');
      expect(result).toBe('www.example.com');
    });

    it('should handle URLs without protocol', () => {
      const result = DataCleaner.extractDomain('example.com/page');
      expect(result).toBe('example.com');
    });

    it('should handle empty input', () => {
      expect(DataCleaner.extractDomain('')).toBe('');
    });
  });

  // ============================================
  // extractBaseDomain Tests
  // ============================================

  describe('extractBaseDomain', () => {
    it('should extract base domain without subdomain', () => {
      const result = DataCleaner.extractBaseDomain('https://www.blog.example.com');
      expect(result).toBe('example.com');
    });

    it('should handle multi-part TLDs', () => {
      const result = DataCleaner.extractBaseDomain('https://www.example.co.uk');
      expect(result).toBe('example.co.uk');
    });

    it('should return domain as-is if already base', () => {
      const result = DataCleaner.extractBaseDomain('https://example.com');
      expect(result).toBe('example.com');
    });
  });

  // ============================================
  // sanitize Tests
  // ============================================

  describe('sanitize', () => {
    it('should apply default options', () => {
      const input = '<p>Hello   World</p>';
      const result = DataCleaner.sanitize(input);
      expect(result).toBe('Hello World');
    });

    it('should remove URLs when option is set', () => {
      const input = 'Check https://example.com for more';
      const result = DataCleaner.sanitize(input, { removeUrls: true });
      expect(result).not.toContain('https://');
    });

    it('should remove emails when option is set', () => {
      const input = 'Contact test@example.com for help';
      const result = DataCleaner.sanitize(input, { removeEmails: true });
      expect(result).not.toContain('@');
    });

    it('should lowercase when option is set', () => {
      const input = 'HELLO World';
      const result = DataCleaner.sanitize(input, { lowercase: true });
      expect(result).toBe('hello world');
    });

    it('should truncate to max length', () => {
      const input = 'This is a long text that should be truncated';
      const result = DataCleaner.sanitize(input, { maxLength: 20 });
      expect(result.length).toBeLessThanOrEqual(20);
      expect(result).toContain('...');
    });

    it('should remove special characters when option is set', () => {
      const input = 'Hello @#$% World!';
      const result = DataCleaner.sanitize(input, { removeSpecialChars: true });
      expect(result).not.toContain('@');
      expect(result).not.toContain('#');
    });
  });

  // ============================================
  // cleanForDisplay Tests
  // ============================================

  describe('cleanForDisplay', () => {
    it('should normalize line endings', () => {
      const input = 'Line1\r\nLine2\rLine3';
      const result = DataCleaner.cleanForDisplay(input);
      expect(result).toBe('Line1\nLine2\nLine3');
    });

    it('should remove excessive blank lines', () => {
      const input = 'Line1\n\n\n\n\nLine2';
      const result = DataCleaner.cleanForDisplay(input);
      expect(result).toBe('Line1\n\nLine2');
    });
  });

  // ============================================
  // truncate Tests
  // ============================================

  describe('truncate', () => {
    it('should truncate long text', () => {
      const input = 'This is a very long text that needs truncation';
      const result = DataCleaner.truncate(input, 20);
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('should truncate at word boundary', () => {
      const input = 'Hello World Example';
      const result = DataCleaner.truncate(input, 15);
      expect(result).toMatch(/\.\.\.$/);
    });

    it('should not truncate short text', () => {
      const input = 'Short';
      const result = DataCleaner.truncate(input, 20);
      expect(result).toBe('Short');
    });

    it('should use custom suffix', () => {
      const input = 'This is a long text';
      const result = DataCleaner.truncate(input, 15, '…');
      expect(result).toContain('…');
    });
  });

  // ============================================
  // extractSentences Tests
  // ============================================

  describe('extractSentences', () => {
    it('should extract sentences', () => {
      const input = 'First sentence. Second sentence! Third sentence?';
      const result = DataCleaner.extractSentences(input);
      expect(result).toHaveLength(3);
    });

    it('should handle empty input', () => {
      expect(DataCleaner.extractSentences('')).toEqual([]);
    });
  });

  // ============================================
  // extractKeywords Tests
  // ============================================

  describe('extractKeywords', () => {
    it('should extract keywords', () => {
      const input = 'JavaScript programming language framework development';
      const result = DataCleaner.extractKeywords(input);
      expect(result).toContain('javascript');
      expect(result).toContain('programming');
    });

    it('should filter stop words', () => {
      const input = 'the quick brown fox and the lazy dog';
      const result = DataCleaner.extractKeywords(input);
      expect(result).not.toContain('the');
      expect(result).not.toContain('and');
    });

    it('should respect minimum length', () => {
      const input = 'a ab abc abcd abcde';
      const result = DataCleaner.extractKeywords(input, 4);
      expect(result).toContain('abcd');
      expect(result).toContain('abcde');
      expect(result).not.toContain('abc');
    });

    it('should sort by frequency', () => {
      const input = 'apple banana apple cherry apple banana';
      const result = DataCleaner.extractKeywords(input);
      expect(result[0]).toBe('apple'); // Most frequent
    });
  });

  // ============================================
  // cleanJson Tests
  // ============================================

  describe('cleanJson', () => {
    it('should parse valid JSON', () => {
      const input = '{"key": "value"}';
      const result = DataCleaner.cleanJson(input);
      expect(result).toBe('{"key":"value"}');
    });

    it('should extract JSON from markdown code block', () => {
      const input = '```json\n{"key": "value"}\n```';
      const result = DataCleaner.cleanJson(input);
      expect(result).toBe('{"key":"value"}');
    });

    it('should return null for invalid JSON', () => {
      const input = 'not valid json';
      const result = DataCleaner.cleanJson(input);
      expect(result).toBeNull();
    });

    it('should handle arrays', () => {
      const input = '[1, 2, 3]';
      const result = DataCleaner.cleanJson(input);
      expect(result).toBe('[1,2,3]');
    });
  });

  // ============================================
  // removeBoilerplate Tests
  // ============================================

  describe('removeBoilerplate', () => {
    it('should remove cookie notices', () => {
      const input = 'Main content Cookie Policy Accept all cookies More content';
      const result = DataCleaner.removeBoilerplate(input);
      expect(result).not.toContain('Cookie Policy');
    });

    it('should remove newsletter signup text', () => {
      const input = 'Article content Subscribe to our newsletter Footer';
      const result = DataCleaner.removeBoilerplate(input);
      expect(result).not.toContain('Subscribe to our newsletter');
    });

    it('should remove social media prompts', () => {
      const input = 'Content Follow us on Twitter Share on Facebook More';
      const result = DataCleaner.removeBoilerplate(input);
      expect(result).not.toContain('Follow us on');
    });

    it('should remove copyright notices', () => {
      const input = 'Content © 2024 All Rights Reserved';
      const result = DataCleaner.removeBoilerplate(input);
      expect(result).not.toContain('All Rights Reserved');
    });

    it('should accept custom patterns', () => {
      const input = 'Content REMOVE_THIS More content';
      const result = DataCleaner.removeBoilerplate(input, [/REMOVE_THIS/g]);
      expect(result).not.toContain('REMOVE_THIS');
    });
  });
});
