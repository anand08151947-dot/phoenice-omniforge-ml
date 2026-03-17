import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Avatar from '@mui/material/Avatar'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import ChatIcon from '@mui/icons-material/Chat'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePipelineStore } from '../../stores/pipeline'

interface TopBarProps {
  sidebarWidth: number
  height: number
}

function actorInitials(name: string): string {
  const parts = name.split(/[\s@._-]+/)
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export default function TopBar({ sidebarWidth, height }: TopBarProps) {
  const navigate = useNavigate()
  const { themeMode, toggleTheme, datasetName, projectName, actorName, lmStudioOnline, setChatOpen, chatOpen } = usePipelineStore()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: `calc(100% - ${sidebarWidth}px)`,
        ml: `${sidebarWidth}px`,
        height,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        color: 'text.primary',
      }}
    >
      <Toolbar sx={{ height, minHeight: `${height}px !important` }}>
        {/* Brand */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 3 }}>
          <AutoAwesomeIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 800, background: 'linear-gradient(90deg, #6C63FF, #FF6584)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            OmniForge ML
          </Typography>
        </Box>

        {/* Project chip */}
        {projectName && (
          <Tooltip title="Click to change project">
            <Chip
              icon={<FolderOpenIcon sx={{ fontSize: '14px !important' }} />}
              label={projectName}
              size="small"
              variant="outlined"
              color="primary"
              onClick={() => navigate('/')}
              sx={{ fontWeight: 600, fontSize: '0.78rem', mr: 1, cursor: 'pointer' }}
            />
          </Tooltip>
        )}

        {/* Dataset label */}
        {datasetName && (
          <Chip
            label={datasetName}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 600, fontSize: '0.78rem', mr: 2 }}
          />
        )}

        <Box sx={{ flexGrow: 1 }} />

        {/* LM Studio status */}
        <Chip
          icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important', color: lmStudioOnline ? 'success.main' : 'error.main' }} />}
          label={lmStudioOnline ? 'LM Studio Online' : 'Offline (AI disabled)'}
          size="small"
          variant="outlined"
          color={lmStudioOnline ? 'success' : 'error'}
          sx={{ mr: 1, fontWeight: 600 }}
        />

        {/* Theme toggle */}
        <Tooltip title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          <IconButton onClick={toggleTheme} size="small" sx={{ mr: 1 }}>
            {themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Tooltip>

        {/* Chat toggle */}
        <Tooltip title="AI Assistant">
          <IconButton
            onClick={() => setChatOpen(!chatOpen)}
            size="small"
            color={chatOpen ? 'primary' : 'default'}
            sx={{ bgcolor: chatOpen ? 'primary.main' : 'transparent', color: chatOpen ? 'white' : 'inherit', '&:hover': { bgcolor: chatOpen ? 'primary.dark' : undefined }, mr: 1 }}
          >
            <ChatIcon />
          </IconButton>
        </Tooltip>

        {/* User avatar */}
        <Tooltip title={actorName ? `Signed in as ${actorName}` : 'Set identity'}>
          <Avatar
            sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: 12, cursor: 'pointer' }}
            onClick={(e) => setAnchorEl(e.currentTarget)}
          >
            {actorName ? actorInitials(actorName) : '?'}
          </Avatar>
        </Tooltip>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          {actorName && <MenuItem disabled sx={{ fontSize: 12 }}>{actorName}</MenuItem>}
          <MenuItem onClick={() => { navigate('/'); setAnchorEl(null) }}>📁 Project Board</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  )
}

