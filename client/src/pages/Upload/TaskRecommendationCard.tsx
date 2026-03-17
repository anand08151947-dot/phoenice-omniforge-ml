import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Tooltip from '@mui/material/Tooltip'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import type { TaskRecommendation } from '../../api/types'

const TASK_DESCRIPTIONS: Record<string, string> = {
  classification: 'Predict a category (Yes/No, Fraud/Not Fraud, A/B/C)',
  regression: 'Predict a number (price, score, amount, rating)',
  clustering: 'Discover hidden groups without labels (unsupervised)',
  anomaly_detection: 'Find rare unusual cases in your data',
  text_classification: 'Classify free-text using TF-IDF + NLP models (NB, SVM, LR)',
  forecasting: 'Predict future values using past timeline',
}

interface Props {
  recommendation: TaskRecommendation | null
  selectedTask: string
  onChange: (task: string) => void
}

export default function TaskRecommendationCard({ recommendation, selectedTask, onChange }: Props) {
  const confidenceColor =
    (recommendation?.confidence ?? 0) >= 85 ? '#4caf50' :
    (recommendation?.confidence ?? 0) >= 65 ? '#ff9800' : '#f44336'

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        🧩 Task Recommendation
      </Typography>

      {recommendation && (
        <Box sx={{ mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="body2">
              We are&nbsp;
              <span style={{ color: confidenceColor, fontWeight: 700 }}>
                {recommendation.confidence}% confident
              </span>
              &nbsp;this is a&nbsp;
              <strong style={{ textTransform: 'capitalize' }}>
                {recommendation.task.replace('_', ' ')}
              </strong>
              &nbsp;problem.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {recommendation.why.map((w, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 12, color: '#4caf50' }} />
                <Typography variant="caption" color="text.secondary">{w}</Typography>
              </Box>
            ))}
          </Box>

          {/* Confidence bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'divider', overflow: 'hidden' }}>
              <Box sx={{ width: `${recommendation.confidence}%`, height: '100%', borderRadius: 3, bgcolor: confidenceColor, transition: 'width 0.5s' }} />
            </Box>
            <Typography variant="caption" sx={{ color: confidenceColor, fontWeight: 700, minWidth: 32 }}>
              {recommendation.confidence}%
            </Typography>
          </Box>
        </Box>
      )}

      {/* Task override selector with tooltips */}
      <FormControl size="small" fullWidth>
        <InputLabel>Task Type</InputLabel>
        <Select label="Task Type" value={selectedTask} onChange={e => onChange(e.target.value)}>
          {Object.entries(TASK_DESCRIPTIONS).map(([task, desc]) => (
            <MenuItem key={task} value={task}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Typography variant="body2" sx={{ textTransform: 'capitalize', flex: 1 }}>
                  {task.replace('_', ' ')}
                </Typography>
                {task === selectedTask && recommendation?.task === task && (
                  <Chip label="Recommended" size="small" color="success" sx={{ height: 16, fontSize: '0.6rem' }} />
                )}
                <Tooltip title={desc} placement="right">
                  <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                </Tooltip>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
        {TASK_DESCRIPTIONS[selectedTask] ?? ''}
      </Typography>
    </Box>
  )
}
