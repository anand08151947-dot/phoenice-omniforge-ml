/**
 * ProjectDashboard — /projects/:id
 * Shows project detail: datasets, team, recent activity.
 */
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Grid, Typography, Button, Stack, Chip, Divider,
  Table, TableBody, TableCell, TableHead, TableRow, Paper,
  List, ListItem, ListItemText, ListItemIcon, LinearProgress,
  CircularProgress, Alert, Avatar, AvatarGroup, Tooltip,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import StorageIcon from '@mui/icons-material/Storage'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PersonIcon from '@mui/icons-material/Person'
import { usePipelineStore } from '../../stores/pipeline'

interface Dataset {
  id: string
  name: string
  status: string
  task_type: string
  row_count: number | null
  col_count: number | null
  created_by: string | null
  created_at: string
  updated_at: string
  best_model: string | null
  best_cv_score: number | null
  phases_done: string[]
  phases_total: number
}

interface Activity {
  id: string
  actor: string
  action: string
  dataset_id: string | null
  detail: Record<string, any> | null
  created_at: string
}

interface Project {
  id: string
  name: string
  description: string | null
  owner: string
  team_members: Array<{ email: string; role: string }>
  status: string
  created_at: string
  datasets: Dataset[]
  activity: Activity[]
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
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

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    'dataset.upload': '📤 Uploaded dataset',
    'training.run': '🚀 Started training',
    'model.promote': '🏆 Promoted model',
    'project.create': '🆕 Created project',
    'dataset.deploy': '🌐 Deployed model',
  }
  return map[action] ?? action
}

export default function ProjectDashboard() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { setProject, setDataset } = usePipelineStore()

  const [project, setProjectData] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setProjectData(d)
        setProject(d.id, d.name)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Box sx={{ p: 4 }}><CircularProgress /></Box>
  if (error) return <Box sx={{ p: 4 }}><Alert severity="error">{error}</Alert></Box>
  if (!project) return null

  const openDataset = (ds: Dataset) => {
    setDataset(ds.id, ds.name)
    navigate('/profile')
  }

  const addDataset = () => {
    navigate('/upload')
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} size="small" color="inherit">
          Projects
        </Button>
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h4" fontWeight={700}>{project.name}</Typography>
            <Chip label={project.status} size="small" color={project.status === 'active' ? 'success' : 'default'} />
          </Stack>
          {project.description && (
            <Typography variant="body2" color="text.secondary" mt={0.5}>{project.description}</Typography>
          )}
          <Typography variant="caption" color="text.disabled">
            Owner: {project.owner} · Created {timeAgo(project.created_at)}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={addDataset}>
          Add Dataset
        </Button>
      </Stack>

      <Grid container spacing={3}>
        {/* Datasets table */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight={600} mb={2}>
              <StorageIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 18 }} />
              Datasets ({project.datasets.length})
            </Typography>

            {project.datasets.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">No datasets yet</Typography>
                <Button variant="outlined" startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={addDataset}>
                  Upload First Dataset
                </Button>
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Task</TableCell>
                    <TableCell>Rows</TableCell>
                    <TableCell>Best Model</TableCell>
                    <TableCell>Progress</TableCell>
                    <TableCell>Created By</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {project.datasets.map((ds) => (
                    <TableRow key={ds.id} hover sx={{ cursor: 'pointer' }} onClick={() => openDataset(ds)}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{ds.name}</Typography>
                        <Chip label={ds.status} size="small" sx={{ mt: 0.5 }}
                          color={ds.status === 'ready' ? 'success' : ds.status === 'error' ? 'error' : 'default'} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{ds.task_type}</Typography>
                      </TableCell>
                      <TableCell>{ds.row_count?.toLocaleString() ?? '—'}</TableCell>
                      <TableCell>
                        {ds.best_model
                          ? <Chip label={`${ds.best_model} (${((ds.best_cv_score ?? 0) * 100).toFixed(1)}%)`} size="small" color="info" />
                          : <Typography variant="caption" color="text.disabled">Not trained</Typography>
                        }
                      </TableCell>
                      <TableCell sx={{ minWidth: 100 }}>
                        <LinearProgress
                          variant="determinate"
                          value={(ds.phases_done.length / ds.phases_total) * 100}
                          sx={{ borderRadius: 1 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {ds.phases_done.length}/{ds.phases_total} phases
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{ds.created_by ?? '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Button size="small" onClick={(e) => { e.stopPropagation(); openDataset(ds) }}>Open</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>

        {/* Right column: Team + Activity */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Team */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" fontWeight={600} mb={1}>
              <PersonIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 18 }} />
              Team ({project.team_members.length + 1})
            </Typography>
            <List dense>
              <ListItem disablePadding>
                <ListItemIcon>
                  <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'primary.main' }}>
                    {initials(project.owner)}
                  </Avatar>
                </ListItemIcon>
                <ListItemText primary={project.owner} secondary="Owner" />
              </ListItem>
              {project.team_members.map((m) => (
                <ListItem key={m.email} disablePadding>
                  <ListItemIcon>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'secondary.main' }}>
                      {initials(m.email)}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText primary={m.email} secondary={m.role} />
                </ListItem>
              ))}
            </List>
          </Paper>

          {/* Activity feed */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight={600} mb={1}>
              <AccessTimeIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 18 }} />
              Recent Activity
            </Typography>
            {project.activity.length === 0 ? (
              <Typography variant="caption" color="text.disabled">No activity recorded yet</Typography>
            ) : (
              <List dense>
                {project.activity.slice(0, 15).map((log) => (
                  <ListItem key={log.id} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemText
                      primary={
                        <Typography variant="body2">
                          <strong>{log.actor}</strong> — {actionLabel(log.action)}
                        </Typography>
                      }
                      secondary={timeAgo(log.created_at)}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
