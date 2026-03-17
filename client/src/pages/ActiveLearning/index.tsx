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
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/shared/PageHeader'
import SectionCard from '../../components/shared/SectionCard'
import MetricCard from '../../components/shared/MetricCard'
import LabelIcon from '@mui/icons-material/Label'
import DatasetIcon from '@mui/icons-material/Dataset'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import PsychologyAltIcon from '@mui/icons-material/PsychologyAlt'

// ─── Types ───────────────────────────────────────────────────────────────────

type Strategy = 'confidence' | 'entropy' | 'margin'

interface ALStats {
  total_predictions: number
  labeled: number
  unlabeled: number
  review_rate: number
  avg_confidence: number
}

interface UncertainSample {
  prediction_id: string
  input_features: Record<string, unknown>
  prediction: string
  confidence: number
  uncertainty_score: number
  deployment_id?: string
}

interface UncertainResponse {
  samples: UncertainSample[]
}

interface GroundTruthPayload {
  prediction_id: string
  ground_truth: string
}

// ─── API ─────────────────────────────────────────────────────────────────────

const api = {
  getStats: (): Promise<ALStats> =>
    fetch('/api/active-learning/stats').then((r) => r.json()),

  getUncertain: (n: number, strategy: Strategy, deploymentId?: string): Promise<UncertainResponse> => {
    let url = `/api/active-learning/uncertain?n=${n}&strategy=${strategy}`
    if (deploymentId) url += `&deployment_id=${deploymentId}`
    return fetch(url).then((r) => r.json())
  },

  submitLabel: (payload: GroundTruthPayload): Promise<void> =>
    fetch('/api/active-learning/ground-truth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => { if (!r.ok) throw new Error('Submit failed') }),
}

// ─── Stats Cards ─────────────────────────────────────────────────────────────

function StatsSection({ stats }: { stats: ALStats }) {
  const reviewPct = Math.round(stats.review_rate * 100)
  const confPct = Math.round(stats.avg_confidence * 100)

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <MetricCard label="Total Predictions" value={stats.total_predictions.toLocaleString()} icon={<DatasetIcon />} color="#6C63FF" />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <MetricCard label="Labeled" value={stats.labeled.toLocaleString()} icon={<CheckBoxIcon />} color="#4CAF50" />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <MetricCard label="Unlabeled" value={stats.unlabeled.toLocaleString()} icon={<LabelIcon />} color="#FFA726" />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 3 }}>
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
          <Typography variant="caption" color="text.secondary">Review Rate</Typography>
          <Typography variant="h6" fontWeight={700}>{reviewPct}%</Typography>
          <LinearProgress variant="determinate" value={reviewPct} color="primary" sx={{ height: 6, borderRadius: 3, mt: 0.5 }} />
        </Box>
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 3 }}>
        <MetricCard label="Avg Confidence" value={`${confPct}%`} icon={<TrendingUpIcon />} color="#29B6F6" />
      </Grid>
    </Grid>
  )
}

// ─── Inline Label Row ─────────────────────────────────────────────────────────

interface LabelRowProps {
  sample: UncertainSample
  onLabeled: () => void
}

function LabelRow({ sample, onLabeled }: LabelRowProps) {
  const [labelMode, setLabelMode] = useState(false)
  const [groundTruth, setGroundTruth] = useState('')
  const [success, setSuccess] = useState(false)

  const mutation = useMutation({
    mutationFn: api.submitLabel,
    onSuccess: () => {
      setSuccess(true)
      setLabelMode(false)
      onLabeled()
    },
  })

  const featureKeys = Object.keys(sample.input_features).slice(0, 3)
  const confPct = Math.round(sample.confidence * 100)

  return (
    <TableRow hover>
      <TableCell>
        <Tooltip title={sample.prediction_id}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {sample.prediction_id.slice(0, 10)}…
          </Typography>
        </Tooltip>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ fontSize: 11 }}>
          {featureKeys.map((k) => (
            <span key={k} style={{ display: 'block' }}>
              <strong>{k}:</strong> {String(sample.input_features[k])}
            </span>
          ))}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" fontWeight={600}>{sample.prediction}</Typography>
      </TableCell>
      <TableCell align="right">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinearProgress
            variant="determinate"
            value={confPct}
            color={confPct >= 80 ? 'success' : confPct >= 50 ? 'warning' : 'error'}
            sx={{ width: 60, height: 6, borderRadius: 3 }}
          />
          <Typography variant="caption">{confPct}%</Typography>
        </Box>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2">{sample.uncertainty_score.toFixed(4)}</Typography>
      </TableCell>
      <TableCell align="right">
        {success ? (
          <Typography variant="caption" color="success.main">✓ Labeled</Typography>
        ) : labelMode ? (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', justifyContent: 'flex-end' }}>
            <TextField
              size="small"
              value={groundTruth}
              onChange={(e) => setGroundTruth(e.target.value)}
              placeholder="Ground truth"
              sx={{ width: 130 }}
            />
            <Button
              size="small"
              variant="contained"
              disabled={!groundTruth || mutation.isPending}
              onClick={() => mutation.mutate({ prediction_id: sample.prediction_id, ground_truth: groundTruth })}
            >
              Submit
            </Button>
            <Button size="small" onClick={() => setLabelMode(false)}>Cancel</Button>
          </Box>
        ) : (
          <Button
            size="small"
            variant="outlined"
            startIcon={<LabelIcon />}
            onClick={() => setLabelMode(true)}
          >
            Label
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ActiveLearningPage() {
  const queryClient = useQueryClient()
  const [strategy, setStrategy] = useState<Strategy>('confidence')
  const [deploymentFilter, setDeploymentFilter] = useState('')

  const { data: stats, isLoading: loadingStats } = useQuery<ALStats>({
    queryKey: ['al-stats'],
    queryFn: api.getStats,
  })

  const { data: uncertainData, isLoading: loadingUncertain } = useQuery<UncertainResponse>({
    queryKey: ['al-uncertain', strategy, deploymentFilter],
    queryFn: () => api.getUncertain(20, strategy, deploymentFilter || undefined),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['al-stats'] })
    queryClient.invalidateQueries({ queryKey: ['al-uncertain'] })
  }

  return (
    <Box>
      <PageHeader
        title="Annotation Queue"
        subtitle="Phase 12 — Active learning & ground truth labeling"
      />

      {loadingStats ? (
        <LinearProgress sx={{ mb: 3 }} />
      ) : stats ? (
        <StatsSection stats={stats} />
      ) : null}

      <SectionCard
        title="Uncertain Samples"
        subheader="Samples selected for annotation based on model uncertainty"
        toolbar={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              label="Deployment ID"
              value={deploymentFilter}
              onChange={(e) => setDeploymentFilter(e.target.value)}
              size="small"
              sx={{ width: 160 }}
            />
            <ToggleButtonGroup
              value={strategy}
              exclusive
              size="small"
              onChange={(_, v) => { if (v) setStrategy(v) }}
            >
              <ToggleButton value="confidence">Confidence</ToggleButton>
              <ToggleButton value="entropy">Entropy</ToggleButton>
              <ToggleButton value="margin">Margin</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        }
      >
        {loadingUncertain ? (
          <LinearProgress />
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Prediction ID</TableCell>
                  <TableCell>Key Features</TableCell>
                  <TableCell>Prediction</TableCell>
                  <TableCell align="right">Confidence</TableCell>
                  <TableCell align="right">Uncertainty</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(uncertainData?.samples ?? []).map((sample) => (
                  <LabelRow key={sample.prediction_id} sample={sample} onLabeled={invalidate} />
                ))}
                {(uncertainData?.samples ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                        No uncertain samples found.
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
  )
}
