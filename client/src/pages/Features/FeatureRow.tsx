import Box from '@mui/material/Box'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import Switch from '@mui/material/Switch'
import Chip from '@mui/material/Chip'
import type { FeatureSpec, TransformType } from '../../api/types'
import { useState } from 'react'

interface FeatureRowProps {
  spec: FeatureSpec
  onToggle: (id: string, enabled: boolean) => void
  onTransformChange: (id: string, transform: TransformType) => void
}

const transforms: TransformType[] = [
  'none', 'log', 'sqrt', 'standard_scale', 'min_max_scale',
  'one_hot_encode', 'label_encode', 'target_encode',
  'bin', 'polynomial', 'interaction', 'date_parts', 'tfidf',
]

const dtypeColor: Record<string, string> = { float64: '#6C63FF', int64: '#4CAF50', object: '#FF6584' }

export default function FeatureRow({ spec, onToggle, onTransformChange }: FeatureRowProps) {
  const [transform, setTransform] = useState<TransformType>(spec.transform)

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '40px 18% 1fr 15% 9% 11% 40px',
        gap: 2,
        alignItems: 'center',
        py: 1.5,
        px: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        opacity: spec.enabled ? 1 : 0.5,
        '&:hover': { bgcolor: 'action.hover' },
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Switch
        size="small"
        checked={spec.enabled}
        onChange={(e) => onToggle(spec.id, e.target.checked)}
      />

      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {spec.output_name}
      </Typography>

      <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {spec.source_columns.join(', ')}
      </Typography>

      <Select
        size="small"
        value={transform}
        onChange={(e) => {
          const t = e.target.value as TransformType
          setTransform(t)
          onTransformChange(spec.id, t)
        }}
        sx={{ fontSize: '0.78rem' }}
        disabled={!spec.enabled}
      >
        {transforms.map((t) => (
          <MenuItem key={t} value={t} sx={{ fontSize: '0.78rem' }}>{t.replace(/_/g, ' ')}</MenuItem>
        ))}
      </Select>

      <Chip label={spec.dtype_in} size="small" sx={{ bgcolor: dtypeColor[spec.dtype_in] ?? '#888', color: 'white', fontSize: '0.65rem' }} />
      <Chip label={spec.dtype_out} size="small" sx={{ bgcolor: dtypeColor[spec.dtype_out] ?? '#888', color: 'white', fontSize: '0.65rem' }} />

      <Chip label={spec.enabled ? 'ON' : 'OFF'} color={spec.enabled ? 'success' : 'default'} size="small" />
    </Box>
  )
}
