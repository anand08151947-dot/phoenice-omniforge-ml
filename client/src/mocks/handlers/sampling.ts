import { http, HttpResponse } from 'msw'
import type { ImbalanceReport, SamplingConfig } from '../../api/types'

const mockImbalance: ImbalanceReport = {
  dataset_id: 'ds_001',
  target_column: 'churn',
  imbalance_ratio: 19.0,
  recommended_strategy: 'oversample_smote',
  class_distribution: [
    { label: 'Not Churned (0)', count: 47500, pct: 0.95 },
    { label: 'Churned (1)', count: 2500, pct: 0.05 },
  ],
}

const defaultConfig: SamplingConfig = {
  strategy: 'oversample_smote',
  target_ratio: 0.3,
  random_seed: 42,
  test_size: 0.2,
  val_size: 0.1,
}

export const samplingHandlers = [
  http.get('/api/sampling', () => HttpResponse.json({ imbalance: mockImbalance, config: defaultConfig })),
  http.post('/api/sampling/apply', async () => {
    await new Promise((r) => setTimeout(r, 1500))
    return HttpResponse.json({
      status: 'applied',
      rows_before: 50000,
      rows_after: 61500,
      distribution_after: [
        { label: 'Not Churned (0)', count: 47500, pct: 0.77 },
        { label: 'Churned (1)', count: 14000, pct: 0.23 },
      ],
    })
  }),
]
