import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import SectionCard from '../../components/shared/SectionCard'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ReplayIcon from '@mui/icons-material/Replay'

interface Deployment {
  id: string
  name: string
  model_id: string
  status: string
  created_at: string
}

interface DeployListResponse {
  deployments: Deployment[]
}

async function fetchDeployments(): Promise<DeployListResponse> {
  const res = await fetch('/api/deploy/list')
  if (!res.ok) throw new Error('Failed to fetch deployments')
  return res.json()
}

async function approveDeployment(id: string): Promise<void> {
  const res = await fetch(`/api/deploy/${id}/approve`, { method: 'POST' })
  if (!res.ok) throw new Error('Approval failed')
}

async function rollbackDeployment(id: string): Promise<void> {
  const res = await fetch(`/api/deploy/${id}/rollback`, { method: 'POST' })
  if (!res.ok) throw new Error('Rollback failed')
}

export default function ApprovalPanel() {
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery<DeployListResponse>({
    queryKey: ['deploy-list'],
    queryFn: fetchDeployments,
  })

  const approveMutation = useMutation({
    mutationFn: approveDeployment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deploy-list'] }),
  })

  const rollbackMutation = useMutation({
    mutationFn: rollbackDeployment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deploy-list'] }),
  })

  const stagingDeployments = data?.deployments?.filter((d) => d.status === 'staging') ?? []

  if (isLoading) return <LinearProgress />

  return (
    <SectionCard title="Deployment Approval Queue" subheader="Staging deployments awaiting approval or rollback">
      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load deployments.</Alert>}
      {(approveMutation.isError || rollbackMutation.isError) && (
        <Alert severity="error" sx={{ mb: 2 }}>Action failed. Please try again.</Alert>
      )}
      {stagingDeployments.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No deployments awaiting approval.</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Model ID</TableCell>
                <TableCell>Created At</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stagingDeployments.map((dep) => (
                <TableRow key={dep.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{dep.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{dep.model_id}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(dep.created_at).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={dep.status} color="warning" size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => approveMutation.mutate(dep.id)}
                        disabled={approveMutation.isPending || rollbackMutation.isPending}
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<ReplayIcon />}
                        onClick={() => rollbackMutation.mutate(dep.id)}
                        disabled={approveMutation.isPending || rollbackMutation.isPending}
                      >
                        Rollback
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </SectionCard>
  )
}
