import Box from '@mui/material/Box'
import CssBaseline from '@mui/material/CssBaseline'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

const SIDEBAR_WIDTH = 260
const TOPBAR_HEIGHT = 64

export default function AppShell() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      <TopBar sidebarWidth={SIDEBAR_WIDTH} height={TOPBAR_HEIGHT} />
      <Sidebar width={SIDEBAR_WIDTH} topOffset={TOPBAR_HEIGHT} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,          // prevent flex overflow
          mt: `${TOPBAR_HEIGHT}px`,
          p: { xs: 2, sm: 3 },
          minHeight: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
          bgcolor: 'background.default',
          overflowX: 'hidden',   // prevent horizontal scroll; vertical scrolls naturally
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}
