import Chip from '@mui/material/Chip'
import type { ChipProps } from '@mui/material/Chip'

type Status = 'pending' | 'running' | 'done' | 'warn' | 'critical' | 'high' | 'medium' | 'low' | 'pass' | 'fail'

interface StatusChipProps {
  status: Status
  label?: string
  size?: ChipProps['size']
}

const config: Record<Status, { label: string; color: ChipProps['color'] }> = {
  pending: { label: 'Pending', color: 'default' },
  running: { label: 'Running', color: 'info' },
  done: { label: 'Done', color: 'success' },
  warn: { label: 'Warning', color: 'warning' },
  critical: { label: 'Critical', color: 'error' },
  high: { label: 'High', color: 'error' },
  medium: { label: 'Medium', color: 'warning' },
  low: { label: 'Low', color: 'info' },
  pass: { label: 'Pass', color: 'success' },
  fail: { label: 'Fail', color: 'error' },
}

export default function StatusChip({ status, label, size = 'small' }: StatusChipProps) {
  const { label: defaultLabel, color } = config[status] ?? { label: status, color: 'default' }
  return <Chip label={label ?? defaultLabel} color={color} size={size} variant="filled" />
}
