import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SearchQuery, SearchMatch } from '../types';
import { searchService } from '../services/SearchService';
import { useWorkspace } from './WorkspaceContext';
import { logger } from '../utils/logger';

export interface SearchContextType {
  isOpen: boolean;
  isReplaceOpen: boolean;
  query: SearchQuery;
  replaceText: string;
  matches: SearchMatch[];
  currentMatchIndex: number;
  searchError: string | null;
  currentMatch: SearchMatch | null;
  openSearch: (withReplace?: boolean) => void;
  closeSearch: () => void;
  setQueryText: (text: string) => void;
  setReplaceText: (text: string) => void;
  toggleCaseSensitive: () => void;
  toggleWholeWord: () => void;
  toggleRegex: () => void;
  findNext: () => void;
  findPrevious: () => void;
  replaceCurrent: () => void;
  replaceAll: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeDoc, updateText } = useWorkspace();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState<boolean>(false);
  const [replaceText, setReplaceText] = useState<string>('');

  const [query, setQuery] = useState<SearchQuery>({
    text: '',
    caseSensitive: false,
    wholeWord: false,
    regex: false,
  });

  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(-1);
  const [searchError, setSearchError] = useState<string | null>(null);

  const currentMatch = currentMatchIndex >= 0 && currentMatchIndex < matches.length ? matches[currentMatchIndex] : null;

  // Run search when query, document content, or active document changes
  const runSearch = useCallback(
    (searchQuery: SearchQuery, content: string | undefined) => {
      if (!content || !searchQuery.text) {
        setMatches([]);
        setCurrentMatchIndex(-1);
        setSearchError(null);
        return;
      }

      const { matches: newMatches, error } = searchService.executeSearch(content, searchQuery);
      setMatches(newMatches);
      setSearchError(error);

      if (newMatches.length === 0) {
        setCurrentMatchIndex(-1);
      } else {
        setCurrentMatchIndex((prev) => (prev >= 0 && prev < newMatches.length ? prev : 0));
      }
    },
    []
  );

  useEffect(() => {
    runSearch(query, activeDoc?.content);
  }, [query, activeDoc?.content, activeDoc?.id, runSearch]);

  const openSearch = (withReplace: boolean = false) => {
    setIsOpen(true);
    setIsReplaceOpen(withReplace);
  };

  const closeSearch = () => {
    setIsOpen(false);
    setIsReplaceOpen(false);
    setSearchError(null);
  };

  const setQueryText = (text: string) => {
    setQuery((prev) => ({ ...prev, text }));
  };

  const toggleCaseSensitive = () => {
    setQuery((prev) => ({ ...prev, caseSensitive: !prev.caseSensitive }));
  };

  const toggleWholeWord = () => {
    setQuery((prev) => ({ ...prev, wholeWord: !prev.wholeWord }));
  };

  const toggleRegex = () => {
    setQuery((prev) => ({ ...prev, regex: !prev.regex }));
  };

  const findNext = () => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
  };

  const findPrevious = () => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
  };

  const replaceCurrent = () => {
    if (!activeDoc || !currentMatch || activeDoc.fileResource?.readOnly) {
      logger.warn('Replace current blocked or unavailable');
      return;
    }

    const { newContent } = searchService.replaceMatch(activeDoc.content, currentMatch, replaceText);
    updateText(activeDoc.id, newContent);
  };

  const replaceAll = () => {
    if (!activeDoc || matches.length === 0 || activeDoc.fileResource?.readOnly) {
      logger.warn('Replace all blocked or unavailable');
      return;
    }

    const { newContent, replaceCount } = searchService.replaceAllMatches(activeDoc.content, matches, replaceText);
    if (replaceCount > 0) {
      updateText(activeDoc.id, newContent);
    }
  };

  return (
    <SearchContext.Provider
      value={{
        isOpen,
        isReplaceOpen,
        query,
        replaceText,
        matches,
        currentMatchIndex,
        searchError,
        currentMatch,
        openSearch,
        closeSearch,
        setQueryText,
        setReplaceText,
        toggleCaseSensitive,
        toggleWholeWord,
        toggleRegex,
        findNext,
        findPrevious,
        replaceCurrent,
        replaceAll,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = (): SearchContextType => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};
