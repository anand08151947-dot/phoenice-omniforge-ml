/**
 * ActorPrompt — first-launch identity prompt
 * Asks user for their name/email so actions can be tracked in audit logs.
 */
import React, { useState } from 'react'
import {
  Box, Paper, Typography, TextField, Button, Stack
} from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'

interface Props {
  onSave: (name: string) => void
}

export default function ActorPrompt({ onSave }: Props) {
  const [name, setName] = useState('')

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Paper sx={{ p: 5, maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <PersonIcon sx={{ fontSize: 56, color: 'primary.main', mb: 2 }} />
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Welcome to OmniForge ML
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Enter your name or email so your actions can be tracked in project audit logs.
          You can change this later.
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="Your name or email"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()) }}
          />
          <Button
            variant="contained"
            size="large"
            disabled={!name.trim()}
            onClick={() => onSave(name.trim())}
          >
            Get Started
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
