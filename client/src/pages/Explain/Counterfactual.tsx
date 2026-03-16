import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Slider from '@mui/material/Slider'
import Chip from '@mui/material/Chip'
import { useState } from 'react'
import type { CounterfactualResult } from '../../api/types'

interface CounterfactualProps {
  cf: CounterfactualResult
}

export default function Counterfactual({ cf }: CounterfactualProps) {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(cf.features.map((f) => [f.feature, f.cf_value]))
  )

  const changedCount = cf.features.filter((f) => values[f.feature] !== f.original_value).length
  const predictionChanged = changedCount >= 2

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 3, mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">Original Prediction</Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'error.main' }}>
            {(cf.original_prediction * 100).toFixed(1)}% {cf.original_class}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.disabled' }}>→</Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Counterfactual Prediction</Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, color: predictionChanged ? 'success.main' : 'error.main' }}>
            {predictionChanged
              ? `${(cf.cf_prediction * 100).toFixed(1)}% ${cf.cf_class}`
              : `${(cf.original_prediction * 100).toFixed(1)}% ${cf.original_class}`}
          </Typography>
        </Box>
        {predictionChanged && (
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
            <Chip label="Prediction Flipped!" color="success" sx={{ fontWeight: 700 }} />
          </Box>
        )}
      </Box>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        Adjust feature values to see how predictions change:
      </Typography>

      <Grid container spacing={3}>
        {cf.features.map((feat) => {
          const val = values[feat.feature]
          const changed = val !== feat.original_value
          return (
            <Grid key={feat.feature} size={{ xs: 12, sm: 6 }}>
              <Box sx={{ p: 2, border: '1px solid', borderColor: changed ? 'primary.main' : 'divider', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{feat.feature}</Typography>
                  {changed && <Chip label="Changed" size="small" color="primary" variant="outlined" />}
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Original: <strong>{feat.original_value.toLocaleString()}</strong></Typography>
                  <Typography variant="caption" color="primary.main">Now: <strong>{val.toLocaleString()}</strong></Typography>
                </Box>
                <Slider
                  value={val}
                  onChange={(_, v) => setValues((prev) => ({ ...prev, [feat.feature]: v as number }))}
                  min={feat.min}
                  max={feat.max}
                  step={feat.step}
                  size="small"
                  color={changed ? 'primary' : 'secondary'}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.disabled">{feat.min.toLocaleString()}</Typography>
                  <Typography variant="caption" color="text.disabled">{feat.max.toLocaleString()}</Typography>
                </Box>
              </Box>
            </Grid>
          )
        })}
      </Grid>
    </Box>
  )
}
