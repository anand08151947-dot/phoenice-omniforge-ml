import { uploadHandlers } from './upload'
import { piiHandlers } from './pii'
import { profileHandlers } from './profile'
import { edaHandlers } from './eda'
import { cleaningHandlers } from './cleaning'
import { samplingHandlers } from './sampling'
import { featuresHandlers } from './features'
import { selectionHandlers } from './selection'
import { trainingHandlers } from './training'
import { evaluationHandlers } from './evaluation'
import { explainHandlers } from './explain'
import { deployHandlers } from './deploy'
import { chatHandlers } from './chat'

export const handlers = [
  ...uploadHandlers,
  ...piiHandlers,
  ...profileHandlers,
  ...edaHandlers,
  ...cleaningHandlers,
  ...samplingHandlers,
  ...featuresHandlers,
  ...selectionHandlers,
  ...trainingHandlers,
  ...evaluationHandlers,
  ...explainHandlers,
  ...deployHandlers,
  ...chatHandlers,
]
