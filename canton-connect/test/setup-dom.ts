import { GlobalRegistrator } from '@happy-dom/global-registrator'

if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
  GlobalRegistrator.register({ url: 'http://localhost/' })
}
