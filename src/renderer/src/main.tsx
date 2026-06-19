import React from 'react'
import ReactDOM from 'react-dom/client'
// Self-hosted Google fonts, bundled offline (no network at runtime). Hanken
// Grotesk is the UI/body face (warm, clean grotesque); Bricolage Grotesque is
// the display face for the wordmark + page titles (characterful headings).
import '@fontsource-variable/hanken-grotesk'
import '@fontsource-variable/bricolage-grotesque'
import App from './App'
import './styles/index.css'

// Platform class for native-specific styling (e.g. macOS vibrancy backgrounds).
const platform = window.api.platform
document.documentElement.classList.add(
  platform === 'darwin' ? 'is-mac' : platform === 'win32' ? 'is-win' : 'is-linux'
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
