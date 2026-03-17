import { useState } from 'react'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Slider from '@mui/material/Slider'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import InputAdornment from '@mui/material/InputAdornment'

interface Props {
  tp: number
  fp: number
  fn: number
  tn: number
}

export default function BusinessImpactCalculator({ tp, fp, fn, tn }: Props) {
  const [tpBenefit, setTpBenefit] = useState<number>(100)
  const [fpCost, setFpCost] = useState<number>(10)
  const [fnCost, setFnCost] = useState<number>(50)
  const [tnBenefit, setTnBenefit] = useState<number>(0)

  const netImpact = tp * tpBenefit - fp * fpCost - fn * fnCost + tn * tnBenefit
  const randomImpact = (() => {
    const total = tp + fp + fn + tn
    const posFrac = (tp + fn) / Math.max(total, 1)
    const randomTp = total * posFrac * posFrac
    const randomFp = total * (1 - posFrac) * posFrac
    const randomFn = total * posFrac * (1 - posFrac)
    const randomTn = total * (1 - posFrac) * (1 - posFrac)
    return randomTp * tpBenefit - randomFp * fpCost - randomFn * fnCost + randomTn * tnBenefit
  })()

  const lift = randomImpact !== 0 ? ((netImpact - randomImpact) / Math.abs(randomImpact)) * 100 : 0
  const impactColor = netImpact >= 0 ? '#4caf50' : '#f44336'

  function NumberInput({ label, value, onChange, color }: {
    label: string; value: number; onChange: (v: number) => void; color: string
  }) {
    return (
      <TextField
        label={label}
        type="number"
        size="small"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        slotProps={{
          input: { startAdornment: <InputAdornment position="start">$</InputAdornment> }
        }}
        sx={{ '& .MuiOutlinedInput-root': { borderColor: color } }}
        fullWidth
      />
    )
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enter the business value per outcome to estimate net monetary impact of the model at current threshold.
      </Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={6}>
          <NumberInput label="Benefit per True Positive" value={tpBenefit} onChange={setTpBenefit} color="#4caf50" />
        </Grid>
        <Grid size={6}>
          <NumberInput label="Cost per False Positive" value={fpCost} onChange={setFpCost} color="#f44336" />
        </Grid>
        <Grid size={6}>
          <NumberInput label="Cost per False Negative" value={fnCost} onChange={setFnCost} color="#ff9800" />
        </Grid>
        <Grid size={6}>
          <NumberInput label="Benefit per True Negative" value={tnBenefit} onChange={setTnBenefit} color="#2196f3" />
        </Grid>
      </Grid>

      <Divider sx={{ my: 1.5 }} />

      <Grid container spacing={1.5}>
        {[
          { label: 'TP benefit', value: tp * tpBenefit, color: '#4caf50' },
          { label: 'FP cost', value: -fp * fpCost, color: '#f44336' },
          { label: 'FN cost', value: -fn * fnCost, color: '#ff9800' },
          { label: 'TN benefit', value: tn * tnBenefit, color: '#2196f3' },
        ].map(({ label, value, color }) => (
          <Grid size={3} key={label}>
            <Box sx={{ textAlign: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color }}>
                {value >= 0 ? '+' : ''}{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: `${impactColor}12`, border: `1px solid ${impactColor}30`, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">Net Business Impact</Typography>
        <Typography variant="h4" fontWeight={800} sx={{ color: impactColor }}>
          {netImpact >= 0 ? '+' : ''}{netImpact.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 0.5 }}>
          <Chip
            label={`${lift >= 0 ? '+' : ''}${lift.toFixed(1)}% vs random baseline`}
            size="small"
            sx={{ fontSize: '0.7rem', bgcolor: `${impactColor}20`, color: impactColor }}
          />
        </Box>
      </Box>
    </Box>
  )
}
