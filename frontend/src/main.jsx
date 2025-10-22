import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext' // 1. Import
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider> {/* 2. Wrap App */}
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)