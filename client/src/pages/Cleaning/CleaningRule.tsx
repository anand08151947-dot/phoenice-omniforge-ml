import Box from '@mui/material/Box'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { useState } from 'react'
import type { CleaningAction, CleaningStrategy } from '../../api/types'

interface CleaningRuleProps {
  action: CleaningAction
  onStrategyChange: (id: string, strategy: CleaningStrategy) => void
}

const strategies: CleaningStrategy[] = [
  'mean_impute', 'median_impute', 'mode_impute', 'knn_impute',
  'forward_fill', 'backward_fill', 'constant_fill',
  'clip_outliers', 'remove_outliers', 'drop_rows', 'drop_column', 'none',
]

const severityColor = { critical: 'error', high: 'error', medium: 'warning', low: 'info' } as const

export default function CleaningRule({ action, onStrategyChange }: CleaningRuleProps) {
  const [strategy, setStrategy] = useState<CleaningStrategy>(action.strategy)

  function handleChange(val: CleaningStrategy) {
    setStrategy(val)
    onStrategyChange(action.id, val)
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '16% 1fr 12% 18% 1fr',
        gap: 2,
        alignItems: 'center',
        py: 1.5,
        px: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:hover': { bgcolor: 'action.hover' },
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {action.column === '*' ? '(all rows)' : action.column}
      </Typography>

      <Box>
        <Chip label={action.issue_type.replace(/_/g, ' ')} size="small" variant="outlined" sx={{ mr: 0.5 }} />
        <Typography variant="caption" color="text.secondary">{action.issue_detail}</Typography>
      </Box>

      <Chip
        label={action.severity}
        color={severityColor[action.severity]}
        size="small"
      />

      <Select
        size="small"
        value={strategy}
        onChange={(e) => handleChange(e.target.value as CleaningStrategy)}
        sx={{ fontSize: '0.8rem' }}
      >
        {strategies.map((s) => (
          <MenuItem key={s} value={s} sx={{ fontSize: '0.8rem' }}>{s.replace(/_/g, ' ')}</MenuItem>
        ))}
      </Select>

      <Typography variant="caption" color="text.secondary">{action.estimated_impact}</Typography>
    </Box>
  )
}
