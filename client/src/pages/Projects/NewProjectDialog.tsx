/**
 * NewProjectDialog — creates a new ML project via POST /api/projects
 */
import React, { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, Chip, Typography, Stack
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

interface Props {
  open: boolean
  actorName: string
  onClose: () => void
  onCreate: (project: { id: string; name: string }) => void
}

export default function NewProjectDialog({ open, actorName, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [teamInput, setTeamInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Project name is required'); return }
    setLoading(true)
    setError(null)
    try {
      const teamMembers = teamInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((email) => ({ email, role: 'analyst' }))

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          owner: actorName || 'Unknown',
          team_members: teamMembers,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      onCreate({ id: data.id, name: data.name })
      setName(''); setDescription(''); setTeamInput('')
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Project</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Project Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            autoFocus
          />
          <TextField
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
            fullWidth
          />
          <TextField
            label="Team Members (comma-separated emails)"
            value={teamInput}
            onChange={(e) => setTeamInput(e.target.value)}
            fullWidth
            placeholder="alice@company.com, bob@company.com"
            helperText="Optional — add team members who will work on this project"
          />
          {error && <Typography color="error" variant="body2">{error}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !name.trim()}
          startIcon={<AddIcon />}
        >
          {loading ? 'Creating…' : 'Create Project'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
