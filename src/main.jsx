import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || '523513294138-e0v7d3p89l0o4enoni5gq0ei9jjde3h6.apps.googleusercontent.com'}>
    <App />
  </GoogleOAuthProvider>
)
