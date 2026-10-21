import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../reportErrors'
import '../styles.css'
import { SettingsApp } from './SettingsApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsApp />
  </StrictMode>
)
