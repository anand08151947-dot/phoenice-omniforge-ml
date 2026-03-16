import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import Slider from '@mui/material/Slider'
import FormLabel from '@mui/material/FormLabel'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts'
import PageHeader from '../../components/shared/PageHeader'
import SectionCard from '../../components/shared/SectionCard'
import MetricCard from '../../components/shared/MetricCard'
import type { ImbalanceReport, SamplingStrategy } from '../../api/types'
import { usePipelineStore } from '../../stores/pipeline'
import ScaleIcon from '@mui/icons-material/Scale'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

interface SamplingResponse {
  imbalance: ImbalanceReport
  config: { strategy: SamplingStrategy; target_ratio: number; random_seed: number; test_size: number; val_size: number }
}

const STRATEGIES: { value: SamplingStrategy; label: string; desc: string; detail: string }[] = [
  {
    value: 'none',
    label: 'No Resampling',
    desc: 'Dataset is used as-is — imbalance is not corrected',
    detail: 'No changes are made to the training data. Suitable only when classes are nearly balanced (ratio < 2:1) or when the minority class is rare by nature (e.g. fraud) and you want the model to reflect real-world distribution. Bias toward the majority class is likely without correction.',
  },
  {
    value: 'oversample_smote',
    label: 'SMOTE Oversample',
    desc: 'Synthetic minority oversampling — creates new artificial samples',
    detail: 'SMOTE (Synthetic Minority Oversampling Technique) generates new synthetic samples by interpolating between existing minority-class examples in feature space. Unlike random duplication, it adds diversity. Best for severe imbalance (ratio > 10:1) with continuous features. Can introduce noise if minority samples are noisy.',
  },
  {
    value: 'oversample_random',
    label: 'Random Oversample',
    desc: 'Duplicates existing minority class samples at random',
    detail: 'Randomly duplicates rows from the minority class until the ratio is balanced. Simple and fast but may overfit to duplicated examples. Better than nothing for small datasets where SMOTE may extrapolate poorly.',
  },
  {
    value: 'undersample_random',
    label: 'Random Undersample',
    desc: 'Removes majority class samples at random to match minority size',
    detail: 'Randomly drops rows from the majority class to reduce the imbalance. Very fast but discards real data, which can hurt model performance when the dataset is small. Most appropriate when data is abundant and you can afford to discard majority samples.',
  },
  {
    value: 'class_weights',
    label: 'Class Weights',
    desc: 'No data changes — model penalises misclassifying the minority class more',
    detail: 'Tells the model to assign higher loss penalty for minority-class errors during training. No rows are added or removed — the full dataset is used. This is the safest approach for moderate imbalance (ratio 3–10:1). Supported by most classifiers (LightGBM, XGBoost, sklearn). Recommended default.',
  },
]

const COLORS = ['#6C63FF', '#FF6584', '#4CAF50', '#FFA726', '#00BCD4']

export default function SamplingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const datasetId = usePipelineStore((s) => s.datasetId)
  const datasetName = usePipelineStore((s) => s.datasetName)
  const setPhaseStatus = usePipelineStore((s) => s.setPhaseStatus)

  const [strategy, setStrategy] = useState<SamplingStrategy>('class_weights')
  const [targetRatio, setTargetRatio] = useState(0.3)
  const [isSaved, setIsSaved] = useState(false)
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' })

  const { data, isLoading, error } = useQuery<SamplingResponse>({
    queryKey: ['sampling', datasetId],
    queryFn: () => fetch(`/api/sampling?dataset_id=${datasetId}`).then(async (r) => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body?.detail ?? `Sampling API ${r.status}`)
      }
      return r.json()
    }),
    enabled: !!datasetId,
    retry: false,
  })

  const applyMutation = useMutation({
    mutationFn: (body: object) => fetch('/api/sampling/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => { if (!r.ok) throw new Error(`Apply ${r.status}`); return r.json() }),
    onSuccess: () => {
      setPhaseStatus('sampling', 'done')
      setIsSaved(true)
      queryClient.invalidateQueries({ queryKey: ['sampling', datasetId] })
      setSnack({ open: true, msg: `Strategy "${strategy.replace(/_/g, ' ')}" saved successfully.`, severity: 'success' })
    },
    onError: (e: any) => setSnack({ open: true, msg: `Error: ${e.message}`, severity: 'error' }),
  })

  // Seed local state from persisted config on first load
  const savedStrategy = data?.config?.strategy as SamplingStrategy | undefined
  const savedRatio = data?.config?.target_ratio

  useEffect(() => {
    if (savedStrategy) {
      setStrategy(savedStrategy)
      setIsSaved(true)
    }
    if (savedRatio != null) setTargetRatio(savedRatio)
  }, [savedStrategy, savedRatio])

  if (!datasetId) {
    return (
      <Box>
        <PageHeader title="Class Balancing" subtitle="Phase 4 — Address class imbalance before model training" />
        <Alert severity="info" action={<Button size="small" onClick={() => navigate('/upload')}>Upload Dataset</Button>}>
          No dataset selected. Upload or select a dataset first.
        </Alert>
      </Box>
    )
  }

  if (isLoading) return <LinearProgress />

  if (error || !data) {
    return (
      <Box>
        <PageHeader title="Class Balancing" subtitle={`Phase 4 — ${datasetName ?? 'No dataset selected'}`} />
        <Alert
          severity="warning"
          action={
            <Button size="small" color="inherit" onClick={() => navigate('/upload')}>
              Go to Upload
            </Button>
          }
        >
          {error instanceof Error ? error.message : 'Sampling data not available.'}&nbsp;
          Please go to <strong>Upload</strong>, select a dataset and set its target column, then return here.
        </Alert>
      </Box>
    )
  }

  const { imbalance } = data
  const dist = imbalance.class_distribution
  const minorityPct = dist.length > 1 ? (dist[dist.length - 1].pct * 100).toFixed(1) : '—'
  const isImbalanced = imbalance.imbalance_ratio > 3

  return (
    <Box>
      <PageHeader
        title="Class Balancing"
        subtitle={`Phase 4 — ${datasetName} · Target: ${imbalance.target_column}`}
        actions={
          <Button
            variant={isSaved && strategy === savedStrategy ? 'outlined' : 'contained'}
            startIcon={isSaved && strategy === savedStrategy ? <CheckCircleIcon /> : <ScaleIcon />}
            color={isSaved && strategy === savedStrategy ? 'success' : 'primary'}
            onClick={() => applyMutation.mutate({ dataset_id: datasetId, strategy, target_ratio: targetRatio, random_seed: 42, test_size: 0.2, val_size: 0.1 })}
            disabled={applyMutation.isPending}
          >
            {applyMutation.isPending ? 'Saving…' : (isSaved && strategy === savedStrategy ? '✓ Strategy Saved' : 'Save Strategy')}
          </Button>
        }
      />

      {isImbalanced ? (
        <Alert severity="warning" sx={{ mb: isSaved ? 1 : 3 }}>
          <strong>Class imbalance detected:</strong> {imbalance.imbalance_ratio.toFixed(1)}:1 ratio — minority class is only {minorityPct}% of data. Recommended: <strong>{imbalance.recommended_strategy.replace(/_/g, ' ')}</strong>.
        </Alert>
      ) : (
        <Alert severity="success" sx={{ mb: isSaved ? 1 : 3 }}>
          Classes are reasonably balanced ({imbalance.imbalance_ratio.toFixed(1)}:1 ratio). No resampling required.
        </Alert>
      )}

      {isSaved && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
          <strong>Strategy saved:</strong> "{strategy.replace(/_/g, ' ')}" — will be applied at training time.
          {strategy !== savedStrategy && <span> (unsaved changes — click Save Strategy to update)</span>}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard title={`Class Distribution — ${imbalance.target_column}`}>
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dist}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(p: any) => `${p.label}: ${(p.pct * 100).toFixed(1)}%`}
                  >
                    {dist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip formatter={(v: any) => [Number(v).toLocaleString(), 'Samples']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>

            <Grid container spacing={1} sx={{ mt: 1 }}>
              <Grid size={{ xs: 6 }}><MetricCard label="Imbalance Ratio" value={`${imbalance.imbalance_ratio.toFixed(1)}:1`} icon={<ScaleIcon />} color={isImbalanced ? '#FF6584' : '#4CAF50'} /></Grid>
              <Grid size={{ xs: 6 }}><MetricCard label="Classes" value={dist.length} icon={<ScaleIcon />} /></Grid>
              {dist.map((cls, i) => (
                <Grid key={cls.label} size={{ xs: 6 }}>
                  <MetricCard label={`"${cls.label}"`} value={`${(cls.pct * 100).toFixed(1)}%  (${cls.count.toLocaleString()})`} icon={<ScaleIcon />} color={COLORS[i % COLORS.length]} />
                </Grid>
              ))}
            </Grid>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard title="Resampling Strategy" subheader={savedStrategy ? `✓ Saved: ${savedStrategy.replace(/_/g, ' ')}` : 'Not yet configured — select and save below'}>
            <RadioGroup value={strategy} onChange={(e) => { setStrategy(e.target.value as SamplingStrategy); setIsSaved(false) }}>
              {STRATEGIES.map((s) => (
                <FormControlLabel
                  key={s.value}
                  value={s.value}
                  control={<Radio size="small" />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.desc}</Typography>
                      </Box>
                      <Tooltip
                        title={
                          <Box sx={{ maxWidth: 300 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                              {s.label}
                            </Typography>
                            <Typography variant="caption">{s.detail}</Typography>
                          </Box>
                        }
                        placement="right"
                        arrow
                      >
                        <IconButton size="small" sx={{ color: 'text.disabled', p: 0.5, '&:hover': { color: 'primary.main' } }}>
                          <InfoOutlinedIcon sx={{ fontSize: '1rem' }} />
                        </IconButton>
                      </Tooltip>
                      {s.value === imbalance.recommended_strategy && (
                        <Chip label="Recommended" size="small" color="primary" sx={{ fontSize: '0.65rem' }} />
                      )}
                      {s.value === savedStrategy && (
                        <Chip icon={<CheckCircleIcon sx={{ fontSize: '0.9rem !important' }} />} label="Saved" size="small" color="success" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                      )}
                    </Box>
                  }
                  sx={{ mb: 1, alignItems: 'flex-start' }}
                />
              ))}
            </RadioGroup>

            {strategy !== 'none' && strategy !== 'class_weights' && (
              <Box sx={{ mt: 2 }}>
                <FormLabel sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Target minority ratio: {(targetRatio * 100).toFixed(0)}%
                </FormLabel>
                <Slider
                  value={targetRatio}
                  onChange={(_, v) => setTargetRatio(v as number)}
                  min={0.1} max={0.5} step={0.05}
                  marks={[{ value: 0.1, label: '10%' }, { value: 0.3, label: '30%' }, { value: 0.5, label: '50%' }]}
                  sx={{ mt: 1 }}
                />
              </Box>
            )}

            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/features')}>
                Proceed to Feature Engineering
              </Button>
            </Box>
          </SectionCard>
        </Grid>
      </Grid>

      <Snackbar open={snack.open} autoHideDuration={5000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
