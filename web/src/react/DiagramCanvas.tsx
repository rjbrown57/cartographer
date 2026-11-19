import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Excalidraw, useHandleLibrary } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useColorScheme } from '@mui/joy/styles';
import '@excalidraw/excalidraw/index.css';
import type { DiagramScene } from './diagram.js';

// DiagramCanvas embeds Excalidraw with the note's saved scene and image files.
export function DiagramCanvas({ scene, readOnly, fill = false, onChange }: { scene: DiagramScene; readOnly: boolean; fill?: boolean; onChange?: (scene: DiagramScene, initial: boolean) => void }): React.JSX.Element {
  const { mode } = useColorScheme();
  const [api, setAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  useHandleLibrary({ excalidrawAPI: api });

  // The catalog targets this browsing context so a draft survives the return trip.
  useEffect(() => {
    if (window.name) return;
    const target = `cartographer-diagram-${crypto.randomUUID()}`;
    window.name = target;
    return () => { if (window.name === target) window.name = ''; };
  }, []);

  // Excalidraw interpolates this value into the catalog query. The catalog
  // decodes it and appends its own #addLibrary fragment.
  const returnURL = encodeURIComponent(location.origin + location.pathname + location.search);
  const initialized = useRef(false);
  const initialData = useMemo(() => ({ elements: scene.elements, appState: scene.appState, files: scene.files }), [scene]);
  return <div className={`cartographer-diagram ${fill ? 'cartographer-diagram--editor' : ''}`} style={fill ? undefined : { height: 620, minHeight: 400 }}>
    <Excalidraw excalidrawAPI={setAPI} libraryReturnUrl={returnURL} initialData={initialData as React.ComponentProps<typeof Excalidraw>['initialData']} viewModeEnabled={readOnly} theme={mode === 'dark' ? 'dark' : 'light'}
      onChange={(elements, appState, files) => {
        const initial = !initialized.current;
        initialized.current = true;
        onChange?.({
        elements: [...elements],
        appState: { viewBackgroundColor: appState.viewBackgroundColor },
        files: { ...files },
      }, initial);
      }} />
  </div>;
}
