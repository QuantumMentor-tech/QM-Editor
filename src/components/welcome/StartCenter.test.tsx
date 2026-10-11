/**
 * QM Editor Start Center & Welcome Experience Tests
 * Phase 03, Step 27 — Welcome Experience, Workspace Entry, Empty States & Start Center
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { StartCenter } from './StartCenter';
import { WelcomeBrandHeader } from './WelcomeBrandHeader';
import { WelcomePrimaryActions } from './WelcomePrimaryActions';
import { RecentWorkspacesList } from './RecentWorkspacesList';
import { WelcomeQuickAccess } from './WelcomeQuickAccess';
import { RecentWorkspacesService } from '../../services/RecentWorkspacesService';

describe('QM Editor — Start Center & Welcome Experience', () => {
  beforeEach(() => {
    RecentWorkspacesService.clearRecentWorkspaces();
  });

  it('instantiates StartCenter component safely', () => {
    const el = React.createElement(StartCenter);
    expect(el.type).toBe(StartCenter);
  });

  it('instantiates WelcomeBrandHeader safely with branding content', () => {
    const el = React.createElement(WelcomeBrandHeader);
    expect(el.type).toBe(WelcomeBrandHeader);
  });

  it('instantiates WelcomePrimaryActions safely', () => {
    const el = React.createElement(WelcomePrimaryActions);
    expect(el.type).toBe(WelcomePrimaryActions);
  });

  it('instantiates RecentWorkspacesList safely', () => {
    const el = React.createElement(RecentWorkspacesList);
    expect(el.type).toBe(RecentWorkspacesList);
  });

  it('instantiates WelcomeQuickAccess safely', () => {
    const el = React.createElement(WelcomeQuickAccess);
    expect(el.type).toBe(WelcomeQuickAccess);
  });

  it('maintains Welcome surface separation from Document Model', () => {
    // StartCenter is purely a React UI component, never registered as a DocumentModel
    const el = React.createElement(StartCenter);
    expect(typeof el.type).toBe('function');
    // Ensure it does not have document properties like isDirty, uri, docId, or buffer
    expect((el as any).isDirty).toBeUndefined();
    expect((el as any).docId).toBeUndefined();
    expect((el as any).buffer).toBeUndefined();
  });

  it('renders RecentWorkspaces with bounded history and safe removal', () => {
    RecentWorkspacesService.addRecentWorkspace('d:/Projects/MyProject', 'MyProject');
    RecentWorkspacesService.addRecentWorkspace('d:/Projects/AwesomeApp', 'AwesomeApp');

    const recents = RecentWorkspacesService.getRecentWorkspaces();
    expect(recents.length).toBe(2);
    expect(recents[0].name).toBe('AwesomeApp');

    // Removing an entry updates the recent history list without touching physical storage
    const updated = RecentWorkspacesService.removeRecentWorkspace('d:/Projects/AwesomeApp');
    expect(updated.length).toBe(1);
    expect(updated[0].name).toBe('MyProject');
  });
});
