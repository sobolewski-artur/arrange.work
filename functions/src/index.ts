import { initializeApp } from 'firebase-admin/app'
import { setGlobalOptions } from 'firebase-functions'

// Same region as the App Hosting backend. Create Firestore and Storage nearby too.
setGlobalOptions({ region: 'europe-west4', maxInstances: 10 })

initializeApp()

// Export functions from here, e.g.:
//
// import { onDocumentCreated } from 'firebase-functions/firestore'
// import { logger } from 'firebase-functions'
//
// export const onUserCreated = onDocumentCreated('users/{uid}', (event) => {
//   logger.info('New user document', { uid: event.params.uid })
// })
