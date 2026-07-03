import { db } from './firebase';
import { collection, getDocs, getDoc, doc, query, where, setDoc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';

export const api = {
  getPages: async () => {
    const snap = await getDocs(collection(db, 'pages'));
    const pages = snap.docs.map(doc => doc.data());
    // Sort pages by their numeric id if possible
    return pages.sort((a, b) => parseInt(a.id) - parseInt(b.id));
  },
  
  uploadImage: async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result); // base64 data URL
      reader.onerror = (e) => reject(new Error('Dosya okunamadı'));
      reader.readAsDataURL(file);
    });
  },
  
  getPage: async (id) => {
    const snap = await getDoc(doc(db, 'pages', id.toString()));
    return snap.exists() ? snap.data() : null;
  },
  
  createPage: async (data) => {
    if (!data.id) data.id = Date.now().toString();
    await setDoc(doc(db, 'pages', data.id.toString()), data);
    return data;
  },
  
  updatePageSequence: async (pageId, sequence) => {
    const ref = doc(db, 'pages', pageId.toString());
    await updateDoc(ref, { readingSequence: sequence });
    return { success: true };
  },

  deletePage: async (pageId) => {
    const idStr = pageId.toString();
    // 1. Sayfaya ait tüm ana alanları bul
    const mainAreas = await api.getMainAreas(pageId);
    // 2. Her ana alanın yavru alanlarını ve kendisini sil
    for (const main of mainAreas) {
      const children = await api.getChildAreas(main.id);
      for (const child of children) {
        await deleteDoc(doc(db, 'childAreas', child.id.toString()));
      }
      await deleteDoc(doc(db, 'mainAreas', main.id.toString()));
    }
    // 3. Sayfayı sil
    await deleteDoc(doc(db, 'pages', idStr));
    return { success: true };
  },

  renamePage: async (oldId, newId) => {
    const oldStr = oldId.toString();
    const newStr = newId.toString();

    // 1. Hedef numara dolu mu?
    const existing = await api.getPage(newStr);
    if (existing) {
      // Dolu — taslak slotuna taşı
      const allPages = await api.getPages();
      let draftNum = 1;
      while (allPages.find(p => p.id === `taslak-${draftNum}`)) draftNum++;
      const draftId = `taslak-${draftNum}`;

      // Çakışan sayfayı taslak slotuna kopyala
      await setDoc(doc(db, 'pages', draftId), { ...existing, id: draftId });
      // Çakışan sayfanın ana alanlarının pageId'sini güncelle
      const conflictMains = await api.getMainAreas(newStr);
      for (const m of conflictMains) {
        await updateDoc(doc(db, 'mainAreas', m.id.toString()), { pageId: draftId });
      }
      // Eski çakışan sayfayı sil
      await deleteDoc(doc(db, 'pages', newStr));
    }

    // 2. Mevcut sayfayı yeni ID ile kopyala
    const currentPage = await api.getPage(oldStr);
    await setDoc(doc(db, 'pages', newStr), { ...currentPage, id: newStr });

    // 3. Mevcut sayfanın ana alanlarının pageId'sini güncelle
    const mains = await api.getMainAreas(oldStr);
    for (const m of mains) {
      await updateDoc(doc(db, 'mainAreas', m.id.toString()), { pageId: Number(newStr) || newStr });
    }

    // 4. Eski sayfayı sil
    await deleteDoc(doc(db, 'pages', oldStr));

    return { newId: newStr };
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
    if (!data.id) data.id = Date.now().toString();
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
    if (!data.id) data.id = Date.now().toString() + Math.floor(Math.random() * 1000);
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
  },

  // ── GERÇEk ZAMANLI DİNLEYİCİLER (onSnapshot) ──────────────────────────
  // Kullanım: const unsub = api.subscribeToMainAreas(pageId, (areas) => setMainAreas(areas))
  // Bileşen unmount olunca: unsub() çağır!

  subscribeToMainAreas: (pageId, callback) => {
    const q1 = query(collection(db, 'mainAreas'), where('pageId', '==', Number(pageId)));
    const q2 = query(collection(db, 'mainAreas'), where('pageId', '==', String(pageId)));

    const results = new Map();

    const handleSnapshot = () => {
      callback(Array.from(results.values()));
    };

    const unsub1 = onSnapshot(q1, (snap) => {
      snap.docs.forEach(d => results.set(d.id, d.data()));
      snap.docChanges().forEach(change => {
        if (change.type === 'removed') results.delete(change.doc.id);
      });
      handleSnapshot();
    });

    const unsub2 = onSnapshot(q2, (snap) => {
      snap.docs.forEach(d => results.set(d.id, d.data()));
      snap.docChanges().forEach(change => {
        if (change.type === 'removed') results.delete(change.doc.id);
      });
      handleSnapshot();
    });

    // Her iki dinleyiciyi de durduran fonksiyon döndür
    return () => { unsub1(); unsub2(); };
  },

  subscribeToChildAreasForPage: (pageId, callback) => {
    // Önce mainArea id'lerini al, sonra her birinin childArea'larını dinle
    const q1 = query(collection(db, 'mainAreas'), where('pageId', '==', Number(pageId)));
    const q2 = query(collection(db, 'mainAreas'), where('pageId', '==', String(pageId)));

    const mainAreaMap = new Map();     // mainAreaId -> true
    const childMap = new Map();        // childId -> childData
    const childUnsubMap = new Map();   // mainAreaId -> unsub fn

    const emitChildren = () => callback(Array.from(childMap.values()));

    const watchChildren = (mainAreaId) => {
      if (childUnsubMap.has(mainAreaId)) return;
      const cq = query(collection(db, 'childAreas'), where('mainAreaId', '==', mainAreaId));
      const unsub = onSnapshot(cq, (snap) => {
        snap.docs.forEach(d => childMap.set(d.id, d.data()));
        snap.docChanges().forEach(change => {
          if (change.type === 'removed') childMap.delete(change.doc.id);
        });
        emitChildren();
      });
      childUnsubMap.set(mainAreaId, unsub);
    };

    const handleMainSnap = (snap) => {
      snap.docs.forEach(d => {
        const area = d.data();
        mainAreaMap.set(d.id, true);
        watchChildren(area.id);
      });
      snap.docChanges().forEach(change => {
        if (change.type === 'removed') {
          const unsub = childUnsubMap.get(change.doc.id);
          if (unsub) { unsub(); childUnsubMap.delete(change.doc.id); }
          mainAreaMap.delete(change.doc.id);
        }
      });
    };

    const unsub1 = onSnapshot(q1, handleMainSnap);
    const unsub2 = onSnapshot(q2, handleMainSnap);

    return () => {
      unsub1(); unsub2();
      childUnsubMap.forEach(fn => fn());
    };
  }
};
