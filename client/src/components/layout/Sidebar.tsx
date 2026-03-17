import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import { useNavigate, useLocation } from 'react-router-dom'
import { usePipelineStore } from '../../stores/pipeline'
import StatusChip from '../shared/StatusChip'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'

import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import SecurityIcon from '@mui/icons-material/Security'
import AssessmentIcon from '@mui/icons-material/Assessment'
import AnalyticsIcon from '@mui/icons-material/Analytics'
import CleaningServicesIcon from '@mui/icons-material/CleaningServices'
import ScaleIcon from '@mui/icons-material/Scale'
import BuildIcon from '@mui/icons-material/Build'
import FilterListIcon from '@mui/icons-material/FilterList'
import ModelTrainingIcon from '@mui/icons-material/ModelTraining'
import LeaderboardIcon from '@mui/icons-material/Leaderboard'
import PsychologyIcon from '@mui/icons-material/Psychology'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import ChatIcon from '@mui/icons-material/Chat'
import ScheduleIcon from '@mui/icons-material/Schedule'
import PsychologyAltIcon from '@mui/icons-material/PsychologyAlt'

interface Step {
  label: string
  path: string
  phase: string
  icon: React.ReactNode
}

const steps: Step[] = [
  { label: 'Upload', path: '/upload', phase: 'upload', icon: <CloudUploadIcon fontSize="small" /> },
  { label: 'PII Scan', path: '/pii', phase: 'pii', icon: <SecurityIcon fontSize="small" /> },
  { label: 'Profile', path: '/profile', phase: 'profile', icon: <AssessmentIcon fontSize="small" /> },
  { label: 'EDA', path: '/eda', phase: 'eda', icon: <AnalyticsIcon fontSize="small" /> },
  { label: 'Cleaning', path: '/cleaning', phase: 'cleaning', icon: <CleaningServicesIcon fontSize="small" /> },
  { label: 'Sampling', path: '/sampling', phase: 'sampling', icon: <ScaleIcon fontSize="small" /> },
  { label: 'Features', path: '/features', phase: 'features', icon: <BuildIcon fontSize="small" /> },
  { label: 'Selection', path: '/selection', phase: 'selection', icon: <FilterListIcon fontSize="small" /> },
  { label: 'Training', path: '/training', phase: 'training', icon: <ModelTrainingIcon fontSize="small" /> },
  { label: 'Evaluation', path: '/evaluation', phase: 'evaluation', icon: <LeaderboardIcon fontSize="small" /> },
  { label: 'Explain', path: '/explain', phase: 'explain', icon: <PsychologyIcon fontSize="small" /> },
  { label: 'Deploy', path: '/deploy', phase: 'deploy', icon: <RocketLaunchIcon fontSize="small" /> },
  { label: 'Chat', path: '/chat', phase: 'chat', icon: <ChatIcon fontSize="small" /> },
  { label: 'Pipeline', path: '/pipeline', phase: 'pipeline', icon: <ScheduleIcon fontSize="small" /> },
  { label: 'Active Learning', path: '/active-learning', phase: 'active_learning', icon: <PsychologyAltIcon fontSize="small" /> },
]

interface SidebarProps {
  width: number
  topOffset: number
}

export default function Sidebar({ width, topOffset }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const phaseStatus = usePipelineStore((s) => s.phaseStatus)
  const projectName = usePipelineStore((s) => s.projectName)

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          top: topOffset,
          height: `calc(100% - ${topOffset}px)`,
          borderRight: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        },
      }}
    >
      {/* Project context header */}
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        {projectName ? (
          <Box>
            <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
              Active Project
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
              <FolderOpenIcon sx={{ fontSize: 14, color: 'primary.main' }} />
              <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: 160 }}>{projectName}</Typography>
            </Box>
            <Chip
              label="Change"
              size="small"
              variant="outlined"
              sx={{ mt: 0.5, fontSize: 10, height: 18, cursor: 'pointer' }}
              onClick={() => navigate('/')}
            />
          </Box>
        ) : (
          <Box>
            <Typography variant="caption" color="text.disabled">No project selected</Typography>
            <Box>
              <Chip
                label="Select Project"
                size="small"
                color="primary"
                sx={{ mt: 0.5, fontSize: 10, height: 18, cursor: 'pointer' }}
                onClick={() => navigate('/')}
              />
            </Box>
          </Box>
        )}
      </Box>
      <Divider />
      <Box sx={{ px: 2, py: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1 }}>
          Pipeline Steps
        </Typography>
      </Box>
      <Divider />
      <List dense sx={{ px: 1, py: 0.5 }}>
        {steps.map((step) => {
          const status = phaseStatus[step.phase] ?? 'pending'
          const active = location.pathname === step.path || (location.pathname === '/' && step.path === '/')
          return (
            <ListItem key={step.path} disablePadding sx={{ mb: 0.25 }}>
              <Tooltip title={status} placement="right" arrow>
                <ListItemButton
                  selected={active}
                  onClick={() => navigate(step.path)}
                  sx={{
                    borderRadius: 1.5,
                    '&.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': { bgcolor: 'primary.dark' },
                      '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32, color: active ? 'inherit' : 'text.secondary' }}>
                    {step.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={step.label}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: active ? 700 : 500 }}
                  />
                  {!active && <StatusChip status={status as any} size="small" />}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          )
        })}
      </List>
    </Drawer>
  )
}

