import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDZRm7xREvz1l7baf2SHYFrtU3IDm5kmoE",
  authDomain: "soluciones-opticas.firebaseapp.com",
  projectId: "soluciones-opticas",
  storageBucket: "soluciones-opticas.firebasestorage.app",
  messagingSenderId: "665154982665",
  appId: "1:665154982665:web:ad1915b8336ed56d9ab9d8"
};

async function runBackup() {
  console.log('🔄 Conectando a Firebase (soluciones-opticas) para generar copia de seguridad...');
  const app = initializeApp(FIREBASE_CONFIG);
  const db = getFirestore(app);

  const [campSnap, locSnap, jobSnap, gastoSnap, seqSnap] = await Promise.all([
    getDocs(collection(db, 'campanas')),
    getDocs(collection(db, 'localidades')),
    getDocs(collection(db, 'trabajos')),
    getDocs(collection(db, 'gastos')),
    getDocs(collection(db, 'secuencias'))
  ]);

  const campaigns = [];
  campSnap.forEach(d => campaigns.push({ id: d.id, ...d.data() }));
  campaigns.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const localities = [];
  locSnap.forEach(d => localities.push({ id: d.id, ...d.data() }));
  localities.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const jobs = [];
  jobSnap.forEach(d => jobs.push({ id: d.id, ...d.data() }));

  const gastos = [];
  gastoSnap.forEach(d => gastos.push({ id: d.id, ...d.data() }));

  const secuencias = [];
  seqSnap.forEach(d => secuencias.push({ id: d.id, ...d.data() }));

  // Load price list catalog as well
  let priceList = [];
  const priceListPath = path.join(projectRoot, 'src', 'data', 'lista_de_precios.json');
  if (fs.existsSync(priceListPath)) {
    priceList = JSON.parse(fs.readFileSync(priceListPath, 'utf-8'));
  }

  // Per-campaign summary for quick human inspection
  const resumenPorCampana = campaigns.map(c => {
    const campJobs = jobs.filter(j => j.campanaId === c.id);
    const campGastos = gastos.filter(g => g.campanaId === c.id);
    const totalFacturado = campJobs.reduce((acc, j) => acc + (Number(j.precioTotal) || 0), 0);
    const totalGastos = campGastos.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
    return {
      id: c.id,
      nombre: c.name,
      estado: c.status,
      fechaCreacion: c.createdAt,
      cantidadTrabajos: campJobs.length,
      cantidadGastos: campGastos.length,
      facturacionEstimada: totalFacturado,
      gastosRegistrados: totalGastos
    };
  });

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const backupPayload = {
    app: 'Soluciones Ópticas - Gestión de Planillas (Isa & Jere)',
    exportedAt: now.toISOString(),
    projectId: FIREBASE_CONFIG.projectId,
    counts: {
      campaigns: campaigns.length,
      localities: localities.length,
      jobs: jobs.length,
      gastos: gastos.length,
      secuencias: secuencias.length,
      priceListItems: priceList.length
    },
    resumenPorCampana,
    data: {
      campaigns,
      localities,
      jobs,
      gastos,
      secuencias,
      priceList
    }
  };

  const backupsDir = path.join(projectRoot, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const datedFilePath = path.join(backupsDir, `respaldo_${dateStr}.json`);
  const latestFilePath = path.join(backupsDir, `ultimo_respaldo_actual.json`);

  const jsonContent = JSON.stringify(backupPayload, null, 2);
  fs.writeFileSync(datedFilePath, jsonContent, 'utf-8');
  fs.writeFileSync(latestFilePath, jsonContent, 'utf-8');

  console.log('✅ Resguardo completado con éxito:');
  console.log(`   - Campañas: ${campaigns.length}`);
  console.log(`   - Localidades actuales: ${localities.length}`);
  console.log(`   - Trabajos totales: ${jobs.length}`);
  console.log(`   - Gastos totales: ${gastos.length}`);
  console.log(`   - Secuencias: ${secuencias.length}`);
  console.log(`📁 Archivos guardados en:\n   1) ${datedFilePath}\n   2) ${latestFilePath}`);
  process.exit(0);
}

runBackup().catch(err => {
  console.error('❌ Error al realizar el resguardo:', err);
  process.exit(1);
});
