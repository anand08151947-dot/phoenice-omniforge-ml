import Box from '@mui/material/Box'
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
import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import SectionCard from '../../components/shared/SectionCard'

interface DriftFeature {
  feature: string
  psi: number
  drift_level: 'stable' | 'warning' | 'critical'
}

interface DriftResponse {
  deployment_id: string
  features: DriftFeature[]
}

const driftColor = {
  stable: 'success',
  warning: 'warning',
  critical: 'error',
} as const

const driftBg = {
  stable: 'rgba(76,175,80,0.08)',
  warning: 'rgba(255,167,38,0.08)',
  critical: 'rgba(239,83,80,0.08)',
} as const

interface DriftPanelProps {
  deploymentId: string
}

export default function DriftPanel({ deploymentId }: DriftPanelProps) {
  const { data, isLoading, isError } = useQuery<DriftResponse>({
    queryKey: ['drift', deploymentId],
    queryFn: () => fetch(`/api/deploy/${deploymentId}/drift`).then((r) => {
      if (!r.ok) throw new Error('Failed to fetch drift data')
      return r.json()
    }),
    enabled: !!deploymentId,
    refetchInterval: 30000,
  })

  if (isLoading) return <LinearProgress />
  if (isError) return <Alert severity="error">Failed to load drift analysis.</Alert>
  if (!data) return null

  return (
    <SectionCard
      title="Drift Analysis"
      subheader="Population Stability Index — stable <0.1, warning 0.1–0.25, critical >0.25"
    >
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Feature</TableCell>
              <TableCell align="right">PSI Score</TableCell>
              <TableCell align="center">Drift Level</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.features.map((f) => (
              <TableRow
                key={f.feature}
                hover
                sx={{ bgcolor: driftBg[f.drift_level] }}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{f.feature}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                    <Box sx={{ width: 80 }}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(f.psi * 200, 100)}
                        color={driftColor[f.drift_level]}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'right' }}>
                      {f.psi.toFixed(3)}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={f.drift_level}
                    color={driftColor[f.drift_level]}
                    size="small"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </SectionCard>
  )
}
