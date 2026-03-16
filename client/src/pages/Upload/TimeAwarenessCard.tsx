import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import type { TimeAwareness } from '../../api/types'

interface Props {
  timeAwareness: TimeAwareness
  selectedOption: string
  onChange: (opt: string) => void
}

export default function TimeAwarenessCard({ timeAwareness, selectedOption, onChange }: Props) {
  if (!timeAwareness.has_datetime) return null

  return (
    <Alert severity="info" icon={<CalendarMonthIcon />} sx={{ '& .MuiAlert-message': { width: '100%' } }}>
      <Typography variant="body2" fontWeight={700} gutterBottom>
        📅 Time column detected: {timeAwareness.datetime_columns.join(', ')}
      </Typography>
      <RadioGroup value={selectedOption} onChange={e => onChange(e.target.value)}>
        {(timeAwareness.options ?? []).map(opt => (
          <FormControlLabel
            key={opt.id}
            value={opt.id}
            control={<Radio size="small" />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption">{opt.label}</Typography>
                {opt.id === timeAwareness.recommended && (
                  <Box sx={{ px: 0.75, py: 0.1, borderRadius: 10, bgcolor: 'success.main', color: '#fff', fontSize: '0.6rem', fontWeight: 700 }}>
                    recommended
                  </Box>
                )}
              </Box>
            }
          />
        ))}
      </RadioGroup>
    </Alert>
  )
}
