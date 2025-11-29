function openApp() {
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.expand();
    }

    alert("Mini App Opened! Replace this with real features.");
}
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAnUvU6tCpnO9oD4wdXbLS1o7jWpQuNPzE",
  authDomain: "army-6b712.firebaseapp.com",
  projectId: "army-6b712",
  storageBucket: "army-6b712.firebasestorage.app",
  messagingSenderId: "468802966776",
  appId: "1:468802966776:web:57cc6f23da92b6f3f7d70d",
  measurementId: "G-HLGJB2NRRP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);