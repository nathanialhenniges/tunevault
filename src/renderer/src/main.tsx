import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/dm-sans'
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
