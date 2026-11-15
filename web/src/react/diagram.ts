import type { NoteData } from '../shared/types.js';

export const MaxDiagramBytes = 2 * 1024 * 1024;
export type DiagramScene = { elements: unknown[]; appState: Record<string, unknown>; files: Record<string, unknown> };

// GetDiagramScene accepts only the versioned diagram shape in note data.
export function GetDiagramScene(note: Pick<NoteData, 'data'> | null): DiagramScene | null {
  const data = note?.data;
  if (!data || data.kind !== 'diagram' || data.version !== 1) return null;
  const scene = data.scene as Record<string, unknown> | undefined;
  if (!scene || !Array.isArray(scene.elements) || !scene.appState || typeof scene.appState !== 'object' || !scene.files || typeof scene.files !== 'object') return null;
  return scene as DiagramScene;
}

// DiagramData prepares a scene for the existing note data field.
export function DiagramData(scene: DiagramScene): Record<string, unknown> {
  return { kind: 'diagram', version: 1, scene };
}

// DiagramSize counts the UTF-8 bytes sent through the note API.
export function DiagramSize(data: Record<string, unknown>): number {
  return new TextEncoder().encode(JSON.stringify(data)).byteLength;
}
