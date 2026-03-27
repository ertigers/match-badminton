import BaaS from 'minapp-sdk'

const clientId = import.meta.env.VITE_MINAPP_CLIENT_ID

const ensureConfig = () => {
  if (!clientId) {
    throw new Error(
      'Missing VITE_MINAPP_CLIENT_ID. Please set it in .env.local with your 知晓云 ClientID.'
    )
  }
}

const init = () => {
  ensureConfig()
  BaaS.init(clientId)
}

init()

export { BaaS }
