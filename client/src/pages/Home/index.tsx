import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '../../components/shared/PageHeader'
import MetricCard from '../../components/shared/MetricCard'
import type { Dataset } from '../../api/types'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import StorageIcon from '@mui/icons-material/Storage'
import TimelineIcon from '@mui/icons-material/Timeline'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function HomePage() {
  const navigate = useNavigate()
  const { data } = useQuery<{ datasets: Dataset[] }>({
    queryKey: ['datasets'],
    queryFn: () => fetch('/api/datasets').then((r) => r.json()),
  })

  const datasets = data?.datasets ?? []

  return (
    <Box>
      <PageHeader
        title="Welcome to OmniForge ML"
        subtitle="End-to-end AutoML platform — from raw data to deployed models"
        actions={
          <Button variant="contained" startIcon={<CloudUploadIcon />} onClick={() => navigate('/upload')}>
            New Dataset
          </Button>
        }
      />

      {/* Stats row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="Datasets" value={datasets.length} icon={<StorageIcon />} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="Active Pipelines" value={2} icon={<TimelineIcon />} color="#6C63FF" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="Models Trained" value={14} icon={<AutoAwesomeIcon />} color="#4CAF50" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="Deployed" value={3} icon={<AutoAwesomeIcon />} color="#FF6584" />
        </Grid>
      </Grid>

      {/* Recent datasets */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Recent Datasets</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {datasets.map((ds) => (
          <Grid key={ds.id} size={{ xs: 12, sm: 6 }}>
            <Card sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main', border: '1px solid' }, border: '1px solid', borderColor: 'divider' }} onClick={() => navigate('/upload')}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <StorageIcon color="primary" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{ds.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {ds.row_count.toLocaleString()} rows · {ds.col_count} cols · {formatBytes(ds.file_size)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                  <Chip label={ds.status} color={ds.status === 'ready' ? 'success' : ds.status === 'processing' ? 'info' : 'error'} size="small" />
                  {ds.task_type && <Chip label={ds.task_type} size="small" variant="outlined" />}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick start */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Quick Start</Typography>
      <Grid container spacing={2}>
        {[
          { title: 'Upload Dataset', desc: 'Upload CSV or connect to a data source', path: '/upload', icon: <CloudUploadIcon /> },
          { title: 'Explore Data', desc: 'Automated EDA with issue detection', path: '/eda', icon: <TimelineIcon /> },
          { title: 'Train Models', desc: 'AutoML with HPO and cross-validation', path: '/training', icon: <AutoAwesomeIcon /> },
          { title: 'Explain & Deploy', desc: 'SHAP explanations and one-click deploy', path: '/explain', icon: <ArrowForwardIcon /> },
        ].map((item) => (
          <Grid key={item.path} size={{ xs: 6, md: 3 }}>
            <Card sx={{ cursor: 'pointer', height: '100%', '&:hover': { bgcolor: 'action.hover' } }} onClick={() => navigate(item.path)}>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Box sx={{ color: 'primary.main', mb: 1.5, '& svg': { fontSize: 40 } }}>{item.icon}</Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>{item.title}</Typography>
                <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
