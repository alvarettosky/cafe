import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

// Setup MSW worker for browser environment (E2E tests)
export const worker = setupWorker(...handlers)
