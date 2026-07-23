/* Firebase's compatibility build keeps this worker usable as a static public asset. */
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDnqO4c2vnixg6Ro-uSweUPApuqHwCkock",
  authDomain: "scan-krwalo.firebaseapp.com",
  projectId: "scan-krwalo",
  storageBucket: "scan-krwalo.firebasestorage.app",
  messagingSenderId: "1065867821388",
  appId: "1:1065867821388:web:4e42216c8d56844a36cfe9"
});

firebase.messaging();
