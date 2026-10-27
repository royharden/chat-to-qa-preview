// M1 placeholder entry so index.html and vite.config.ts have a target. The real app shell arrives in M5.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function Placeholder() {
  return (
    <main>
      <h1>Chat-to-Q&amp;A preview</h1>
      <p>Scaffold only (milestone M1). Nothing has been built or run yet. This is not a privacy guarantee.</p>
    </main>
  );
}

const rootElement = document.getElementById('root');
if (rootElement !== null) {
  createRoot(rootElement).render(
    <StrictMode>
      <Placeholder />
    </StrictMode>,
  );
}
