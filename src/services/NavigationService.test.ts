import { describe, it, expect, beforeEach } from 'vitest';
import { NavigationService } from './NavigationService';

describe('NavigationService', () => {
  let navService: NavigationService;

  beforeEach(() => {
    navService = new NavigationService();
  });

  it('pushes locations and manages back/forward stacks correctly', () => {
    expect(navService.canNavigateBack()).toBe(false);
    expect(navService.canNavigateForward()).toBe(false);

    navService.pushLocation({ documentId: 'doc-1', line: 10, column: 1 });
    navService.pushLocation({ documentId: 'doc-2', line: 50, column: 5 });

    expect(navService.canNavigateBack()).toBe(true);
    expect(navService.canNavigateForward()).toBe(false);

    const backLoc = navService.navigateBack();
    expect(backLoc?.documentId).toBe('doc-1');
    expect(backLoc?.line).toBe(10);
    expect(navService.canNavigateForward()).toBe(true);

    const fwdLoc = navService.navigateForward();
    expect(fwdLoc?.documentId).toBe('doc-2');
    expect(fwdLoc?.line).toBe(50);
  });

  it('deduplicates minor line jumps in same document', () => {
    navService.pushLocation({ documentId: 'doc-1', line: 10, column: 1 });
    navService.pushLocation({ documentId: 'doc-1', line: 12, column: 2 }); // Small delta (< 5 lines)

    expect(navService.canNavigateBack()).toBe(false); // Should not push minor move to backStack
  });

  it('bounds history stack to maximum allowed size', () => {
    for (let i = 1; i <= 60; i++) {
      navService.pushLocation({ documentId: `doc-${i}`, line: i * 10, column: 1 });
    }

    const state = navService.getState();
    expect(state.backStack.length).toBeLessThanOrEqual(50);
  });

  it('removes entries cleanly when document is closed', () => {
    navService.pushLocation({ documentId: 'doc-1', line: 10, column: 1 });
    navService.pushLocation({ documentId: 'doc-2', line: 20, column: 1 });

    navService.removeDocumentEntries('doc-1');
    const state = navService.getState();
    expect(state.backStack.find((loc) => loc.documentId === 'doc-1')).toBeUndefined();
  });
});
