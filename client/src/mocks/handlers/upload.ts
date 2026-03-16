import { http, HttpResponse } from 'msw'
import type { Dataset } from '../../api/types'

const datasets: Dataset[] = [
  { id: 'ds_001', name: 'customer_churn.csv', file_size: 8.4 * 1024 * 1024, row_count: 50000, col_count: 22, created_at: '2024-01-15T10:30:00Z', status: 'ready', target_column: 'churn', task_type: 'classification' },
  { id: 'ds_002', name: 'loan_default.csv', file_size: 12.1 * 1024 * 1024, row_count: 84000, col_count: 31, created_at: '2024-01-14T08:20:00Z', status: 'ready', target_column: 'default', task_type: 'classification' },
  { id: 'ds_003', name: 'house_prices.csv', file_size: 3.2 * 1024 * 1024, row_count: 20000, col_count: 48, created_at: '2024-01-13T14:10:00Z', status: 'ready', target_column: 'price', task_type: 'regression' },
  { id: 'ds_004', name: 'fraud_detection.csv', file_size: 45.6 * 1024 * 1024, row_count: 284807, col_count: 31, created_at: '2024-01-12T09:00:00Z', status: 'processing' },
]

export const uploadHandlers = [
  http.get('/api/datasets', () => {
    return HttpResponse.json({ datasets })
  }),
  http.post('/api/upload', async () => {
    await new Promise((r) => setTimeout(r, 1500))
    const newDs: Dataset = {
      id: `ds_${Date.now()}`,
      name: 'uploaded_dataset.csv',
      file_size: 5 * 1024 * 1024,
      row_count: 25000,
      col_count: 18,
      created_at: new Date().toISOString(),
      status: 'ready',
    }
    return HttpResponse.json(newDs, { status: 201 })
  }),
]
