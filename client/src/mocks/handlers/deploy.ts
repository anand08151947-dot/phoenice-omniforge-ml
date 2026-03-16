import { http, HttpResponse } from 'msw'
import type { MonitoringMetrics } from '../../api/types'

const now = Date.now()

const mockMonitoring: MonitoringMetrics = {
  deployment_id: 'dep_001',
  timestamp: new Date().toISOString(),
  p50_latency_ms: 24,
  p95_latency_ms: 87,
  p99_latency_ms: 142,
  requests_per_min: 324,
  error_rate: 0.002,
  drift_metrics: [
    { feature: 'credit_score', psi: 0.08, ks_statistic: 0.12, status: 'stable' },
    { feature: 'income', psi: 0.21, ks_statistic: 0.31, status: 'warning' },
    { feature: 'age', psi: 0.04, ks_statistic: 0.07, status: 'stable' },
    { feature: 'balance', psi: 0.45, ks_statistic: 0.52, status: 'drift' },
    { feature: 'num_products', psi: 0.02, ks_statistic: 0.03, status: 'stable' },
  ],
  prediction_volume: Array.from({ length: 24 }, (_, i) => ({
    timestamp: new Date(now - (23 - i) * 3600 * 1000).toISOString(),
    count: Math.floor(280 + Math.random() * 100),
  })),
}

export const deployHandlers = [
  http.get('/api/deploy/monitoring', () => HttpResponse.json(mockMonitoring)),
  http.post('/api/deploy', async () => {
    await new Promise((r) => setTimeout(r, 2000))
    return HttpResponse.json({
      deployment_id: 'dep_001',
      endpoint_url: 'https://api.omniforge.ai/v1/models/lgbm-churn/predict',
      status: 'active',
    })
  }),
]
