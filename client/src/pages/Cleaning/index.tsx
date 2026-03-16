import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Divider from '@mui/material/Divider'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import MetricCard from '../../components/shared/MetricCard'
import SectionCard from '../../components/shared/SectionCard'
import CleaningRule from './CleaningRule'
import type { CleaningPlan, CleaningStrategy } from '../../api/types'
import CleaningServicesIcon from '@mui/icons-material/CleaningServices'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'

export default function CleaningPage() {
  const [strategies, setStrategies] = useState<Record<string, CleaningStrategy>>({})
  const [applying, setApplying] = useState(false)

  const { data, isLoading } = useQuery<CleaningPlan>({
    queryKey: ['cleaning'],
    queryFn: () => fetch('/api/cleaning').then((r) => r.json()),
  })

  if (isLoading) return <LinearProgress />

  const plan = data!

  async function handleApply() {
    setApplying(true)
    await fetch('/api/cleaning/apply', { method: 'POST', body: JSON.stringify({ strategies }) })
    setApplying(false)
  }

  return (
    <Box>
      <PageHeader
        title="Data Cleaning"
        subtitle="Phase 3 — Configure and apply remediation strategies"
        actions={
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={handleApply}
            disabled={applying}
          >
            {applying ? 'Applying…' : 'Apply Cleaning Plan'}
          </Button>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <MetricCard label="Issues Found" value={plan.actions.length} icon={<CleaningServicesIcon />} color="#EF5350" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <MetricCard label="Rows Affected" value={plan.estimated_rows_affected.toLocaleString()} icon={<CleaningServicesIcon />} color="#FFA726" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <MetricCard label="Columns to Drop" value={plan.estimated_cols_removed} icon={<CleaningServicesIcon />} color="#9E9E9E" />
        </Grid>
      </Grid>

      <SectionCard title="Cleaning Rules" subheader="Configure the strategy for each detected issue" noPadding>
        <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '16% 1fr 12% 18% 1fr', gap: 2 }}>
            {['Column', 'Issue', 'Severity', 'Strategy', 'Impact'].map((h) => (
              <Typography key={h} variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 0.5 }}>{h}</Typography>
            ))}
          </Box>
        </Box>
        {plan.actions.map((action) => (
          <CleaningRule
            key={action.id}
            action={action}
            onStrategyChange={(id, strategy) => setStrategies((prev) => ({ ...prev, [id]: strategy }))}
          />
        ))}
      </SectionCard>

      {applying && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Applying cleaning rules…
          </Typography>
        </Box>
      )}
    </Box>
  )
}
