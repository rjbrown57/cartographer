import React, { useMemo, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { useColorScheme } from '@mui/joy/styles';
import '@excalidraw/excalidraw/index.css';
import type { DiagramScene } from './diagram.js';

// DiagramCanvas embeds Excalidraw with the note's saved scene and image files.
export function DiagramCanvas({ scene, readOnly, fill = false, onChange }: { scene: DiagramScene; readOnly: boolean; fill?: boolean; onChange?: (scene: DiagramScene, initial: boolean) => void }): React.JSX.Element {
  const { mode } = useColorScheme();
  const initialized = useRef(false);
  const initialData = useMemo(() => ({ elements: scene.elements, appState: scene.appState, files: scene.files }), [scene]);
  return <div className={`cartographer-diagram ${fill ? 'cartographer-diagram--editor' : ''}`} style={fill ? undefined : { height: 620, minHeight: 400 }}>
    <Excalidraw initialData={initialData as React.ComponentProps<typeof Excalidraw>['initialData']} viewModeEnabled={readOnly} theme={mode === 'dark' ? 'dark' : 'light'}
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
