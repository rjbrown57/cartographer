import React, { useMemo } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { DiagramScene } from './diagram.js';

// DiagramCanvas embeds Excalidraw with the note's saved scene and image files.
export function DiagramCanvas({ scene, readOnly, fill = false, onChange }: { scene: DiagramScene; readOnly: boolean; fill?: boolean; onChange?: (scene: DiagramScene) => void }): React.JSX.Element {
  const initialData = useMemo(() => ({ elements: scene.elements, appState: scene.appState, files: scene.files }), [scene]);
  return <div className={`cartographer-diagram ${fill ? 'cartographer-diagram--editor' : ''}`} style={fill ? undefined : { height: 620, minHeight: 400 }}>
    <Excalidraw initialData={initialData as React.ComponentProps<typeof Excalidraw>['initialData']} viewModeEnabled={readOnly}
      onChange={(elements, appState, files) => onChange?.({
        elements: [...elements],
        appState: { viewBackgroundColor: appState.viewBackgroundColor },
        files: { ...files },
      })} />
  </div>;
}
