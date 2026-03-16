import { http, HttpResponse } from 'msw'
import type { DatasetProfile } from '../../api/types'

const mockProfile: DatasetProfile = {
  dataset_id: 'ds_001',
  row_count: 50000,
  col_count: 22,
  duplicate_rows: 134,
  missing_cells: 8920,
  missing_pct: 0.081,
  memory_usage_mb: 8.4,
  generated_at: new Date().toISOString(),
  columns: [
    {
      name: 'customer_id', dtype: 'object', inferred_type: 'categorical',
      missing_pct: 0, unique_count: 50000, top_values: [{ value: 'C001', count: 1 }],
    },
    {
      name: 'age', dtype: 'float64', inferred_type: 'numeric',
      missing_pct: 0.02, unique_count: 78, mean: 42.3, std: 14.1, min: 18, max: 89,
      skewness: 0.32, kurtosis: -0.14,
      histogram: [
        { bin: '18-28', count: 5400 }, { bin: '28-38', count: 9200 },
        { bin: '38-48', count: 12300 }, { bin: '48-58', count: 11100 },
        { bin: '58-68', count: 8200 }, { bin: '68-78', count: 2900 },
        { bin: '78-89', count: 900 },
      ],
    },
    {
      name: 'credit_score', dtype: 'float64', inferred_type: 'numeric',
      missing_pct: 0.38, unique_count: 612, mean: 651.4, std: 97.2, min: 300, max: 850,
      skewness: -0.21, kurtosis: 0.08,
      histogram: [
        { bin: '300-400', count: 1200 }, { bin: '400-500', count: 3400 },
        { bin: '500-600', count: 8900 }, { bin: '600-700', count: 14200 },
        { bin: '700-800', count: 12100 }, { bin: '800-850', count: 4800 },
      ],
      warnings: ['38% missing values – key predictive feature'],
    },
    {
      name: 'income', dtype: 'float64', inferred_type: 'numeric',
      missing_pct: 0.05, unique_count: 28340, mean: 58400, std: 32100, min: 12000, max: 480000,
      skewness: 2.1, kurtosis: 8.4,
      histogram: [
        { bin: '0-50k', count: 22000 }, { bin: '50-100k', count: 18000 },
        { bin: '100-150k', count: 6000 }, { bin: '150-200k', count: 2500 },
        { bin: '200k+', count: 1500 },
      ],
    },
    {
      name: 'salary', dtype: 'float64', inferred_type: 'numeric',
      missing_pct: 0.04, unique_count: 27200, mean: 57100, std: 31800, min: 11000, max: 475000,
      skewness: 2.0, kurtosis: 8.1,
      warnings: ['High correlation with income (r=0.99)'],
    },
    {
      name: 'num_products', dtype: 'int64', inferred_type: 'numeric',
      missing_pct: 0, unique_count: 4, mean: 1.53, std: 0.58, min: 1, max: 4,
      skewness: 0.98, top_values: [{ value: 1, count: 24500 }, { value: 2, count: 19000 }, { value: 3, count: 5000 }, { value: 4, count: 1500 }],
    },
    {
      name: 'tenure_months', dtype: 'int64', inferred_type: 'numeric',
      missing_pct: 0, unique_count: 120, mean: 60.2, std: 34.8, min: 1, max: 120,
      skewness: 0.01,
    },
    {
      name: 'balance', dtype: 'float64', inferred_type: 'numeric',
      missing_pct: 0, unique_count: 49856, mean: 76485.9, std: 62397.1, min: 0, max: 250898.1,
      skewness: 0.09,
    },
    {
      name: 'approval_date', dtype: 'object', inferred_type: 'datetime',
      missing_pct: 0.01, unique_count: 3652,
      warnings: ['Potential target leakage – corr=0.97 with target'],
    },
    {
      name: 'country', dtype: 'object', inferred_type: 'categorical',
      missing_pct: 0, unique_count: 3,
      top_values: [{ value: 'France', count: 25000 }, { value: 'Germany', count: 15000 }, { value: 'Spain', count: 10000 }],
    },
    {
      name: 'gender', dtype: 'object', inferred_type: 'categorical',
      missing_pct: 0, unique_count: 2,
      top_values: [{ value: 'Male', count: 26000 }, { value: 'Female', count: 24000 }],
    },
    {
      name: 'is_active_member', dtype: 'int64', inferred_type: 'boolean',
      missing_pct: 0, unique_count: 2,
      top_values: [{ value: 1, count: 29000 }, { value: 0, count: 21000 }],
    },
    {
      name: 'has_credit_card', dtype: 'int64', inferred_type: 'boolean',
      missing_pct: 0, unique_count: 2,
      top_values: [{ value: 1, count: 35000 }, { value: 0, count: 15000 }],
    },
    {
      name: 'estimated_salary', dtype: 'float64', inferred_type: 'numeric',
      missing_pct: 0.02, unique_count: 48000, mean: 100090, std: 57510, min: 11.58, max: 199992.5,
      skewness: -0.01,
    },
    {
      name: 'churn', dtype: 'int64', inferred_type: 'boolean',
      missing_pct: 0, unique_count: 2,
      top_values: [{ value: 0, count: 47500 }, { value: 1, count: 2500 }],
      is_target: true,
      warnings: ['Severe class imbalance: 95/5 split'],
    },
  ],
}

export const profileHandlers = [
  http.get('/api/profile', () => {
    return HttpResponse.json(mockProfile)
  }),
]
