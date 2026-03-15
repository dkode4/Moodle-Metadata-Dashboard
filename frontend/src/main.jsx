// application entry point - mounts the react tree into the root dom element
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { RefreshProvider } from './contexts/RefreshContext'
import { ActiveDatasetProvider } from './contexts/ActiveDatasetContext.jsx'

createRoot(document.getElementById('root')).render(
  // strictmode enables additional runtime warnings during development
  <StrictMode>
    {/* refreshprovider exposes a trigger for re-fetching file lists after uploads */}
    <RefreshProvider>
      {/* activedatasetprovider manages the core analytics state and metrics across the app */}
      <ActiveDatasetProvider>
        <App />
      </ActiveDatasetProvider>
    </RefreshProvider>
  </StrictMode>
)
