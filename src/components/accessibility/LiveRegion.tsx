import React from 'react';
import { useAccessibility } from '../../state/AccessibilityContext';
import { VisuallyHidden } from './VisuallyHidden';

export const LiveRegion: React.FC = () => {
  const { announcements } = useAccessibility();

  const latestPolite = [...announcements]
    .reverse()
    .find((a) => a.mode === 'polite')?.message;

  const latestAssertive = [...announcements]
    .reverse()
    .find((a) => a.mode === 'assertive')?.message;

  return (
    <>
      <VisuallyHidden>
        <div role="status" aria-live="polite" aria-atomic="true">
          {latestPolite || ''}
        </div>
      </VisuallyHidden>

      <VisuallyHidden>
        <div role="alert" aria-live="assertive" aria-atomic="true">
          {latestAssertive || ''}
        </div>
      </VisuallyHidden>
    </>
  );
};
