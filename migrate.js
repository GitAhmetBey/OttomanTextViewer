import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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
const db = getFirestore(app);

const rawData = fs.readFileSync('db.json', 'utf8');
const data = JSON.parse(rawData);

async function migrate() {
  console.log('Starting migration to Firebase Firestore...');
  
  // Migrate pages
  if (data.pages) {
    console.log(`Migrating ${data.pages.length} pages...`);
    for (const page of data.pages) {
      await setDoc(doc(db, "pages", page.id.toString()), page);
    }
  }

  // Migrate mainAreas
  if (data.mainAreas) {
    console.log(`Migrating ${data.mainAreas.length} mainAreas...`);
    for (const mainArea of data.mainAreas) {
      await setDoc(doc(db, "mainAreas", mainArea.id.toString()), mainArea);
    }
  }

  // Migrate childAreas
  if (data.childAreas) {
    console.log(`Migrating ${data.childAreas.length} childAreas...`);
    for (const childArea of data.childAreas) {
      await setDoc(doc(db, "childAreas", childArea.id.toString()), childArea);
    }
  }

  console.log('Migration completed successfully!');
  process.exit(0);
}

migrate().catch(console.error);
