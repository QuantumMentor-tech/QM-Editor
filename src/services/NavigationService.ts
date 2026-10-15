import { EditorLocation, NavigationHistoryState } from '../types';

const MAX_HISTORY_STACK_SIZE = 50;
const MIN_LINE_DELTA_FOR_HISTORY = 5; // Minimum line delta before recording jump in same document

export class NavigationService {
  private backStack: EditorLocation[] = [];
  private forwardStack: EditorLocation[] = [];
  private currentLocation: EditorLocation | null = null;

  public pushLocation(location: EditorLocation): void {
    if (!location.documentId || location.line < 1) return;

    if (this.currentLocation) {
      // Check if location is duplicate or minor cursor jitter in same document
      if (
        this.currentLocation.documentId === location.documentId &&
        Math.abs(this.currentLocation.line - location.line) < MIN_LINE_DELTA_FOR_HISTORY
      ) {
        // Just update current location pointer without pushing onto backStack
        this.currentLocation = { ...location, timestamp: Date.now() };
        return;
      }

      // Push previous location to back stack
      this.backStack.push(this.currentLocation);
      if (this.backStack.length > MAX_HISTORY_STACK_SIZE) {
        this.backStack.shift();
      }
    }

    // Set new location and clear forward stack on new navigation branch
    this.currentLocation = { ...location, timestamp: Date.now() };
    this.forwardStack = [];
  }

  public navigateBack(): EditorLocation | null {
    if (this.backStack.length === 0) return null;

    if (this.currentLocation) {
      this.forwardStack.push(this.currentLocation);
    }

    const previous = this.backStack.pop()!;
    this.currentLocation = previous;
    return previous;
  }

  public navigateForward(): EditorLocation | null {
    if (this.forwardStack.length === 0) return null;

    if (this.currentLocation) {
      this.backStack.push(this.currentLocation);
    }

    const next = this.forwardStack.pop()!;
    this.currentLocation = next;
    return next;
  }

  public canNavigateBack(): boolean {
    return this.backStack.length > 0;
  }

  public canNavigateForward(): boolean {
    return this.forwardStack.length > 0;
  }

  public getPreviousLocation(): EditorLocation | null {
    return this.backStack.length > 0 ? this.backStack[this.backStack.length - 1] : null;
  }

  public getNextLocation(): EditorLocation | null {
    return this.forwardStack.length > 0 ? this.forwardStack[this.forwardStack.length - 1] : null;
  }

  public getState(): NavigationHistoryState {
    return {
      backStack: [...this.backStack],
      forwardStack: [...this.forwardStack],
      currentLocation: this.currentLocation ? { ...this.currentLocation } : null,
    };
  }

  public loadHistoryState(state: NavigationHistoryState): void {
    if (!state) return;
    this.backStack = Array.isArray(state.backStack)
      ? state.backStack.slice(-MAX_HISTORY_STACK_SIZE)
      : [];
    this.forwardStack = Array.isArray(state.forwardStack)
      ? state.forwardStack.slice(0, MAX_HISTORY_STACK_SIZE)
      : [];
    this.currentLocation = state.currentLocation ? { ...state.currentLocation } : null;
  }

  public getLocations(): EditorLocation[] {
    const list: EditorLocation[] = [];
    if (this.currentLocation) list.push(this.currentLocation);
    for (let i = this.backStack.length - 1; i >= 0; i--) {
      list.push(this.backStack[i]);
    }
    for (const f of this.forwardStack) {
      list.push(f);
    }

    const seen = new Set<string>();
    const deduplicated: EditorLocation[] = [];
    for (const loc of list) {
      const key = `${loc.filePath || loc.documentId}:${loc.line}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(loc);
      }
    }
    return deduplicated;
  }

  public clearHistory(): void {
    this.backStack = [];
    this.forwardStack = [];
    this.currentLocation = null;
  }

  public removeDocumentEntries(documentIdOrUri: string): void {
    this.backStack = this.backStack.filter(
      (loc) => loc.documentId !== documentIdOrUri && loc.filePath !== documentIdOrUri
    );
    this.forwardStack = this.forwardStack.filter(
      (loc) => loc.documentId !== documentIdOrUri && loc.filePath !== documentIdOrUri
    );
    if (
      this.currentLocation &&
      (this.currentLocation.documentId === documentIdOrUri ||
        this.currentLocation.filePath === documentIdOrUri)
    ) {
      this.currentLocation = null;
    }
  }

  public updateResourceUri(oldUri: string, newUri: string): void {
    const updateLoc = (loc: EditorLocation): EditorLocation => {
      if (loc.filePath === oldUri || loc.documentId === oldUri) {
        return {
          ...loc,
          filePath: newUri,
          documentTitle: newUri.split('/').pop() || loc.documentTitle,
        };
      }
      return loc;
    };

    this.backStack = this.backStack.map(updateLoc);
    this.forwardStack = this.forwardStack.map(updateLoc);
    if (this.currentLocation) {
      this.currentLocation = updateLoc(this.currentLocation);
    }
  }
}

export const globalNavigationService = new NavigationService();
