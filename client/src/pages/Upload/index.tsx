import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import { useDropzone } from 'react-dropzone'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import type { Dataset, DatasetProfile } from '../../api/types'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import StorageIcon from '@mui/icons-material/Storage'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { usePipelineStore } from '../../stores/pipeline'

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function TargetColumnSelector({ dataset, onSaved }: { dataset: Dataset; onSaved: () => void }) {
  const [loading, setLoading] = useState(false)
  const { data: profile } = useQuery<DatasetProfile>({
    queryKey: ['profile', dataset.id],
    queryFn: () => fetch(`/api/profile?dataset_id=${dataset.id}`).then((r) => r.json()),
    enabled: dataset.status === 'ready',
  })
  const columns = profile?.columns?.map((c) => c.name) ?? []

  async function handleChange(col: string, taskType: string) {
    setLoading(true)
    await fetch(`/api/datasets/${dataset.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_column: col, task_type: taskType }),
    })
    setLoading(false)
    onSaved()
  }

  if (!columns.length) return null

  return (
    <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Target Column</InputLabel>
        <Select
          label="Target Column"
          value={dataset.target_column ?? ''}
          disabled={loading}
          onChange={(e) => handleChange(e.target.value, dataset.task_type ?? 'classification')}
        >
          {columns.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </Select>
      </FormControl>
      {dataset.target_column && (
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Task</InputLabel>
          <Select
            label="Task"
            value={dataset.task_type ?? 'classification'}
            disabled={loading}
            onChange={(e) => handleChange(dataset.target_column!, e.target.value)}
          >
            <MenuItem value="classification">Classification</MenuItem>
            <MenuItem value="regression">Regression</MenuItem>
            <MenuItem value="clustering">Clustering (unsupervised)</MenuItem>
            <MenuItem value="anomaly_detection">Anomaly Detection</MenuItem>
            <MenuItem value="forecasting">Time Series Forecasting</MenuItem>
          </Select>
        </FormControl>
      )}
    </Box>
  )
}

export default function UploadPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setDataset = usePipelineStore((s) => s.setDataset)
  const setPhaseStatus = usePipelineStore((s) => s.setPhaseStatus)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const { data } = useQuery<Dataset[]>({
    queryKey: ['datasets'],
    queryFn: () => fetch('/api/datasets').then((r) => r.json()),
    refetchInterval: (query) => {
      const ds = query.state.data as Dataset[] | undefined
      return ds?.some((d) => d.status === 'processing') ? 3000 : false
    },
  })

  const datasets: Dataset[] = Array.isArray(data) ? data : []

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return
    setUploading(true)
    setUploadProgress(0)

    const interval = setInterval(() => {
      setUploadProgress((p) => Math.min(p + 10, 85))
    }, 300)

    try {
      const formData = new FormData()
      formData.append('file', acceptedFiles[0])
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      clearInterval(interval)
      setUploadProgress(100)

      if (res.ok) {
        const ds: Dataset = await res.json()
        setDataset(ds.id, ds.name)
        setPhaseStatus('upload', 'done')
        await queryClient.invalidateQueries({ queryKey: ['datasets'] })
      }
    } finally {
      setTimeout(() => { setUploading(false); setUploadProgress(0) }, 800)
    }
  }, [queryClient, setDataset, setPhaseStatus])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.xls', '.xlsx'], 'application/json': ['.json'], 'application/parquet': ['.parquet'] },
    maxFiles: 1,
  })

  return (
    <Box>
      <PageHeader title="Upload Dataset" subtitle="Phase 0 — Import your data to begin the AutoML pipeline" />

      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'divider',
          borderRadius: 3,
          p: 6,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          bgcolor: isDragActive ? 'action.hover' : 'background.paper',
          mb: 3,
          '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
        }}
      >
        <input {...getInputProps()} />
        <CloudUploadIcon sx={{ fontSize: 56, color: isDragActive ? 'primary.main' : 'text.disabled', mb: 1.5 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          {isDragActive ? 'Drop your file here' : 'Drag & drop your dataset'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Supports CSV, Excel, JSON, Parquet — max 2GB
        </Typography>
        <Button variant="outlined" size="small">Browse Files</Button>
      </Box>

      {uploading && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>Uploading… {uploadProgress}%</Typography>
          <LinearProgress variant="determinate" value={uploadProgress} sx={{ borderRadius: 2, height: 6 }} />
        </Box>
      )}

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Recent Datasets</Typography>
      <Grid container spacing={2}>
        {datasets.map((ds) => (
          <Grid key={ds.id} size={{ xs: 12, sm: 6 }}>
            <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <StorageIcon color="primary" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{ds.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {ds.row_count != null ? ds.row_count.toLocaleString() : '—'} rows · {ds.col_count ?? '—'} cols · {formatBytes(ds.file_size)}
                    </Typography>
                    <br />
                    <Typography variant="caption" color="text.disabled">{new Date(ds.created_at).toLocaleDateString()}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end' }}>
                    <Chip label={ds.status} color={ds.status === 'ready' ? 'success' : 'warning'} size="small" />
                    {ds.task_type && ds.task_type !== 'unknown' && <Chip label={ds.task_type} size="small" variant="outlined" />}
                    {ds.status === 'ready' && (
                      <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => { setDataset(ds.id, ds.name); setPhaseStatus('upload', 'done'); navigate('/profile') }}>
                        Use
                      </Button>
                    )}
                  </Box>
                </Box>
                {ds.status === 'ready' && (
                  <TargetColumnSelector
                    dataset={ds}
                    onSaved={() => queryClient.invalidateQueries({ queryKey: ['datasets'] })}
                  />
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
