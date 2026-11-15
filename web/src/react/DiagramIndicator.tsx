import React from 'react';
import { Stack, Typography } from '@mui/joy';

// DiagramIndicator identifies diagram content without approximating the saved scene.
export function DiagramIndicator(): React.JSX.Element {
  return <Stack className="joy-diagram-indicator" direction="row" alignItems="center" justifyContent="center" spacing={1}>
    <i className="bi bi-diagram-3" aria-hidden="true" />
    <Typography level="body-sm" sx={{ color: 'inherit' }}>Diagram</Typography>
  </Stack>;
}
