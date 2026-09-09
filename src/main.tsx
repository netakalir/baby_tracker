import * as Sentry from '@sentry/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AppErrorFallback } from './components/ui/AppErrorFallback.tsx'
import { AuthProvider } from './features/auth/AuthProvider.tsx'
import { ThemeProvider } from './features/theme/ThemeProvider.tsx'
import './index.css'
import { initMonitoring } from './lib/monitoring.ts'
import { queryClient } from './lib/queryClient.ts'

// Initialize error monitoring before anything renders, so a crash during the
// initial render is captured. No-ops unless a DSN is configured in a reporting
// environment (see monitoring.ts).
initMonitoring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={({ resetError }) => <AppErrorFallback onReset={resetError} />}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
