// Example runtime configuration for Codex Vitae.
//
// Use this file as a reference when populating INLINE_RUNTIME_CONFIG inside
// config.js, or copy the object below into a deployment-generated
// config.runtime.json file.
window.__CODEX_CONFIG__ = {
  firebaseConfig: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
    projectId: "YOUR_FIREBASE_PROJECT_ID",
    storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
    messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
    appId: "YOUR_FIREBASE_APP_ID",
    measurementId: "YOUR_FIREBASE_MEASUREMENT_ID"
  },
  backendUrl: "https://your-backend-endpoint.example.com"
};
