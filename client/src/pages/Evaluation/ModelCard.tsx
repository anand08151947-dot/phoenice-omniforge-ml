import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import type { LeaderboardEntry } from '../../api/types'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'

interface ModelCardProps {
  entry: LeaderboardEntry
  isChampion?: boolean
}

export default function ModelCard({ entry, isChampion }: ModelCardProps) {
  return (
    <Box
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: isChampion ? '#FFD700' : 'divider',
        borderRadius: 2,
        bgcolor: isChampion ? 'rgba(255, 215, 0, 0.05)' : 'background.paper',
        position: 'relative',
      }}
    >
      {isChampion && (
        <Box sx={{ position: 'absolute', top: -12, left: 16 }}>
          <Chip icon={<EmojiEventsIcon />} label="Champion" size="small" sx={{ bgcolor: '#FFD700', color: '#000', fontWeight: 800 }} />
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mt: isChampion ? 1 : 0 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>#{entry.rank} {entry.model_name}</Typography>
          <Chip label={entry.status} color={entry.status === 'champion' ? 'warning' : entry.status === 'challenger' ? 'info' : 'default'} size="small" sx={{ mt: 0.25 }} />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main' }}>{entry.cv_score.toFixed(4)}</Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mt: 1.5 }}>
        {[['F1', entry.f1.toFixed(4)], ['AUC-ROC', entry.auc_roc.toFixed(4)], ['Train', `${entry.train_time_s.toFixed(0)}s`]].map(([k, v]) => (
          <Box key={k}>
            <Typography variant="caption" color="text.secondary">{k}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{v}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
