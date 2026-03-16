import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import RadioGroup from '@mui/material/RadioGroup'
import Radio from '@mui/material/Radio'
import Slider from '@mui/material/Slider'
import TextField from '@mui/material/TextField'
import Divider from '@mui/material/Divider'
import FormLabel from '@mui/material/FormLabel'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import SectionCard from '../../components/shared/SectionCard'
import TrainingProgressPanel from './TrainingProgress'
import type { TrainingJob } from '../../api/types'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'

const MODEL_OPTIONS = [
  { id: 'linear', label: 'Linear / Logistic Regression', desc: 'Fast baseline, interpretable' },
  { id: 'tree', label: 'Decision Tree', desc: 'Simple tree-based model' },
  { id: 'rf', label: 'Random Forest', desc: 'Ensemble of decision trees' },
  { id: 'gbm', label: 'Gradient Boosting (XGB/LGB/CAT)', desc: 'State-of-the-art tabular performance' },
  { id: 'nn', label: 'Neural Network (MLP)', desc: 'Deep learning for complex patterns' },
  { id: 'svm', label: 'SVM (RBF)', desc: 'Support vector classification' },
]

export default function TrainingPage() {
  const [selectedModels, setSelectedModels] = useState<string[]>(['gbm', 'rf', 'linear'])
  const [hpo, setHpo] = useState('optuna')
  const [cv, setCv] = useState('stratified')
  const [maxTrials, setMaxTrials] = useState(50)
  const [timeout, setTimeout_] = useState(600)
  const [launching, setLaunching] = useState(false)
  const [showProgress, setShowProgress] = useState(true)

  const { data, isLoading } = useQuery<TrainingJob>({
    queryKey: ['training'],
    queryFn: () => fetch('/api/training').then((r) => r.json()),
  })

  if (isLoading) return <LinearProgress />

  const toggleModel = (id: string) =>
    setSelectedModels((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id])

  async function handleLaunch() {
    setLaunching(true)
    await fetch('/api/training/launch', { method: 'POST', body: JSON.stringify({ models: selectedModels, hpo, cv, max_trials: maxTrials, timeout }) })
    setLaunching(false)
    setShowProgress(true)
  }

  return (
    <Box>
      <PageHeader
        title="Model Training"
        subtitle="Phase 7 — AutoML with hyperparameter optimization"
        actions={
          <Button variant="contained" size="large" startIcon={<PlayArrowIcon />} onClick={handleLaunch} disabled={launching || selectedModels.length === 0}>
            {launching ? 'Launching…' : 'Launch Training'}
          </Button>
        }
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard title="Model Selection">
            {MODEL_OPTIONS.map((m) => (
              <FormControlLabel
                key={m.id}
                control={<Checkbox size="small" checked={selectedModels.includes(m.id)} onChange={() => toggleModel(m.id)} />}
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{m.desc}</Typography>
                  </Box>
                }
                sx={{ display: 'flex', mb: 0.5, alignItems: 'flex-start' }}
              />
            ))}
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard title="Hyperparameter Optimization">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormLabel sx={{ fontWeight: 700, mb: 0.5, display: 'block', fontSize: '0.85rem' }}>HPO Method</FormLabel>
                <RadioGroup value={hpo} onChange={(e) => setHpo(e.target.value)}>
                  {[['optuna', 'Optuna (Bayesian)'], ['grid', 'Grid Search'], ['random', 'Random Search']].map(([v, l]) => (
                    <FormControlLabel key={v} value={v} control={<Radio size="small" />} label={<Typography variant="body2">{l}</Typography>} />
                  ))}
                </RadioGroup>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormLabel sx={{ fontWeight: 700, mb: 0.5, display: 'block', fontSize: '0.85rem' }}>Cross-Validation</FormLabel>
                <RadioGroup value={cv} onChange={(e) => setCv(e.target.value)}>
                  {[['stratified', 'Stratified K-Fold (5)'], ['kfold', 'K-Fold (5)'], ['timeseries', 'Time-Series Split']].map(([v, l]) => (
                    <FormControlLabel key={v} value={v} control={<Radio size="small" />} label={<Typography variant="body2">{l}</Typography>} />
                  ))}
                </RadioGroup>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <FormLabel sx={{ fontWeight: 700, mb: 1, display: 'block', fontSize: '0.85rem' }}>Max Trials: {maxTrials}</FormLabel>
            <Slider value={maxTrials} onChange={(_, v) => setMaxTrials(v as number)} min={5} max={200} step={5}
              marks={[{ value: 5, label: '5' }, { value: 50, label: '50' }, { value: 200, label: '200' }]} />

            <Box sx={{ mt: 2 }}>
              <TextField
                label="Timeout (seconds)"
                type="number"
                size="small"
                value={timeout}
                onChange={(e) => setTimeout_(Number(e.target.value))}
                sx={{ width: 160 }}
              />
            </Box>
          </SectionCard>
        </Grid>
      </Grid>

      {showProgress && data && (
        <SectionCard title="Training Progress" subheader={`Job: ${data.job_id} · Status: ${data.status}`} sx={{ mt: 2 }}>
          <TrainingProgressPanel
            candidates={data.candidates}
            currentTrial={data.current_trial}
            totalTrials={data.total_trials}
            elapsedS={480}
            remainingS={120}
          />
        </SectionCard>
      )}
    </Box>
  )
}
