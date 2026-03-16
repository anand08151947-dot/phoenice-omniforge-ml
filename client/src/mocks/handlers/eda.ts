import { http, HttpResponse } from 'msw'
import type { EDAReport } from '../../api/types'

const cols = ['age', 'credit_score', 'income', 'salary', 'balance', 'tenure_months', 'num_products', 'estimated_salary']
const n = cols.length
const corrValues = cols.map((_, i) =>
  cols.map((__, j) => {
    if (i === j) return 1
    if ((cols[i] === 'income' && cols[j] === 'salary') || (cols[i] === 'salary' && cols[j] === 'income')) return 0.99
    return Number((Math.random() * 0.6 - 0.3).toFixed(2))
  })
)

const mockEDA: EDAReport = {
  dataset_id: 'ds_001',
  issues: [
    { id: 'i1', severity: 'critical', type: 'class_imbalance', title: 'Severe class imbalance', detail: '95/5 split on target `churn`', phase: 'sampling', metric: 0.05, affected_columns: ['churn'] },
    { id: 'i2', severity: 'high', type: 'missing_values', title: '38% missing values in credit_score', detail: 'Column `credit_score` — key predictive feature', phase: 'cleaning', metric: 0.38, affected_columns: ['credit_score'] },
    { id: 'i3', severity: 'high', type: 'leakage', title: 'Target leakage risk detected', detail: '`approval_date` correlates 0.97 with target', phase: 'features', metric: 0.97, affected_columns: ['approval_date'] },
    { id: 'i4', severity: 'medium', type: 'correlation', title: 'Highly redundant features', detail: '`income` ↔ `salary` (r = 0.99)', phase: 'selection', metric: 0.99, affected_columns: ['income', 'salary'] },
    { id: 'i5', severity: 'medium', type: 'outliers', title: 'Extreme outliers in income', detail: '312 rows exceed 3σ threshold', phase: 'cleaning', metric: 312, affected_columns: ['income'] },
    { id: 'i6', severity: 'low', type: 'duplicates', title: '134 duplicate rows', detail: 'Exact row duplicates found', phase: 'cleaning', metric: 134 },
    { id: 'i7', severity: 'low', type: 'low_variance', title: 'Near-zero variance in is_active_member', detail: 'Feature may not contribute to model', phase: 'selection', metric: 0.58, affected_columns: ['is_active_member'] },
  ],
  missingness: [
    { column: 'credit_score', missing_count: 19000, missing_pct: 0.38, pattern: 'MAR' },
    { column: 'income', missing_count: 2500, missing_pct: 0.05, pattern: 'MCAR' },
    { column: 'age', missing_count: 1000, missing_pct: 0.02, pattern: 'MCAR' },
    { column: 'estimated_salary', missing_count: 1000, missing_pct: 0.02, pattern: 'MCAR' },
    { column: 'approval_date', missing_count: 500, missing_pct: 0.01, pattern: 'MNAR' },
  ],
  correlation_matrix: { columns: cols, values: corrValues },
  target_distribution: [
    { label: 'Not Churned (0)', count: 47500 },
    { label: 'Churned (1)', count: 2500 },
  ],
  mi_scores: [
    { feature: 'credit_score', score: 0.312 },
    { feature: 'age', score: 0.287 },
    { feature: 'balance', score: 0.241 },
    { feature: 'num_products', score: 0.198 },
    { feature: 'tenure_months', score: 0.176 },
    { feature: 'country', score: 0.154 },
    { feature: 'income', score: 0.132 },
    { feature: 'is_active_member', score: 0.118 },
    { feature: 'estimated_salary', score: 0.089 },
    { feature: 'gender', score: 0.042 },
  ],
}

export const edaHandlers = [
  http.get('/api/eda', () => HttpResponse.json(mockEDA)),
  http.get('/api/eda/issues', () => HttpResponse.json({ dataset_id: 'ds_001', issues: mockEDA.issues })),
]
