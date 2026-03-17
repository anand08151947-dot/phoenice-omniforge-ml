import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import type { PerClassMetric } from '../../api/types'

interface Props {
  metrics: PerClassMetric[]
}

function ScoreCell({ value, thresholds = [0.7, 0.5] }: { value: number; thresholds?: number[] }) {
  const color = value >= thresholds[0] ? '#4caf50' : value >= thresholds[1] ? '#ff9800' : '#f44336'
  return (
    <TableCell align="right">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, justifyContent: 'flex-end' }}>
        <Box sx={{ width: 40, height: 5, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden' }}>
          <Box sx={{ width: `${value * 100}%`, height: '100%', bgcolor: color, borderRadius: 2 }} />
        </Box>
        <Typography variant="caption" sx={{ color, fontWeight: 700, minWidth: 38, textAlign: 'right' }}>
          {value.toFixed(3)}
        </Typography>
      </Box>
    </TableCell>
  )
}

export default function PerClassMetricsTable({ metrics }: Props) {
  const totalSupport = metrics.reduce((s, m) => s + m.support, 0)

  // Weighted averages
  const weightedF1 = metrics.reduce((s, m) => s + m.f1 * m.support, 0) / Math.max(totalSupport, 1)
  const weightedPrec = metrics.reduce((s, m) => s + m.precision * m.support, 0) / Math.max(totalSupport, 1)
  const weightedRec = metrics.reduce((s, m) => s + m.recall * m.support, 0) / Math.max(totalSupport, 1)
  const macroF1 = metrics.reduce((s, m) => s + m.f1, 0) / Math.max(metrics.length, 1)

  return (
    <Box>
      <Table size="small" sx={{ '& td, & th': { borderColor: 'divider' } }}>
        <TableHead>
          <TableRow>
            <TableCell><Typography variant="caption" fontWeight={700}>Class</Typography></TableCell>
            <TableCell align="right"><Typography variant="caption" fontWeight={700}>Precision</Typography></TableCell>
            <TableCell align="right"><Typography variant="caption" fontWeight={700}>Recall</Typography></TableCell>
            <TableCell align="right"><Typography variant="caption" fontWeight={700}>F1 Score</Typography></TableCell>
            <TableCell align="right"><Typography variant="caption" fontWeight={700}>Support</Typography></TableCell>
            <TableCell align="right"><Typography variant="caption" fontWeight={700}>% of data</Typography></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {metrics.map((m) => (
            <TableRow key={m.class} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
              <TableCell>
                <Chip label={m.class} size="small" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', height: 20 }} />
              </TableCell>
              <ScoreCell value={m.precision} />
              <ScoreCell value={m.recall} />
              <ScoreCell value={m.f1} />
              <TableCell align="right">
                <Typography variant="caption">{m.support.toLocaleString()}</Typography>
              </TableCell>
              <TableCell align="right" sx={{ minWidth: 80 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                  <LinearProgress
                    variant="determinate"
                    value={m.support / Math.max(totalSupport, 1) * 100}
                    sx={{ width: 40, height: 4, borderRadius: 2 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {(m.support / Math.max(totalSupport, 1) * 100).toFixed(1)}%
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          ))}
          {/* Aggregates */}
          <TableRow sx={{ bgcolor: 'action.selected' }}>
            <TableCell><Typography variant="caption" fontWeight={700} color="text.secondary">Weighted avg</Typography></TableCell>
            <ScoreCell value={weightedPrec} />
            <ScoreCell value={weightedRec} />
            <ScoreCell value={weightedF1} />
            <TableCell align="right"><Typography variant="caption" fontWeight={700}>{totalSupport.toLocaleString()}</Typography></TableCell>
            <TableCell align="right"><Typography variant="caption" color="text.secondary">100%</Typography></TableCell>
          </TableRow>
          <TableRow>
            <TableCell><Typography variant="caption" fontWeight={700} color="text.secondary">Macro avg</Typography></TableCell>
            <TableCell colSpan={2} />
            <ScoreCell value={macroF1} />
            <TableCell colSpan={2} />
          </TableRow>
        </TableBody>
      </Table>
    </Box>
  )
}
