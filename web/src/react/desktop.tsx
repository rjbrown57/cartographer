import React from 'react';
import { createRoot } from 'react-dom/client';

// DesktopApp is the root of the replacement desktop UI.
export function DesktopApp(): React.JSX.Element {
  return <main>Cartographer</main>;
}

// MountDesktopApp mounts the React entry only when its shell is served.
export function MountDesktopApp(): void {
  const element = document.getElementById('react-desktop-root');
  if (element) {
    createRoot(element).render(<DesktopApp />);
  }
}

MountDesktopApp();
