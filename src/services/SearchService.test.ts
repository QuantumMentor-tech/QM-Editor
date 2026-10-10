import { describe, it, expect } from 'vitest';
import { SearchService } from './SearchService';
import { SearchQuery } from '../types';

describe('SearchService Core Engine', () => {
  const service = new SearchService();
  const sampleText = 'The quick brown fox jumps over the lazy dog.\nThe Quick Brown FOX jumps again.';

  describe('Query Matching Engine', () => {
    it('performs case-insensitive search by default', () => {
      const query: SearchQuery = { text: 'quick', caseSensitive: false, wholeWord: false, regex: false };
      const { matches, error } = service.executeSearch(sampleText, query);

      expect(error).toBeNull();
      expect(matches).toHaveLength(2);
      expect(matches[0].from).toBe(4);
      expect(matches[1].from).toBe(49);
    });

    it('performs case-sensitive search when enabled', () => {
      const query: SearchQuery = { text: 'Quick', caseSensitive: true, wholeWord: false, regex: false };
      const { matches, error } = service.executeSearch(sampleText, query);

      expect(error).toBeNull();
      expect(matches).toHaveLength(1);
      expect(matches[0].line).toBe(2);
    });

    it('performs whole-word matching correctly', () => {
      const query: SearchQuery = { text: 'the', caseSensitive: false, wholeWord: true, regex: false };
      const { matches, error } = service.executeSearch(sampleText, query);

      expect(error).toBeNull();
      expect(matches).toHaveLength(3); // 'The' (line 1), 'the' (line 1), 'The' (line 2)
    });

    it('executes regex search correctly', () => {
      const query: SearchQuery = { text: 'fox|dog', caseSensitive: false, wholeWord: false, regex: true };
      const { matches, error } = service.executeSearch(sampleText, query);

      expect(error).toBeNull();
      expect(matches).toHaveLength(3);
    });

    it('catches invalid regex syntax gracefully without throwing', () => {
      const query: SearchQuery = { text: '[invalid(regex', caseSensitive: false, wholeWord: false, regex: true };
      const { matches, error } = service.executeSearch(sampleText, query);

      expect(matches).toHaveLength(0);
      expect(error).toContain('Invalid regular expression');
    });

    it('returns empty matches when query string is empty', () => {
      const query: SearchQuery = { text: '', caseSensitive: false, wholeWord: false, regex: false };
      const { matches, error } = service.executeSearch(sampleText, query);

      expect(matches).toHaveLength(0);
      expect(error).toBeNull();
    });
  });

  describe('Replace & Replace All Atomic Operations', () => {
    it('replaces a single match occurrence correctly', () => {
      const query: SearchQuery = { text: 'fox', caseSensitive: false, wholeWord: false, regex: false };
      const { matches } = service.executeSearch(sampleText, query);

      const { newContent } = service.replaceMatch(sampleText, matches[0], 'cat');
      expect(newContent).toContain('The quick brown cat jumps');
    });

    it('atomically replaces all matches in reverse offset order', () => {
      const query: SearchQuery = { text: 'fox', caseSensitive: false, wholeWord: false, regex: false };
      const { matches } = service.executeSearch(sampleText, query);

      const { newContent, replaceCount } = service.replaceAllMatches(sampleText, matches, 'wolf');
      expect(replaceCount).toBe(2);
      expect(newContent).toContain('brown wolf jumps');
      expect(newContent).toContain('Brown wolf jumps');
      expect(newContent).not.toContain('fox');
      expect(newContent).not.toContain('FOX');
    });
  });
});
