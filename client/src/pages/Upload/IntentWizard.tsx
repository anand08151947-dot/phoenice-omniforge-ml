import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import { useState } from 'react'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

const INTENT_OPTIONS = [
  { label: '🏦 Will a loan default?', task: 'classification', example: 'Yes/No outcome' },
  { label: '💰 Future sales amount', task: 'regression', example: 'Predict a number' },
  { label: '👥 Customer segment', task: 'clustering', example: 'Discover hidden groups' },
  { label: '🚨 Detect unusual transactions', task: 'anomaly_detection', example: 'Find rare events' },
  { label: '📝 Classify text / reviews', task: 'text_classification', example: 'Sentiment, topic, spam' },
  { label: '📈 Forecast future values', task: 'forecasting', example: 'Predict using timeline' },
]

interface Props {
  onSelect: (task: string) => void
}

export default function IntentWizard({ onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  function pick(task: string, label: string) {
    setSelected(label)
    onSelect(task)
    setOpen(false)
  }

  return (
    <Box sx={{ border: '1px dashed', borderColor: 'primary.main', borderRadius: 1.5, p: 1.5, bgcolor: 'rgba(25,118,210,0.03)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <Box>
          <Typography variant="body2" fontWeight={700}>
            🧠 Not sure what to predict?
          </Typography>
          {selected && (
            <Typography variant="caption" color="primary">Selected: {selected}</Typography>
          )}
        </Box>
        <Button size="small" endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />} sx={{ fontSize: '0.7rem' }}>
          {open ? 'Collapse' : 'Open Wizard'}
        </Button>
      </Box>

      <Collapse in={open}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, mb: 1 }}>
          What are you trying to predict?
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {INTENT_OPTIONS.map(opt => (
            <Box
              key={opt.task}
              onClick={() => pick(opt.task, opt.label)}
              sx={{
                p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1,
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
              }}
            >
              <Typography variant="body2">{opt.label}</Typography>
              <Typography variant="caption" color="text.secondary">{opt.example}</Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}
