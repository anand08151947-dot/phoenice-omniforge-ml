import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import { useState, useRef, useEffect } from 'react'
import SendIcon from '@mui/icons-material/Send'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import PersonIcon from '@mui/icons-material/Person'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import type { ChatMessage } from '../../api/types'
import PageHeader from '../../components/shared/PageHeader'

const SUGGESTIONS = [
  "Explain the top model's predictions",
  'What caused class imbalance?',
  'Recommend next steps',
  'Which features are most important?',
  'How to improve F1 score?',
]

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'sys_1',
    role: 'assistant',
    content: "Hello! I'm your OmniForge ML assistant powered by LM Studio. I can help you understand your data, interpret model predictions, and guide you through the pipeline. What would you like to know?",
    timestamp: new Date().toISOString(),
  },
]

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return
    setInput('')

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)
    setStreamingText('')

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    })
    const data = await res.json()
    const fullText: string = data.content

    // Simulate streaming
    setLoading(false)
    let i = 0
    const interval = setInterval(() => {
      i += 3
      setStreamingText(fullText.slice(0, i))
      if (i >= fullText.length) {
        clearInterval(interval)
        setStreamingText('')
        const aiMsg: ChatMessage = {
          id: data.id,
          role: 'assistant',
          content: fullText,
          timestamp: data.timestamp,
        }
        setMessages((prev) => [...prev, aiMsg])
      }
    }, 20)
  }

  return (
    <Box sx={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="AI Assistant"
        subtitle="Phase 14/15 — Chat with your pipeline, data, and models using LM Studio"
        badge={<Chip icon={<AutoAwesomeIcon />} label="LM Studio" color="primary" size="small" />}
      />

      {/* Suggestions */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {SUGGESTIONS.map((s) => (
          <Chip key={s} label={s} size="small" variant="outlined" clickable onClick={() => sendMessage(s)} sx={{ cursor: 'pointer' }} />
        ))}
      </Box>

      {/* Messages */}
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          mb: 2,
          bgcolor: 'background.default',
        }}
      >
        {messages.map((msg) => (
          <Box
            key={msg.id}
            sx={{
              display: 'flex',
              gap: 1.5,
              mb: 2,
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: msg.role === 'user' ? 'primary.main' : 'secondary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {msg.role === 'user' ? <PersonIcon sx={{ fontSize: 18, color: 'white' }} /> : <SmartToyIcon sx={{ fontSize: 18, color: 'white' }} />}
            </Box>
            <Box
              sx={{
                maxWidth: '75%',
                p: 1.5,
                borderRadius: 2,
                bgcolor: msg.role === 'user' ? 'primary.main' : 'background.paper',
                border: msg.role === 'assistant' ? '1px solid' : 'none',
                borderColor: 'divider',
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: msg.role === 'user' ? 'white' : 'text.primary',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                }}
              >
                {msg.content}
              </Typography>
              <Typography variant="caption" sx={{ color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : 'text.disabled', display: 'block', mt: 0.25 }}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </Typography>
            </Box>
          </Box>
        ))}

        {/* Streaming indicator */}
        {(loading || streamingText) && (
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: 'secondary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <SmartToyIcon sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Box sx={{ maxWidth: '75%', p: 1.5, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              {loading && !streamingText ? (
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="text.secondary">Thinking…</Typography>
                </Box>
              ) : (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {streamingText}<span style={{ animation: 'blink 1s infinite' }}>▌</span>
                </Typography>
              )}
            </Box>
          </Box>
        )}

        <div ref={bottomRef} />
      </Paper>

      {/* Input */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Ask about your data, models, or pipeline…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          multiline
          maxRows={3}
          disabled={loading}
        />
        <IconButton
          color="primary"
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, '&:disabled': { bgcolor: 'action.disabledBackground' } }}
        >
          <SendIcon />
        </IconButton>
      </Box>

      <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`}</style>
    </Box>
  )
}
