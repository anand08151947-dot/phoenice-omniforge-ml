/**
 * Projects/index.tsx — Project Board (landing page / home)
 * Shows all projects with status, stats, team, and pipeline progress.
 * "+ New Project" creates a project and opens it.
 */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Grid, Card, CardContent, CardActions, Typography, Button,
  Chip, LinearProgress, Stack, Avatar, AvatarGroup, Tooltip,
  IconButton, Divider, Alert, CircularProgress, Paper,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import ArchiveIcon from '@mui/icons-material/Archive'
import StorageIcon from '@mui/icons-material/Storage'
import PeopleIcon from '@mui/icons-material/People'
import ModelTrainingIcon from '@mui/icons-material/ModelTraining'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import { usePipelineStore } from '../../stores/pipeline'
import NewProjectDialog from './NewProjectDialog'
import ActorPrompt from './ActorPrompt'

interface ProjectSummary {
  id: string
  name: string
  description: string | null
  owner: string
  team_members: Array<{ email: string; role: string }>
  status: string
  dataset_count: number
  last_activity: string | null
  best_cv_score: number | null
  best_model: string | null
  created_at: string
}

interface Overview {
  total_projects: number
  active_projects: number
  total_datasets: number
  ready_datasets: number
  models_trained: number
  deployed_count: number
  engineer_count: number
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'No activity'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function initials(email: string): string {
  const parts = email.split('@')[0].split(/[._-]/)
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { actorName, setProject, setActor } = usePipelineStore()

  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [actorPromptOpen, setActorPromptOpen] = useState(!actorName)

  const fetchData = async () => {
    try {
      const [projRes, overviewRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/admin/overview'),
      ])
      if (projRes.ok) {
        const d = await projRes.json()
        setProjects(d.projects || [])
      }
      if (overviewRes.ok) {
        setOverview(await overviewRes.json())
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const openProject = (p: ProjectSummary) => {
    setProject(p.id, p.name)
    navigate('/upload')
  }

  const handleCreate = (project: { id: string; name: string }) => {
    setProject(project.id, project.name)
    fetchData()
    navigate('/upload')
  }

  const handleActorSaved = (name: string) => {
    setActor(name)
    setActorPromptOpen(false)
  }

  if (actorPromptOpen) {
    return <ActorPrompt onSave={handleActorSaved} />
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Projects</Typography>
          <Typography variant="body2" color="text.secondary">
            OmniForge ML — Multi-project workspace
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          New Project
        </Button>
      </Stack>

      {/* Platform Stats */}
      {overview && (
        <Grid container spacing={2} mb={3}>
          {[
            { label: 'Projects', value: overview.total_projects, icon: <FolderOpenIcon />, color: '#90caf9' },
            { label: 'Datasets', value: overview.total_datasets, icon: <StorageIcon />, color: '#a5d6a7' },
            { label: 'Models Trained', value: overview.models_trained, icon: <ModelTrainingIcon />, color: '#ffcc80' },
            { label: 'Deployed', value: overview.deployed_count, icon: <RocketLaunchIcon />, color: '#ce93d8' },
            { label: 'Engineers', value: overview.engineer_count, icon: <PeopleIcon />, color: '#80cbc4' },
          ].map((stat) => (
            <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={stat.label}>
              <Paper sx={{ p: 2, textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ color: stat.color, mb: 0.5 }}>{stat.icon}</Box>
                <Typography variant="h5" fontWeight={700}>{stat.value}</Typography>
                <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      {/* Project Cards */}
      {!loading && projects.length === 0 && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <FolderOpenIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" gutterBottom>No projects yet</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Create your first ML project to get started
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Create Project
          </Button>
        </Paper>
      )}

      <Grid container spacing={3}>
        {projects.map((p) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid',
                borderColor: 'divider',
                opacity: p.status === 'archived' ? 0.6 : 1,
                cursor: 'pointer',
                '&:hover': { borderColor: 'primary.main', boxShadow: 4 },
              }}
              onClick={() => openProject(p)}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                {/* Project name + status chip */}
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                  <Typography variant="h6" fontWeight={600} noWrap sx={{ maxWidth: '75%' }}>
                    {p.name}
                  </Typography>
                  <Chip
                    label={p.status}
                    size="small"
                    color={p.status === 'active' ? 'success' : 'default'}
                  />
                </Stack>

                {p.description && (
                  <Typography variant="body2" color="text.secondary" mb={1.5} sx={{
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                  }}>
                    {p.description}
                  </Typography>
                )}

                <Divider sx={{ my: 1 }} />

                {/* Stats row */}
                <Stack direction="row" spacing={2} mb={1.5}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Datasets</Typography>
                    <Typography variant="body2" fontWeight={600}>{p.dataset_count}</Typography>
                  </Box>
                  {p.best_cv_score != null && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Best CV Score</Typography>
                      <Typography variant="body2" fontWeight={600} color="success.main">
                        {(p.best_cv_score * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  )}
                  {p.best_model && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Best Model</Typography>
                      <Typography variant="body2" fontWeight={600}>{p.best_model}</Typography>
                    </Box>
                  )}
                </Stack>

                {/* Team avatars */}
                {p.team_members.length > 0 && (
                  <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                    <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: 10 } }}>
                      {p.team_members.map((m) => (
                        <Tooltip key={m.email} title={`${m.email} (${m.role})`}>
                          <Avatar sx={{ bgcolor: 'primary.main', width: 24, height: 24, fontSize: 10 }}>
                            {initials(m.email)}
                          </Avatar>
                        </Tooltip>
                      ))}
                    </AvatarGroup>
                  </Stack>
                )}

                {/* Last activity */}
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <AccessTimeIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.disabled">
                    {timeAgo(p.last_activity)}
                  </Typography>
                </Stack>
              </CardContent>

              <CardActions sx={{ px: 2, pb: 2, pt: 0 }} onClick={(e) => e.stopPropagation()}>
                <Button size="small" variant="outlined" onClick={() => openProject(p)}>
                  Open
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => navigate(`/projects/${p.id}`)}
                >
                  Details
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <NewProjectDialog
        open={dialogOpen}
        actorName={actorName || 'Unknown'}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
      />
    </Box>
  )
}
