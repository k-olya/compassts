import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'overlayscrollbars/overlayscrollbars.css'
import './index.css'
import App from './App.tsx'
import { useCadStore } from './store.ts'

void useCadStore.getState().render()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
