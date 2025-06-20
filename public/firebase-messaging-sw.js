importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js")
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js")

firebase.initializeApp({
  apiKey: "AIzaSyAB5TldoIqRS_WfUlF7JYfVnzXi3i96dmw",
  authDomain: "medibot-457514.firebaseapp.com",
  projectId: "medibot-457514",
  storageBucket: "medibot-457514.firebasestorage.app",
  messagingSenderId: "806828516267",
  appId: "1:806828516267:web:a75aad403f3dfbc67da8ee",
  measurementId: "G-4S6ZN10CRC",
})

const messaging = firebase.messaging()