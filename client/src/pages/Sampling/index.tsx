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
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import PageHeader from '../../components/shared/PageHeader'
import SectionCard from '../../components/shared/SectionCard'
import MetricCard from '../../components/shared/MetricCard'
import type { ImbalanceReport, SamplingStrategy } from '../../api/types'
import ScaleIcon from '@mui/icons-material/Scale'

interface SamplingResponse {
  imbalance: ImbalanceReport
  config: { strategy: SamplingStrategy; target_ratio: number; random_seed: number; test_size: number; val_size: number }
}

const STRATEGIES: { value: SamplingStrategy; label: string; desc: string }[] = [
  { value: 'none', label: 'No Resampling', desc: 'Use class weights in model training' },
  { value: 'oversample_smote', label: 'SMOTE Oversample', desc: 'Synthetic minority oversampling (recommended)' },
  { value: 'oversample_random', label: 'Random Oversample', desc: 'Duplicate minority class samples' },
  { value: 'undersample_random', label: 'Random Undersample', desc: 'Reduce majority class samples' },
  { value: 'class_weights', label: 'Class Weights', desc: 'Balance via loss weighting (no resampling)' },
]

export default function SamplingPage() {
  const [strategy, setStrategy] = useState<SamplingStrategy>('oversample_smote')
  const [targetRatio, setTargetRatio] = useState(0.3)
  const [applying, setApplying] = useState(false)

  const { data, isLoading } = useQuery<SamplingResponse>({
    queryKey: ['sampling'],
    queryFn: () => fetch('/api/sampling').then((r) => r.json()),
  })

  if (isLoading) return <LinearProgress />

  const { imbalance } = data!
  const COLORS = ['#6C63FF', '#FF6584', '#4CAF50', '#FFA726']

  async function handleApply() {
    setApplying(true)
    await fetch('/api/sampling/apply', { method: 'POST', body: JSON.stringify({ strategy, target_ratio: targetRatio }) })
    setApplying(false)
  }

  return (
    <Box>
      <PageHeader
        title="Class Balancing"
        subtitle="Phase 4 — Address class imbalance before model training"
        actions={<Button variant="contained" startIcon={<ScaleIcon />} onClick={handleApply} disabled={applying}>{applying ? 'Applying…' : 'Apply Strategy'}</Button>}
      />

      <Alert severity="error" sx={{ mb: 3 }}>
        <strong>Severe class imbalance detected:</strong> {imbalance.imbalance_ratio.toFixed(1)}:1 ratio — minority class is only {(imbalance.class_distribution[1].pct * 100).toFixed(0)}% of data
      </Alert>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard title="Current Class Distribution">
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={imbalance.class_distribution} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={100} label={(p: any) => `${p.label}: ${(p.pct * 100).toFixed(0)}%`}>
                    {imbalance.class_distribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [Number(v).toLocaleString(), 'Samples']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard title="Resampling Strategy">
            <RadioGroup value={strategy} onChange={(e) => setStrategy(e.target.value as SamplingStrategy)}>
              {STRATEGIES.map((s) => (
                <FormControlLabel
                  key={s.value}
                  value={s.value}
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.desc}</Typography>
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
                  min={0.1}
                  max={0.5}
                  step={0.05}
                  marks={[{ value: 0.1, label: '10%' }, { value: 0.3, label: '30%' }, { value: 0.5, label: '50%' }]}
                  sx={{ mt: 1 }}
                />
              </Box>
            )}
          </SectionCard>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><MetricCard label="Current Ratio" value={`${imbalance.imbalance_ratio.toFixed(0)}:1`} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><MetricCard label="Minority Class" value={`${(imbalance.class_distribution[1].pct * 100).toFixed(0)}%`} color="#FF6584" /></Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  )
}
