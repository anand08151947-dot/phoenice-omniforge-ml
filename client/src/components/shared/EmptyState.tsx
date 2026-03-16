import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Box sx={{ textAlign: 'center', py: 8, px: 4 }}>
      {icon && (
        <Box sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }}>{icon}</Box>
      )}
      <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>{title}</Typography>
      {description && <Typography variant="body2" color="text.disabled" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>{description}</Typography>}
      {action}
    </Box>
  )
}
