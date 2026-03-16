import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Chip from '@mui/material/Chip'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import type { EDAIssue } from '../../api/types'
import IssueAlert from '../../components/shared/IssueAlert'

interface IssuesSummaryProps {
  issues: EDAIssue[]
  addressedPhases?: Record<string, string>  // phase -> description of how it was addressed
}

const order = { critical: 0, high: 1, medium: 2, low: 3 }

export default function IssuesSummary({ issues, addressedPhases = {} }: IssuesSummaryProps) {
  const sorted = [...issues].sort((a, b) => order[a.severity] - order[b.severity])
  const openIssues = sorted.filter((i) => !addressedPhases[i.phase])
  const addressedIssues = sorted.filter((i) => !!addressedPhases[i.phase])
  const openCritical = openIssues.filter((i) => i.severity === 'critical' || i.severity === 'high').length

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {openCritical > 0
          ? `${openCritical} critical/high priority issue${openCritical > 1 ? 's' : ''} require immediate attention.`
          : addressedIssues.length > 0
          ? 'All critical issues have been addressed in downstream phases.'
          : 'No issues detected.'}
      </Typography>

      {/* Open issues */}
      {openIssues.map((issue) => (
        <IssueAlert key={issue.id} {...issue} />
      ))}

      {/* Addressed issues — shown as resolved */}
      {addressedIssues.length > 0 && (
        <Box sx={{ mt: openIssues.length > 0 ? 2 : 0 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', display: 'block', mb: 1 }}>
            Addressed Issues
          </Typography>
          {addressedIssues.map((issue) => (
            <Alert
              key={issue.id}
              severity="success"
              icon={<CheckCircleIcon fontSize="small" />}
              sx={{ mb: 1, opacity: 0.9 }}
              action={
                <Chip
                  label={addressedPhases[issue.phase]}
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ fontSize: '0.68rem', mr: 1 }}
                />
              }
            >
              <AlertTitle sx={{ fontWeight: 700, textDecoration: 'line-through', opacity: 0.7 }}>{issue.title}</AlertTitle>
              <Typography variant="body2" sx={{ opacity: 0.75 }}>{issue.detail}</Typography>
            </Alert>
          ))}
        </Box>
      )}
    </Box>
  )
}
