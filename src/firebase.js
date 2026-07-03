import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAGlo-FDSiT3dVnO5nCmnnfbdamKbAl_yY",
  authDomain: "osmanlicaoku-52162.firebaseapp.com",
  projectId: "osmanlicaoku-52162",
  storageBucket: "osmanlicaoku-52162.firebasestorage.app",
  messagingSenderId: "748544413701",
  appId: "1:748544413701:web:f6802490012f1424ae0c6c",
  measurementId: "G-XFWRR6YH8P"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
// export const analytics = getAnalytics(app);
