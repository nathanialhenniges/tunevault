import React from 'react'
import ReactDOM from 'react-dom/client'
// Fraunces (self-hosted, local) is the single editorial flourish — used only on
// the sidebar wordmark. Everything else is the platform system font (native).
import '@fontsource-variable/fraunces'
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
