import { 
  getFirebaseDb, 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  writeBatch,
  runTransaction
} from '../firebase';

// Default Localities
const DEFAULT_LOCALITIES = [
  { id: 'rawson', name: 'Rawson', code: 'A' },
  { id: 'trelew', name: 'Trelew', code: 'B' },
  { id: 'madryn', name: 'Puerto Madryn', code: 'C' },
  { id: 'cholila', name: 'Cholila', code: 'D' },
  { id: 'jaco', name: 'Jaco', code: 'E' },
  { id: 'menucos', name: 'Menucos', code: 'F' },
  { id: 'trevelin', name: 'Trevelin', code: 'G' }
];

// Local Storage keys
const KEYS = {
  LOCALITIES: 'optica_localidades',
  CAMPAIGNS: 'optica_campanas',
  JOBS: 'optica_trabajos'
};

// In-memory listeners for LocalStorage fallback
const listeners = {
  campaigns: [],
  jobs: {} // key is campanaId
};

// --- Local Storage Helpers ---
const getLocalData = (key, defaultVal = []) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultVal;
};

const setLocalData = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

const notifyCampaignListeners = () => {
  const data = getLocalData(KEYS.CAMPAIGNS);
  // sort by createdAt desc
  data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  listeners.campaigns.forEach(cb => cb(data));
};

const notifyJobListeners = (campanaId) => {
  const allJobs = getLocalData(KEYS.JOBS);
  const filtered = allJobs.filter(j => j.campanaId === campanaId);
  filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (listeners.jobs[campanaId]) {
    listeners.jobs[campanaId].forEach(cb => cb(filtered));
  }
};


// --- LOCALIDADES ---
export const getLocalidades = async () => {
  const db = getFirebaseDb();
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'localidades'));
      if (snap.empty) {
        // Initialize default localities in Firebase if empty
        const batch = [];
        DEFAULT_LOCALITIES.forEach(loc => {
          batch.push(setDoc(doc(db, 'localidades', loc.id), loc));
        });
        await Promise.all(batch);
        return DEFAULT_LOCALITIES;
      }
      const list = [];
      snap.forEach(doc => list.push(doc.data()));
      // sort alphabetically
      list.sort((a, b) => a.name.localeCompare(b.name));
      return list;
    } catch (e) {
      console.error("Error fetching localities from Firebase, falling back to local:", e);
    }
  }
  
  // Local Fallback
  let localLocs = getLocalData(KEYS.LOCALITIES, null);
  if (!localLocs) {
    setLocalData(KEYS.LOCALITIES, DEFAULT_LOCALITIES);
    localLocs = DEFAULT_LOCALITIES;
  }
  return localLocs.sort((a, b) => a.name.localeCompare(b.name));
};

export const saveLocalidad = async (localidad) => {
  const db = getFirebaseDb();
  
  // Generate a code if not present (next letter in alphabet)
  if (!localidad.code) {
    const currentList = await getLocalidades();
    const usedCodes = new Set(currentList.map(l => l.code.toUpperCase()));
    let code = 'A';
    for (let i = 0; i < 26; i++) {
      const char = String.fromCharCode(65 + i); // A-Z
      if (!usedCodes.has(char)) {
        code = char;
        break;
      }
    }
    // If all A-Z used, fallback to AA, AB etc
    if (usedCodes.has(code)) {
      code = 'Z' + (currentList.length - 25);
    }
    localidad.code = code;
  }

  // Generate ID if not present
  if (!localidad.id) {
    localidad.id = localidad.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
  }

  if (db) {
    await setDoc(doc(db, 'localidades', localidad.id), localidad);
    return localidad;
  }

  const localLocs = await getLocalidades();
  if (!localLocs.some(l => l.id === localidad.id)) {
    localLocs.push(localidad);
    setLocalData(KEYS.LOCALITIES, localLocs);
  }
  return localidad;
};


// --- CAMPAÑAS (Subscription Based) ---
export const subscribeCampanas = (onData) => {
  const db = getFirebaseDb();
  if (db) {
    const q = query(collection(db, 'campanas'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      onData(list);
    }, (error) => {
      console.error("Firebase campaign subscription error:", error);
      // Fallback
      onData(getLocalData(KEYS.CAMPAIGNS).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    });
  }

  // Local Storage Subscription
  listeners.campaigns.push(onData);
  // Initial call
  notifyCampaignListeners();

  // Return unsubscribe function
  return () => {
    listeners.campaigns = listeners.campaigns.filter(cb => cb !== onData);
  };
};

export const saveCampana = async (campana) => {
  const db = getFirebaseDb();
  
  if (!campana.createdAt) {
    campana.createdAt = new Date().toISOString();
  }
  if (!campana.status) {
    campana.status = 'activa';
  }

  if (db) {
    if (campana.id) {
      const ref = doc(db, 'campanas', campana.id);
      await updateDoc(ref, campana);
      return campana.id;
    } else {
      const ref = await addDoc(collection(db, 'campanas'), campana);
      return ref.id;
    }
  }

  // Local Storage
  const list = getLocalData(KEYS.CAMPAIGNS);
  if (campana.id) {
    const idx = list.findIndex(c => c.id === campana.id);
    if (idx !== -1) {
      list[idx] = campana;
    }
  } else {
    campana.id = 'camp_' + Date.now();
    list.push(campana);
  }
  setLocalData(KEYS.CAMPAIGNS, list);
  notifyCampaignListeners();
  return campana.id;
};


// --- TRABAJOS (Subscription Based) ---
export const subscribeTrabajos = (campanaId, onData) => {
  if (!campanaId) return () => {};
  
  const db = getFirebaseDb();
  if (db) {
    const q = query(
      collection(db, 'trabajos'), 
      where('campanaId', '==', campanaId)
    );
    return onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort in JS by createdAt asc
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      onData(list);
    }, (error) => {
      console.error("Firebase jobs subscription error:", error);
      // Fallback
      notifyJobListeners(campanaId);
    });
  }

  // Local Storage Subscription
  if (!listeners.jobs[campanaId]) {
    listeners.jobs[campanaId] = [];
  }
  listeners.jobs[campanaId].push(onData);
  // Initial call
  notifyJobListeners(campanaId);

  // Return unsubscribe function
  return () => {
    if (listeners.jobs[campanaId]) {
      listeners.jobs[campanaId] = listeners.jobs[campanaId].filter(cb => cb !== onData);
    }
  };
};

// Helper to generate the next reference code for a locality in a campaign
export const getNextRefCode = async (campanaId, localidadId, localidadCode) => {
  const db = getFirebaseDb();
  let maxSeq = 0;

  if (db) {
    const q = query(
      collection(db, 'trabajos'),
      where('campanaId', '==', campanaId),
      where('localidadId', '==', localidadId)
    );
    const snap = await getDocs(q);
    snap.forEach(doc => {
      const seq = doc.data().sequence || 0;
      if (seq > maxSeq) maxSeq = seq;
    });
  } else {
    const allJobs = getLocalData(KEYS.JOBS);
    const filtered = allJobs.filter(j => j.campanaId === campanaId && j.localidadId === localidadId);
    filtered.forEach(j => {
      const seq = j.sequence || 0;
      if (seq > maxSeq) maxSeq = seq;
    });
  }

  const nextSeq = maxSeq + 1;
  return {
    sequence: nextSeq,
    refCode: `${nextSeq}${localidadCode}`
  };
};

const getMaxSequenceFromDb = async (db, campanaId, localidadId) => {
  try {
    const q = query(
      collection(db, 'trabajos'),
      where('campanaId', '==', campanaId),
      where('localidadId', '==', localidadId)
    );
    const snap = await getDocs(q);
    let max = 0;
    snap.forEach(doc => {
      const seq = doc.data().sequence || 0;
      if (seq > max) max = seq;
    });
    return max;
  } catch (e) {
    console.error("Error getting max sequence from DB:", e);
    return 0;
  }
};

export const saveTrabajo = async (trabajo) => {
  const db = getFirebaseDb();
  
  if (!trabajo.createdAt) {
    trabajo.createdAt = new Date().toISOString();
  }
  if (!trabajo.estado) {
    trabajo.estado = 'Pedido Lab'; // default state
  }

  if (db) {
    if (trabajo.id) {
      // Modificar trabajo existente (no altera el secuenciador)
      const ref = doc(db, 'trabajos', trabajo.id);
      const { id, ...data } = trabajo;
      await updateDoc(ref, data);
      return trabajo.id;
    } else {
      // Crear trabajo nuevo con Transacción Atómica para evitar duplicados concurrentes
      const seqRef = doc(db, 'secuencias', `${trabajo.campanaId}_${trabajo.localidadId}`);
      
      try {
        const savedId = await runTransaction(db, async (transaction) => {
          const seqDoc = await transaction.get(seqRef);
          let seq = 1;
          if (seqDoc.exists()) {
            seq = seqDoc.data().sequence + 1;
          } else {
            const maxFromJobs = await getMaxSequenceFromDb(db, trabajo.campanaId, trabajo.localidadId);
            seq = maxFromJobs + 1;
          }
          
          // Actualizar el contador atómico
          transaction.set(seqRef, { sequence: seq });
          
          // Asignar la secuencia final locked-in
          const locCode = trabajo.refCode.replace(/[0-9]/g, '');
          trabajo.sequence = seq;
          trabajo.refCode = `${seq}${locCode}`;
          
          // Guardar el documento del trabajo dentro de la misma transacción
          const jobRef = doc(collection(db, 'trabajos'));
          trabajo.id = jobRef.id;
          transaction.set(jobRef, trabajo);
          
          return trabajo.id;
        });
        return savedId;
      } catch (err) {
        console.error("Error en la transacción, intentando guardado directo:", err);
        // Fallback de seguridad en caso de error
        const ref = await addDoc(collection(db, 'trabajos'), trabajo);
        return ref.id;
      }
    }
  }

  // Local Storage (Carga local sin concurrencia de red)
  const list = getLocalData(KEYS.JOBS);
  if (trabajo.id) {
    const idx = list.findIndex(t => t.id === trabajo.id);
    if (idx !== -1) {
      list[idx] = trabajo;
    }
  } else {
    // Recalcular secuencia máxima al momento exacto de guardar para evitar desalineación
    const filtered = list.filter(j => j.campanaId === trabajo.campanaId && j.localidadId === trabajo.localidadId);
    let maxSeq = 0;
    filtered.forEach(j => {
      const seq = j.sequence || 0;
      if (seq > maxSeq) maxSeq = seq;
    });
    const nextSeq = maxSeq + 1;
    const locCode = trabajo.refCode.replace(/[0-9]/g, '');
    
    trabajo.sequence = nextSeq;
    trabajo.refCode = `${nextSeq}${locCode}`;
    trabajo.id = 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    list.push(trabajo);
  }
  setLocalData(KEYS.JOBS, list);
  notifyJobListeners(trabajo.campanaId);
  return trabajo.id;
};


export const deleteTrabajo = async (trabajoId, campanaId) => {
  const db = getFirebaseDb();

  if (db) {
    await deleteDoc(doc(db, 'trabajos', trabajoId));
    return;
  }

  const list = getLocalData(KEYS.JOBS);
  const filtered = list.filter(t => t.id !== trabajoId);
  setLocalData(KEYS.JOBS, filtered);
  notifyJobListeners(campanaId);
};


// --- SYNC LOCAL STORAGE TO FIREBASE ---
// This moves all local data to Firebase once the database is configured.
export const syncLocalToFirebase = async (firebaseDbInstance) => {
  if (!firebaseDbInstance) return;

  const localLocs = getLocalData(KEYS.LOCALITIES, []);
  const localCampanas = getLocalData(KEYS.CAMPAIGNS, []);
  const localJobs = getLocalData(KEYS.JOBS, []);

  // 1. Sync Localities
  for (const loc of localLocs) {
    await setDoc(doc(firebaseDbInstance, 'localidades', loc.id), loc);
  }

  // 2. Sync Campaigns
  for (const camp of localCampanas) {
    await setDoc(doc(firebaseDbInstance, 'campanas', camp.id), {
      name: camp.name,
      createdAt: camp.createdAt,
      status: camp.status
    });
  }

  // 3. Sync Jobs
  for (const job of localJobs) {
    await setDoc(doc(firebaseDbInstance, 'trabajos', job.id), {
      campanaId: job.campanaId,
      localidadId: job.localidadId,
      refCode: job.refCode,
      sequence: job.sequence,
      paciente: job.paciente || '',
      cristalOD: job.cristalOD || null,
      cristalOI: job.cristalOI || null,
      calibradoTipo: job.calibradoTipo || 'Aro Completo',
      calibradoPrecio: job.calibradoPrecio || 0,
      calibradoNombre: job.calibradoNombre || '',
      precioTotal: job.precioTotal || 0,
      nroPedidoLab: job.nroPedidoLab || '',
      estado: job.estado || 'Pedido Lab',
      createdAt: job.createdAt
    });
  }

  // Clear local keys to avoid redundant data
  localStorage.removeItem(KEYS.CAMPAIGNS);
  localStorage.removeItem(KEYS.JOBS);
};

export const resetAllData = async () => {
  const db = getFirebaseDb();
  if (db) {
    try {
      const campSnap = await getDocs(collection(db, 'campanas'));
      const jobSnap = await getDocs(collection(db, 'trabajos'));
      
      const promises = [];
      campSnap.forEach(d => {
        promises.push(deleteDoc(doc(db, 'campanas', d.id)));
      });
      jobSnap.forEach(d => {
        promises.push(deleteDoc(doc(db, 'trabajos', d.id)));
      });
      
      await Promise.all(promises);
    } catch (e) {
      console.error("Error clearing Firebase database:", e);
    }
  }

  localStorage.removeItem(KEYS.CAMPAIGNS);
  localStorage.removeItem(KEYS.JOBS);
  localStorage.removeItem('optica_active_campaign_id');
  localStorage.removeItem('optica_last_localidad_id');
};

