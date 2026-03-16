import { http, HttpResponse } from 'msw'
import type { PIIReport } from '../../api/types'

const mockPII: PIIReport = {
  dataset_id: 'ds_001',
  scanned_at: new Date().toISOString(),
  total_columns: 22,
  risk_score: 72,
  pii_columns: [
    { column: 'customer_email', entity_type: 'EMAIL', sensitivity: 'high', sample_values: ['j***@ex***.com', 'a***@gm***.com'], match_count: 49800, match_pct: 0.996, recommended_action: 'mask', status: 'pending' },
    { column: 'phone_number', entity_type: 'PHONE', sensitivity: 'high', sample_values: ['+1-555-***-1234', '+1-555-***-5678'], match_count: 48200, match_pct: 0.964, recommended_action: 'hash', status: 'pending' },
    { column: 'ssn', entity_type: 'SSN', sensitivity: 'high', sample_values: ['***-**-1234', '***-**-5678'], match_count: 31500, match_pct: 0.630, recommended_action: 'drop', status: 'pending' },
    { column: 'full_name', entity_type: 'NAME', sensitivity: 'medium', sample_values: ['J*** D**', 'M*** S***'], match_count: 50000, match_pct: 1.0, recommended_action: 'pseudonymize', status: 'pending' },
    { column: 'home_address', entity_type: 'ADDRESS', sensitivity: 'medium', sample_values: ['1** M*** St, NY', '4** O** Ave, CA'], match_count: 44200, match_pct: 0.884, recommended_action: 'mask', status: 'masked' },
    { column: 'date_of_birth', entity_type: 'DATE_OF_BIRTH', sensitivity: 'medium', sample_values: ['19**-**-**', '19**-**-**'], match_count: 50000, match_pct: 1.0, recommended_action: 'mask', status: 'masked' },
    { column: 'ip_address', entity_type: 'IP_ADDRESS', sensitivity: 'low', sample_values: ['192.168.*.*', '10.0.*.*'], match_count: 38000, match_pct: 0.76, recommended_action: 'mask', status: 'approved' },
    { column: 'iban', entity_type: 'IBAN', sensitivity: 'high', sample_values: ['DE89****3702****0485', 'GB29****6001****5699'], match_count: 22000, match_pct: 0.44, recommended_action: 'encrypt', status: 'pending' },
  ],
}

export const piiHandlers = [
  http.get('/api/pii', () => {
    return HttpResponse.json(mockPII)
  }),
  http.post('/api/pii/apply', async () => {
    await new Promise((r) => setTimeout(r, 800))
    return HttpResponse.json({ status: 'applied', masked_columns: 3 })
  }),
]
