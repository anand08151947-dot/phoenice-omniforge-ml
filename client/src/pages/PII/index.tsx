import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import MetricCard from '../../components/shared/MetricCard'
import SectionCard from '../../components/shared/SectionCard'
import type { PIIReport, PIIColumn } from '../../api/types'
import SecurityIcon from '@mui/icons-material/Security'
import WarningIcon from '@mui/icons-material/Warning'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { usePipelineStore } from '../../stores/pipeline'

const sensitivityColor: Record<string, 'error' | 'warning' | 'info'> = {
  high: 'error', medium: 'warning', low: 'info',
}

export default function PIIPage() {
  const [actions, setActions] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<string | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const datasetId = usePipelineStore((s) => s.datasetId)
  const datasetName = usePipelineStore((s) => s.datasetName)
  const setPhaseStatus = usePipelineStore((s) => s.setPhaseStatus)

  const { data, isLoading } = useQuery<PIIReport | { status: string }>({
    queryKey: ['pii', datasetId],
    queryFn: () => fetch(`/api/pii?dataset_id=${datasetId}`).then((r) => r.json()),
    enabled: !!datasetId,
  })

  const scanMutation = useMutation({
    mutationFn: () => fetch(`/api/pii/scan/${datasetId}`, { method: 'POST' }).then((r) => {
      if (!r.ok) throw new Error(`Scan failed: ${r.status}`)
      return r.json()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pii', datasetId] })
    },
  })

  const applyMutation = useMutation({
    mutationFn: (payload: { dataset_id: string; actions: { column: string; action: string }[] }) =>
      fetch('/api/pii/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => {
        if (!r.ok) throw new Error(`Apply failed: ${r.status}`)
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pii', datasetId] })
      setPhaseStatus('pii', 'done')
      setToast('PII actions applied successfully')
    },
    onError: (err: Error) => setToast(`Error: ${err.message}`),
  })

  function handleApplyAll() {
    if (!report) return
    // Build action list: use user-selected action or fall back to recommended
    const actionList = report.pii_columns.map((col: PIIColumn) => ({
      column: col.column,
      action: actions[col.column] ?? col.recommended_action,
    }))
    applyMutation.mutate({ dataset_id: datasetId!, actions: actionList })
  }

  // Derive report before hooks that depend on it
  const report = data && Array.isArray((data as PIIReport).pii_columns) ? data as PIIReport : null
  const notScanned = !report && !scanMutation.isPending
  const isScanning = scanMutation.isPending
  const highRisk = report ? report.pii_columns.filter((c) => c.sensitivity === 'high').length : 0

  // Seed local action state from persisted applied_action — must be before any early return
  useEffect(() => {
    if (!report) return
    const saved: Record<string, string> = {}
    report.pii_columns.forEach((col: PIIColumn & { applied_action?: string }) => {
      if (col.applied_action) saved[col.column] = col.applied_action
    })
    if (Object.keys(saved).length > 0) setActions(saved)
  }, [report?.scanned_at])  // only re-seed when a new scan result arrives

  if (!datasetId) {
    return (
      <Box>
        <PageHeader title="PII Scan Results" subtitle="Phase A — Identify and mask personally identifiable information" />
        <Alert severity="info" action={<Button size="small" onClick={() => navigate('/upload')}>Upload Dataset</Button>}>
          No dataset selected. Upload or select a dataset first.
        </Alert>
      </Box>
    )
  }

  if (isLoading) return <LinearProgress />

  return (
    <Box>
      <PageHeader
        title="PII Scan Results"
        subtitle={`Phase A — ${datasetName ?? 'Identify and mask personally identifiable information'}`}
        badge={report ? <Chip icon={<SecurityIcon />} label={`Risk Score: ${report.risk_score}/100`} color={report.risk_score > 60 ? 'error' : 'warning'} /> : undefined}
        actions={report ? (
          <Button
            variant="contained"
            color="warning"
            startIcon={applyMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
            onClick={handleApplyAll}
            disabled={applyMutation.isPending}
          >
            {applyMutation.isPending ? 'Applying…' : 'Apply All Actions'}
          </Button>
        ) : undefined}
      />

      {isScanning && (
        <Alert severity="info" sx={{ mb: 2 }}>Scanning for PII… This may take a moment.</Alert>
      )}
      {isScanning && <LinearProgress sx={{ mb: 2 }} />}

      {notScanned && (
        <Alert severity="warning" sx={{ mb: 2 }}
          action={
            <Button size="small" variant="outlined" color="inherit"
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}>
              {scanMutation.isPending ? 'Starting…' : 'Scan Now'}
            </Button>
          }>
          No PII scan has been run yet for <strong>{datasetName}</strong>. Click "Scan Now" to detect PII.
        </Alert>
      )}

      {report && (<>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="Columns Scanned" value={report.total_columns} icon={<SecurityIcon />} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="PII Columns Found" value={report.pii_columns.length} icon={<WarningIcon />} color="#FFA726" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="High Risk" value={highRisk} icon={<WarningIcon />} color="#EF5350" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="Risk Score" value={`${report.risk_score}/100`} icon={<SecurityIcon />} color={report.risk_score > 60 ? '#EF5350' : '#FFA726'} />
        </Grid>
      </Grid>

      <SectionCard title="PII Columns Detected" subheader="Review and configure masking action per column">
        <TableContainer component={Paper} elevation={0} sx={{ overflowX: 'hidden' }}>
          <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '15%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Column</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Entity Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Sensitivity</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Coverage</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Sample Values</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {report.pii_columns.map((col: PIIColumn) => (
                <TableRow key={col.column} hover>
                  <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.column}</Typography>
                  </TableCell>
                  <TableCell><Chip label={col.entity_type} size="small" variant="outlined" /></TableCell>
                  <TableCell><Chip label={col.sensitivity} color={sensitivityColor[col.sensitivity]} size="small" /></TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="caption">{(col.match_pct * 100).toFixed(1)}%</Typography>
                      <LinearProgress variant="determinate" value={col.match_pct * 100} color={sensitivityColor[col.sensitivity]} sx={{ height: 4, borderRadius: 2, mt: 0.25 }} />
                    </Box>
                  </TableCell>
                  <TableCell sx={{ overflow: 'hidden' }}>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {col.sample_values.slice(0, 2).join(' · ')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={actions[col.column] ?? (col as any).applied_action ?? col.recommended_action}
                      onChange={(e) => setActions((prev) => ({ ...prev, [col.column]: e.target.value }))}
                      sx={{ fontSize: '0.8rem', width: '100%' }}
                    >
                      {['mask', 'hash', 'drop', 'pseudonymize', 'encrypt'].map((a) => (
                        <MenuItem key={a} value={a}>{a}</MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={col.status}
                      color={col.status === 'masked' || col.status === 'approved' ? 'success' : col.status === 'dropped' ? 'default' : 'warning'}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>
      </>)}

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
