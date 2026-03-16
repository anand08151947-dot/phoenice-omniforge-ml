import { useQuery } from '@tanstack/react-query'
import type { DatasetProfile } from '../api/types'

export function useDataset(datasetId: string | null) {
  return useQuery<DatasetProfile>({
    queryKey: ['profile', datasetId],
    queryFn: async () => {
      const res = await fetch(`/api/profile?dataset_id=${datasetId}`)
      if (!res.ok) throw new Error('Failed to fetch dataset profile')
      return res.json()
    },
    enabled: !!datasetId,
    staleTime: 5 * 60 * 1000,
  })
}
