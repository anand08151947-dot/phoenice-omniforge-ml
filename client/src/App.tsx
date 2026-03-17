import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { router } from './router'
import { darkTheme, lightTheme } from './theme'
import { usePipelineStore } from './stores/pipeline'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2 * 60 * 1000,
    },
  },
})

function ThemedApp() {
  const themeMode = usePipelineStore((s) => s.themeMode)
  const hydrateFromServer = usePipelineStore((s) => s.hydrateFromServer)
  const theme = themeMode === 'dark' ? darkTheme : lightTheme

  // On every app load, sync state from the server so all browsers are consistent
  useEffect(() => {
    fetch('/api/session')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.dataset_id) {
          hydrateFromServer({
            dataset_id: data.dataset_id,
            dataset_name: data.dataset_name,
            phase_status: data.phase_status,
          })
        }
      })
      .catch(() => {/* API not reachable — stay with empty state */})
  }, [hydrateFromServer])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemedApp />
    </QueryClientProvider>
  )
}

