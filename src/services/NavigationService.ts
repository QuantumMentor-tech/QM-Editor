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

  public clearHistory(): void {
    this.backStack = [];
    this.forwardStack = [];
    this.currentLocation = null;
  }

  public removeDocumentEntries(documentId: string): void {
    this.backStack = this.backStack.filter((loc) => loc.documentId !== documentId);
    this.forwardStack = this.forwardStack.filter((loc) => loc.documentId !== documentId);
    if (this.currentLocation && this.currentLocation.documentId === documentId) {
      this.currentLocation = null;
    }
  }
}
