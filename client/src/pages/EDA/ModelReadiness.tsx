import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import SectionCard from '../../components/shared/SectionCard'
import type { EDAReport } from '../../api/types'

interface ModelReadinessProps {
  report: EDAReport
}

export default function ModelReadiness({ report }: ModelReadinessProps) {
  const leakageIssues = report.issues.filter((i) => i.type === 'leakage')
  const topFeatures = [...report.mi_scores].sort((a, b) => b.score - a.score)

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, lg: 5 }}>
        <SectionCard title="Leakage Risk Assessment">
          {leakageIssues.length === 0 ? (
            <Alert severity="success">No target leakage detected.</Alert>
          ) : (
            leakageIssues.map((issue) => (
              <Alert key={issue.id} severity="error" sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{issue.title}</Typography>
                <Typography variant="caption">{issue.detail}</Typography>
              </Alert>
            ))
          )}

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Model Readiness Checklist</Typography>
            {[
              { label: 'Target column defined', ok: true },
              { label: 'Missing values handled', ok: false },
              { label: 'Class imbalance addressed', ok: false },
              { label: 'No target leakage', ok: leakageIssues.length === 0 },
              { label: 'Categorical encoding planned', ok: true },
              { label: 'Feature scaling configured', ok: false },
            ].map((item) => (
              <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Chip label={item.ok ? '✓' : '✗'} color={item.ok ? 'success' : 'error'} size="small" sx={{ width: 28, height: 20, fontSize: '0.65rem' }} />
                <Typography variant="body2">{item.label}</Typography>
              </Box>
            ))}
          </Box>
        </SectionCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <SectionCard title="Feature Importance Preview (Random Forest)">
          <Box sx={{ height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topFeatures} layout="vertical" margin={{ top: 10, right: 20, left: 120, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => v.toFixed(2)} />
                <YAxis type="category" dataKey="feature" tick={{ fontSize: 11 }} width={115} />
                <Tooltip formatter={(v: any) => [Number(v).toFixed(4), 'MI Score']} />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {topFeatures.map((_, i) => (
                    <Cell key={i} fill={i < 3 ? '#6C63FF' : '#9E97FF'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </SectionCard>
      </Grid>
    </Grid>
  )
}
