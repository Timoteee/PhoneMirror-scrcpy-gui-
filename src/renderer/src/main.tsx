import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { TooltipProvider } from '@/components/ui/tooltip'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </StrictMode>,
  )
}
