import React from 'react';
import type { DiagramScene } from './diagram.js';

type Shape = { id?: string; type?: string; x?: number; y?: number; width?: number; height?: number; strokeColor?: string; backgroundColor?: string; text?: string; fileId?: string; isDeleted?: boolean };

// DiagramPreview draws a compact, static overview without loading an editor per card.
export function DiagramPreview({ scene }: { scene: DiagramScene }): React.JSX.Element {
  const shapes = scene.elements.filter((value): value is Shape => Boolean(value && typeof value === 'object' && !(value as Shape).isDeleted)).slice(0, 80);
  if (!shapes.length) return <div className="diagram-preview diagram-preview--empty">Empty diagram</div>;
  const minX = Math.min(...shapes.map(shape => shape.x || 0));
  const minY = Math.min(...shapes.map(shape => shape.y || 0));
  const maxX = Math.max(...shapes.map(shape => (shape.x || 0) + Math.abs(shape.width || 0)));
  const maxY = Math.max(...shapes.map(shape => (shape.y || 0) + Math.abs(shape.height || 0)));
  const width = Math.max(maxX - minX, 100);
  const height = Math.max(maxY - minY, 60);
  return <svg className="diagram-preview" viewBox={`${minX - 16} ${minY - 16} ${width + 32} ${height + 32}`} role="img" aria-label="Diagram preview">
    <rect x={minX - 16} y={minY - 16} width={width + 32} height={height + 32} fill={typeof scene.appState.viewBackgroundColor === 'string' ? scene.appState.viewBackgroundColor : '#ffffff'} />
    {shapes.map((shape, index) => {
      const x = shape.x || 0; const y = shape.y || 0; const w = Math.abs(shape.width || 1); const h = Math.abs(shape.height || 1);
      const stroke = shape.strokeColor || '#1e293b'; const fill = shape.backgroundColor === 'transparent' ? 'none' : shape.backgroundColor || 'none';
      const key = shape.id || String(index);
      if (shape.type === 'ellipse') return <ellipse key={key} cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} stroke={stroke} fill={fill} strokeWidth="2" />;
      if (shape.type === 'text') return <text key={key} x={x} y={y + Math.max(16, h / 2)} fill={stroke} fontSize="18">{shape.text?.slice(0, 70)}</text>;
      if (shape.type === 'image' && shape.fileId) {
        const file = scene.files[shape.fileId] as { dataURL?: string } | undefined;
        return file?.dataURL?.startsWith('data:image/') ? <image key={key} x={x} y={y} width={w} height={h} href={file.dataURL} /> : <rect key={key} x={x} y={y} width={w} height={h} stroke={stroke} fill="#e2e8f0" />;
      }
      return <rect key={key} x={x} y={y} width={w} height={h} stroke={stroke} fill={fill} strokeWidth="2" rx={shape.type === 'diamond' ? 0 : 4} />;
    })}
  </svg>;
}
