import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import Switch from '@mui/material/Switch'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/shared/PageHeader'
import SectionCard from '../../components/shared/SectionCard'
import DeleteIcon from '@mui/icons-material/Delete'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import AddIcon from '@mui/icons-material/Add'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Schedule {
  id: string
  name: string
  dataset_id: string
  cron_expr: string
  next_run: string
  enabled: boolean
  description?: string
}

interface PipelineRun {
  id: string
  trigger: string
  status: 'completed' | 'running' | 'failed'
  started_at: string
  duration_s: number | null
  dataset_id: string
}

interface SchedulesResponse {
  schedules: Schedule[]
}

interface RunsResponse {
  runs: PipelineRun[]
}

interface CreateScheduleForm {
  name: string
  dataset_id: string
  cron_expr: string
  description: string
}

// ─── API helpers ─────────────────────────────────────────────────────────────

const api = {
  getSchedules: (): Promise<SchedulesResponse> =>
    fetch('/api/pipeline/schedules').then((r) => r.json()),

  getRuns: (): Promise<RunsResponse> =>
    fetch('/api/pipeline/runs').then((r) => r.json()),

  createSchedule: (body: CreateScheduleForm): Promise<void> =>
    fetch('/api/pipeline/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => { if (!r.ok) throw new Error('Create failed') }),

  updateSchedule: (id: string, enabled: boolean): Promise<void> =>
    fetch(`/api/pipeline/schedule/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }).then((r) => { if (!r.ok) throw new Error('Update failed') }),

  deleteSchedule: (id: string): Promise<void> =>
    fetch(`/api/pipeline/schedule/${id}`, { method: 'DELETE' })
      .then((r) => { if (!r.ok) throw new Error('Delete failed') }),

  runNow: (dataset_id: string): Promise<void> =>
    fetch('/api/pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_id }),
    }).then((r) => { if (!r.ok) throw new Error('Run failed') }),
}

// ─── Run Status Chip ─────────────────────────────────────────────────────────

const runStatusColor = {
  completed: 'success',
  running: 'info',
  failed: 'error',
} as const

function RunStatusChip({ status }: { status: PipelineRun['status'] }) {
  return <Chip label={status} color={runStatusColor[status]} size="small" />
}

// ─── Create Schedule Dialog ──────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (form: CreateScheduleForm) => void
  isPending: boolean
}

function CreateScheduleDialog({ open, onClose, onSubmit, isPending }: CreateDialogProps) {
  const [form, setForm] = useState<CreateScheduleForm>({
    name: '', dataset_id: '', cron_expr: '0 2 * * *', description: '',
  })

  const set = (field: keyof CreateScheduleForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Pipeline Schedule</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Name" value={form.name} onChange={set('name')} size="small" fullWidth required />
          <TextField label="Dataset ID" value={form.dataset_id} onChange={set('dataset_id')} size="small" fullWidth required />
          <TextField label="Cron Expression" value={form.cron_expr} onChange={set('cron_expr')} size="small" fullWidth
            helperText="e.g. '0 2 * * *' = daily at 2am" />
          <TextField label="Description" value={form.description} onChange={set('description')} size="small" fullWidth multiline rows={2} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!form.name || !form.dataset_id || isPending}
          onClick={() => onSubmit(form)}
        >
          {isPending ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Run Now Dialog ──────────────────────────────────────────────────────────

interface RunDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (dataset_id: string) => void
  isPending: boolean
}

function RunNowDialog({ open, onClose, onSubmit, isPending }: RunDialogProps) {
  const [datasetId, setDatasetId] = useState('')
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Run Pipeline Now</DialogTitle>
      <DialogContent>
        <TextField
          label="Dataset ID"
          value={datasetId}
          onChange={(e) => setDatasetId(e.target.value)}
          size="small"
          fullWidth
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="success"
          disabled={!datasetId || isPending}
          onClick={() => onSubmit(datasetId)}
          startIcon={<PlayArrowIcon />}
        >
          {isPending ? 'Running…' : 'Run Now'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [runOpen, setRunOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: schedulesData, isLoading: loadingSchedules } = useQuery<SchedulesResponse>({
    queryKey: ['pipeline-schedules'],
    queryFn: api.getSchedules,
  })

  const { data: runsData, isLoading: loadingRuns } = useQuery<RunsResponse>({
    queryKey: ['pipeline-runs'],
    queryFn: api.getRuns,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pipeline-schedules'] })
    queryClient.invalidateQueries({ queryKey: ['pipeline-runs'] })
  }

  const createMutation = useMutation({
    mutationFn: api.createSchedule,
    onSuccess: () => { setCreateOpen(false); invalidate() },
    onError: () => setActionError('Failed to create schedule.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.updateSchedule(id, enabled),
    onSuccess: () => invalidate(),
    onError: () => setActionError('Failed to update schedule.'),
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteSchedule,
    onSuccess: () => invalidate(),
    onError: () => setActionError('Failed to delete schedule.'),
  })

  const runMutation = useMutation({
    mutationFn: api.runNow,
    onSuccess: () => { setRunOpen(false); invalidate() },
    onError: () => setActionError('Failed to trigger run.'),
  })

  return (
    <Box>
      <PageHeader
        title="Pipeline Schedules"
        subtitle="Phase 13 — Manage automated pipeline execution schedules"
      />

      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)} sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      {/* Schedules Table */}
      <SectionCard
        title="Schedules"
        toolbar={
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            Create Schedule
          </Button>
        }
      >
        {loadingSchedules ? <LinearProgress /> : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Dataset ID</TableCell>
                  <TableCell>Cron</TableCell>
                  <TableCell>Next Run</TableCell>
                  <TableCell align="center">Enabled</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(schedulesData?.schedules ?? []).map((s) => (
                  <TableRow key={s.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                      {s.description && (
                        <Typography variant="caption" color="text.secondary">{s.description}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{s.dataset_id}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{s.cron_expr}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {s.next_run ? new Date(s.next_run).toLocaleString() : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={s.enabled}
                        size="small"
                        onChange={(e) => updateMutation.mutate({ id: s.id, enabled: e.target.checked })}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Delete schedule">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => deleteMutation.mutate(s.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {(schedulesData?.schedules ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                        No schedules configured.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>

      {/* Run History Table */}
      <Box sx={{ mt: 3 }}>
        <SectionCard
          title="Run History"
          toolbar={
            <Button
              size="small"
              variant="outlined"
              startIcon={<PlayArrowIcon />}
              onClick={() => setRunOpen(true)}
            >
              Run Now
            </Button>
          }
        >
          {loadingRuns ? <LinearProgress /> : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Run ID</TableCell>
                    <TableCell>Trigger</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Started At</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Dataset</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(runsData?.runs ?? []).map((run) => (
                    <TableRow key={run.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {run.id.slice(0, 8)}…
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{run.trigger}</Typography>
                      </TableCell>
                      <TableCell>
                        <RunStatusChip status={run.status} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(run.started_at).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {run.duration_s != null ? `${run.duration_s}s` : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{run.dataset_id}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(runsData?.runs ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                          No runs yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </SectionCard>
      </Box>

      <CreateScheduleDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(form) => createMutation.mutate(form)}
        isPending={createMutation.isPending}
      />

      <RunNowDialog
        open={runOpen}
        onClose={() => setRunOpen(false)}
        onSubmit={(dataset_id) => runMutation.mutate(dataset_id)}
        isPending={runMutation.isPending}
      />
    </Box>
  )
}
