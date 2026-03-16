import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import { useQuery } from '@tanstack/react-query'
import { RadialBarChart, RadialBar, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import SectionCard from '../../components/shared/SectionCard'
import MetricCard from '../../components/shared/MetricCard'
import type { MonitoringMetrics } from '../../api/types'
import SpeedIcon from '@mui/icons-material/Speed'
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt'

interface MonitoringPanelProps {
  deploymentId?: string
}

const driftColor = { stable: 'success', warning: 'warning', drift: 'error' } as const

export default function MonitoringPanel({ deploymentId = 'dep_001' }: MonitoringPanelProps) {
  const { data, isLoading } = useQuery<MonitoringMetrics>({
    queryKey: ['monitoring', deploymentId],
    queryFn: () => fetch('/api/deploy/monitoring').then((r) => r.json()),
    refetchInterval: 10000,
  })

  if (isLoading) return <LinearProgress />
  const m = data!

  const latencyData = [
    { name: 'p50', value: m.p50_latency_ms, fill: '#4CAF50' },
    { name: 'p95', value: m.p95_latency_ms, fill: '#FFA726' },
    { name: 'p99', value: m.p99_latency_ms, fill: '#EF5350' },
  ]

  const volumeData = m.prediction_volume.map((v) => ({
    hour: new Date(v.timestamp).getHours() + ':00',
    count: v.count,
  }))

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="p50 Latency" value={`${m.p50_latency_ms}ms`} icon={<SpeedIcon />} color="#4CAF50" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="p95 Latency" value={`${m.p95_latency_ms}ms`} icon={<SpeedIcon />} color="#FFA726" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Requests/min" value={m.requests_per_min} icon={<SignalCellularAltIcon />} color="#6C63FF" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Error Rate" value={`${(m.error_rate * 100).toFixed(2)}%`} icon={<SpeedIcon />} color={m.error_rate > 0.01 ? '#EF5350' : '#4CAF50'} /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <SectionCard title="Latency Gauges">
            <Box sx={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius={30} outerRadius={90} data={latencyData} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" label={{ position: 'insideStart', fill: '#fff', fontSize: 10 }} background />
                  <Legend iconSize={10} layout="horizontal" verticalAlign="bottom" />
                  <Tooltip formatter={(v: any) => [`${Number(v)}ms`, 'Latency']} />
                </RadialBarChart>
              </ResponsiveContainer>
            </Box>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <SectionCard title="Prediction Volume (24h)">
            <Box sx={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={volumeData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={3} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#6C63FF" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </SectionCard>
        </Grid>
      </Grid>

      <SectionCard title="Feature Drift Monitor" subheader="Population Stability Index (PSI) — >0.2 = warning, >0.25 = drift">
        {m.drift_metrics.map((d) => (
          <Box key={d.feature} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', width: '20%', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.feature}</Typography>
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(d.psi * 200, 100)}
                color={d.status === 'drift' ? 'error' : d.status === 'warning' ? 'warning' : 'success'}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>
            <Typography variant="caption" sx={{ width: 60, textAlign: 'right' }}>PSI: {d.psi.toFixed(2)}</Typography>
            <Chip label={d.status} color={driftColor[d.status]} size="small" />
          </Box>
        ))}
      </SectionCard>
    </Box>
  )
}
