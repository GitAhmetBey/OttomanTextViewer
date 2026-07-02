import { db } from './firebase';
import { collection, getDocs, getDoc, doc, query, where, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

export const api = {
  getPages: async () => {
    const snap = await getDocs(collection(db, 'pages'));
    const pages = snap.docs.map(doc => doc.data());
    // Sort pages by their numeric id if possible
    return pages.sort((a, b) => parseInt(a.id) - parseInt(b.id));
  },
  
  getPage: async (id) => {
    const snap = await getDoc(doc(db, 'pages', id.toString()));
    return snap.exists() ? snap.data() : null;
  },
  
  getMainAreas: async (pageId) => {
    // pageId can be string or number in db.json, let's query both
    const q1 = query(collection(db, 'mainAreas'), where('pageId', '==', Number(pageId)));
    const q2 = query(collection(db, 'mainAreas'), where('pageId', '==', String(pageId)));
    
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    
    const results = new Map();
    snap1.docs.forEach(d => results.set(d.id, d.data()));
    snap2.docs.forEach(d => results.set(d.id, d.data()));
    return Array.from(results.values());
  },
  
  createMainArea: async (data) => {
    await setDoc(doc(db, 'mainAreas', data.id.toString()), data);
    return data;
  },
  
  deleteMainArea: async (id) => {
    await deleteDoc(doc(db, 'mainAreas', id.toString()));
    return { success: true };
  },

  updateMainArea: async (id, data) => {
    const ref = doc(db, 'mainAreas', id.toString());
    await updateDoc(ref, data);
    const snap = await getDoc(ref);
    return snap.data();
  },
  
  getChildAreas: async (mainAreaId) => {
    const q = query(collection(db, 'childAreas'), where('mainAreaId', '==', mainAreaId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  },
  
  createChildArea: async (data) => {
    await setDoc(doc(db, 'childAreas', data.id.toString()), data);
    return data;
  },
  
  updateChildArea: async (id, data) => {
    const childRef = doc(db, 'childAreas', id.toString());
    await updateDoc(childRef, data);
    const snap = await getDoc(childRef);
    return snap.data();
  },
  
  deleteChildArea: async (id) => {
    await deleteDoc(doc(db, 'childAreas', id.toString()));
    return { success: true };
  },
  
  getAllChildAreasForPage: async (pageId) => {
    const mainAreas = await api.getMainAreas(pageId);
    if (mainAreas.length === 0) return [];
    const promises = mainAreas.map(m => api.getChildAreas(m.id));
    const results = await Promise.all(promises);
    return results.flat();
  }
};
