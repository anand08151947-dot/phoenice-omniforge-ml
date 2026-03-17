import Box from '@mui/material/Box'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import Switch from '@mui/material/Switch'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
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
  'bin', 'polynomial', 'interaction', 'date_parts', 'tfidf', 'embedding',
]

const TRANSFORM_HELP: Record<TransformType, string> = {
  none:            'No transformation — column is used as-is.',
  log:             'log(x + 1) — reduces right skew in numeric columns. Use when values span several orders of magnitude (e.g. income, prices).',
  sqrt:            '√x — milder skew reduction than log. Good for count data with moderate skew.',
  standard_scale:  'z-score: (x − mean) / std — centers data at 0 with unit variance. Required for distance-based models (SVM, KNN, logistic regression).',
  min_max_scale:   'Scales values to [0, 1]. Preserves shape; sensitive to outliers. Use when you know the value range is bounded.',
  one_hot_encode:  'Creates a binary column per category (e.g. "color" → color_red, color_blue). Best for ≤ 15 unique values. Increases dimensionality.',
  label_encode:    'Maps categories to integers (0, 1, 2…). Fast and compact but implies ordinal order. Works well with tree models.',
  target_encode:   'Replaces category with the mean of the target. Powerful for high-cardinality columns; requires care to avoid data leakage.',
  bin:             'Buckets continuous values into discrete ranges (e.g. age → young/mid/senior). Useful when the relationship with target is non-linear.',
  polynomial:      'Generates x², x³ … and interaction terms. Adds non-linear signal for linear models; can cause feature explosion.',
  interaction:     'Multiplies two columns together (x × y). Captures combined effect not visible individually.',
  date_parts:      'Extracts year, month, day, day-of-week from a datetime column. Makes temporal patterns learnable.',
  tfidf:           'TF-IDF vectorisation for free-text columns. Converts text to numeric importance scores per word.',
  embedding:       'Text Embedding — converts text to dense vector representations using a pre-trained model.',
}

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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Select
          size="small"
          value={transform}
          onChange={(e) => {
            const t = e.target.value as TransformType
            setTransform(t)
            onTransformChange(spec.id, t)
          }}
          sx={{ fontSize: '0.78rem', flex: 1 }}
          disabled={!spec.enabled}
        >
          {transforms.map((t) => (
            <MenuItem key={t} value={t} sx={{ fontSize: '0.78rem' }}>{t.replace(/_/g, ' ')}</MenuItem>
          ))}
        </Select>
        <Tooltip
          title={
            <Box sx={{ maxWidth: 280 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                {transform.replace(/_/g, ' ').toUpperCase()}
              </Typography>
              <Typography variant="caption">{TRANSFORM_HELP[transform]}</Typography>
            </Box>
          }
          placement="left"
          arrow
        >
          <IconButton size="small" sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' } }}>
            <InfoOutlinedIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Chip label={spec.dtype_in} size="small" sx={{ bgcolor: dtypeColor[spec.dtype_in] ?? '#888', color: 'white', fontSize: '0.65rem' }} />
      <Chip label={spec.dtype_out} size="small" sx={{ bgcolor: dtypeColor[spec.dtype_out] ?? '#888', color: 'white', fontSize: '0.65rem' }} />

      <Chip label={spec.enabled ? 'ON' : 'OFF'} color={spec.enabled ? 'success' : 'default'} size="small" />
    </Box>
  )
}
