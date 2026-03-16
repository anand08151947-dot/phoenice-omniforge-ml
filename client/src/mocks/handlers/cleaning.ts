import { http, HttpResponse } from 'msw'
import type { CleaningPlan } from '../../api/types'

const mockPlan: CleaningPlan = {
  dataset_id: 'ds_001',
  estimated_rows_affected: 22134,
  estimated_cols_removed: 1,
  actions: [
    { id: 'c1', column: 'credit_score', issue_type: 'missing_values', issue_detail: '38% missing values', severity: 'high', strategy: 'median_impute', affected_rows: 19000, estimated_impact: 'Fills 19,000 rows with median value (651)' },
    { id: 'c2', column: 'income', issue_type: 'missing_values', issue_detail: '5% missing values', severity: 'medium', strategy: 'mean_impute', affected_rows: 2500, estimated_impact: 'Fills 2,500 rows with mean ($58,400)' },
    { id: 'c3', column: 'age', issue_type: 'missing_values', issue_detail: '2% missing values', severity: 'low', strategy: 'median_impute', affected_rows: 1000, estimated_impact: 'Fills 1,000 rows with median (42)' },
    { id: 'c4', column: 'income', issue_type: 'outliers', issue_detail: '312 extreme outliers (>3σ)', severity: 'medium', strategy: 'clip_outliers', affected_rows: 312, estimated_impact: 'Clips values to [0, 200000] range' },
    { id: 'c5', column: 'approval_date', issue_type: 'leakage', issue_detail: 'Potential target leakage', severity: 'high', strategy: 'drop_column', affected_rows: 0, estimated_impact: 'Removes column to prevent data leakage' },
    { id: 'c6', column: '*', issue_type: 'duplicates', issue_detail: '134 duplicate rows', severity: 'low', strategy: 'drop_rows', affected_rows: 134, estimated_impact: 'Removes 134 exact duplicate rows' },
    { id: 'c7', column: 'estimated_salary', issue_type: 'missing_values', issue_detail: '2% missing values', severity: 'low', strategy: 'median_impute', affected_rows: 1000, estimated_impact: 'Fills 1,000 rows with median ($100,000)' },
  ],
}

export const cleaningHandlers = [
  http.get('/api/cleaning', () => HttpResponse.json(mockPlan)),
  http.post('/api/cleaning/apply', async () => {
    await new Promise((r) => setTimeout(r, 2000))
    return HttpResponse.json({ status: 'applied', rows_after: 49866, cols_after: 21 })
  }),
]
