import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  MapPin, 
  Database, 
  Layers, 
  Check, 
  Trash2, 
  CloudLightning, 
  Info,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { 
  saveCampana, 
  saveLocalidad, 
  subscribeCampanas, 
  syncLocalToFirebase,
  resetAllData
} from '../services/dataService';
import { isFirebaseConfigured, resetFirebase, getFirebaseDb } from '../firebase';

export default function Settings({ 
  localities, 
  activeCampaign, 
  setActiveCampaign, 
  onLocalitiesUpdated 
}) {
  const [activeTab, setActiveTab] = useState('campaigns'); // 'campaigns', 'localities', 'sync'
  
  // Campaigns state
  const [campaigns, setCampaigns] = useState([]);
  const [newCampaignName, setNewCampaignName] = useState('');
  
  // Localities state
  const [newLocName, setNewLocName] = useState('');
  const [newLocCode, setNewLocCode] = useState('');

  // Sync / Firebase state
  const [firebaseConfigured, setFirebaseConfigured] = useState(isFirebaseConfigured());
  const [apiKey, setApiKey] = useState('');
  const [authDomain, setAuthDomain] = useState('');
  const [projectId, setProjectId] = useState('');
  const [storageBucket, setStorageBucket] = useState('');
  const [messagingSenderId, setMessagingSenderId] = useState('');
  const [appId, setAppId] = useState('');
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  // Load campaigns subscription
  useEffect(() => {
    const unsub = subscribeCampanas((list) => {
      setCampaigns(list);
    });
    return () => unsub();
  }, []);

  // Load existing Firebase config if present
  useEffect(() => {
    const stored = localStorage.getItem('optica_firebase_config');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setApiKey(parsed.apiKey || '');
        setAuthDomain(parsed.authDomain || '');
        setProjectId(parsed.projectId || '');
        setStorageBucket(parsed.storageBucket || '');
        setMessagingSenderId(parsed.messagingSenderId || '');
        setAppId(parsed.appId || '');
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Campaign handlers
  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!newCampaignName.trim()) return;

    try {
      const campId = await saveCampana({
        name: newCampaignName.trim()
      });
      setNewCampaignName('');
      
      // Auto-set as active if there is none
      if (!activeCampaign) {
        const newCamp = { id: campId, name: newCampaignName.trim(), status: 'activa', createdAt: new Date().toISOString() };
        setActiveCampaign(newCamp);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectCampaign = (camp) => {
    setActiveCampaign(camp);
    localStorage.setItem('optica_active_campaign_id', camp.id);
  };

  const handleToggleCampaignStatus = async (camp) => {
    const nextStatus = camp.status === 'activa' ? 'cerrada' : 'activa';
    try {
      await saveCampana({
        ...camp,
        status: nextStatus
      });
      // Update local state if active
      if (activeCampaign && activeCampaign.id === camp.id) {
        setActiveCampaign({ ...activeCampaign, status: nextStatus });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Locality handlers
  const handleCreateLocality = async (e) => {
    e.preventDefault();
    if (!newLocName.trim()) return;

    try {
      const loc = {
        name: newLocName.trim(),
        code: newLocCode.trim().toUpperCase() || null
      };
      await saveLocalidad(loc);
      setNewLocName('');
      setNewLocCode('');
      if (onLocalitiesUpdated) onLocalitiesUpdated();
    } catch (e) {
      console.error(e);
    }
  };

  // Sync / Firebase handlers
  const handleConnectFirebase = async (e) => {
    e.preventDefault();
    if (!apiKey || !projectId) {
      setSyncStatusMsg('La API Key y el Project ID son requeridos.');
      return;
    }

    setSyncStatusMsg('Verificando conexión...');

    const config = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim(),
      projectId: projectId.trim(),
      storageBucket: storageBucket.trim(),
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim()
    };

    try {
      // Temporarily save config to check connection
      localStorage.setItem('optica_firebase_config', JSON.stringify(config));
      resetFirebase();
      const db = getFirebaseDb();
      
      if (!db) {
        throw new Error("No se pudo iniciar la base de datos.");
      }

      setSyncStatusMsg('¡Conectado! Sincronizando datos locales a la nube...');
      
      // Upload local storage data to Firebase
      await syncLocalToFirebase(db);
      
      setSyncStatusMsg('¡Sincronización exitosa! Recargando app...');
      setFirebaseConfigured(true);
      
      // Reload page to re-bind subscriptions with Firebase
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {
      console.error(err);
      localStorage.removeItem('optica_firebase_config');
      resetFirebase();
      setSyncStatusMsg('Error de conexión. Verifica las credenciales e intenta nuevamente.');
    }
  };

  const handleDisconnectFirebase = () => {
    if (window.confirm('¿Desconectar la sincronización de la nube? Los datos nuevos se guardarán solo en tu computadora local.')) {
      localStorage.removeItem('optica_firebase_config');
      resetFirebase();
      setFirebaseConfigured(false);
      setSyncStatusMsg('Desconectado. Recargando app...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  const handleResetDatabase = async () => {
    if (window.confirm('⚠️ ATENCIÓN: ¿Estás seguro de que deseas eliminar TODOS los trabajos y campañas? Las localidades y sus códigos se conservarán. Esta acción es definitiva y borrará los datos locales (y de la nube si está conectada).')) {
      try {
        await resetAllData();
        setActiveCampaign(null);
        alert('Base de datos reiniciada con éxito. Crearemos una nueva campaña real.');
        window.location.reload();
      } catch (e) {
        console.error(e);
        alert('Error al reiniciar la base de datos.');
      }
    }
  };


  return (
    <div className="grid-1-3 gap-4">
      {/* Settings Navigation Menu */}
      <div className="glass-card p-3 flex-column gap-2 height-fit">
        <button
          className={`btn btn-sm text-left flex-align-center gap-2 ${activeTab === 'campaigns' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('campaigns')}
        >
          <Layers size={18} /> Campañas
        </button>
        <button
          className={`btn btn-sm text-left flex-align-center gap-2 ${activeTab === 'localities' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('localities')}
        >
          <MapPin size={18} /> Localidades
        </button>
        <button
          className={`btn btn-sm text-left flex-align-center gap-2 ${activeTab === 'sync' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('sync')}
        >
          <Database size={18} /> Compartir (Sincronización)
        </button>
      </div>

      {/* Settings Content Area */}
      <div className="glass-card p-4">
        
        {/* --- CAMPAIGNS TAB --- */}
        {activeTab === 'campaigns' && (
          <div className="flex-column gap-4">
            <div>
              <h3 className="m-0 mb-3 flex-align-center gap-2">
                <Layers size={22} className="text-primary" />
                Administración de Campañas
              </h3>
              <p className="text-secondary small">
                Cada tanda de trabajos (ej. 300 trabajos quincenales) debe organizarse en una campaña separada para mantener ordenadas las estadísticas y entregas.
              </p>
            </div>

            {/* Create Campaign form */}
            <form onSubmit={handleCreateCampaign} className="flex-align-end gap-2 bg-dark-soft p-3 rounded-lg">
              <div className="form-group m-0 flex-grow-1">
                <label>Nombre de la Nueva Campaña</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: Campaña Julio 2026 - Tanda 1"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary height-fit">
                <Plus size={16} /> Crear
              </button>
            </form>

            {/* Campaigns list */}
            <div>
              <h4 className="m-0 mb-2">Listado de Campañas</h4>
              <div className="campaigns-list">
                {campaigns.length === 0 ? (
                  <p className="text-secondary p-3 text-center bg-dark-soft rounded">No hay campañas creadas.</p>
                ) : (
                  campaigns.map(camp => (
                    <div 
                      key={camp.id} 
                      className={`campaign-item-row ${activeCampaign?.id === camp.id ? 'active' : ''}`}
                    >
                      <div className="camp-info">
                        <strong>{camp.name}</strong>
                        <span className="text-secondary small">
                          Creada el {new Date(camp.createdAt).toLocaleDateString('es-AR')}
                        </span>
                      </div>
                      
                      <div className="camp-actions ml-auto">
                        <span className={`badge ${camp.status === 'activa' ? 'badge-success-soft text-success border-success' : 'badge-secondary-soft text-secondary border-secondary'}`}>
                          {camp.status === 'activa' ? 'Activa' : 'Cerrada'}
                        </span>
                        
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          onClick={() => handleToggleCampaignStatus(camp)}
                          title={camp.status === 'activa' ? 'Cerrar campaña' : 'Abrir campaña'}
                        >
                          {camp.status === 'activa' ? 'Cerrar' : 'Reabrir'}
                        </button>
                        
                        {activeCampaign?.id !== camp.id ? (
                          <button
                            type="button"
                            className="btn btn-xs btn-primary"
                            onClick={() => handleSelectCampaign(camp)}
                          >
                            Activar
                          </button>
                        ) : (
                          <span className="badge badge-primary flex-align-center gap-1 font-semibold">
                            <Check size={14} /> Seleccionada
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Danger Zone / Reset App Data */}
            <div className="divider mt-4"></div>
            <div className="bg-danger-soft p-3 rounded-lg border border-danger flex-align-center justify-between gap-3 mt-2 col-12-mobile">
              <div>
                <strong className="text-danger block font-semibold">Zona de Peligro: Reiniciar Aplicación</strong>
                <span className="small text-secondary block mt-1">
                  Elimina de forma permanente todas las campañas y todos los trabajos registrados en esta computadora (las localidades y sus códigos de letras se conservarán).
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-danger font-bold flex-align-center gap-1"
                onClick={handleResetDatabase}
              >
                <Trash2 size={16} /> Limpiar Datos
              </button>
            </div>

          </div>
        )}

        {/* --- LOCALITIES TAB --- */}
        {activeTab === 'localities' && (
          <div className="flex-column gap-4">
            <div>
              <h3 className="m-0 mb-3 flex-align-center gap-2">
                <MapPin size={22} className="text-primary" />
                Gestión de Localidades
              </h3>
              <p className="text-secondary small">
                Define las localidades asociadas. Cada una requiere una letra única para generar los códigos de referencia automáticos (ej. 1A, 2A).
              </p>
            </div>

            {/* Create Locality Form */}
            <form onSubmit={handleCreateLocality} className="grid-2 bg-dark-soft p-3 rounded-lg gap-3">
              <div className="form-group m-0">
                <label>Nombre del Pueblo / Localidad</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: Gaiman"
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group m-0">
                <label>Letra (Código de Referencia)</label>
                <div className="flex-align-end gap-2">
                  <input
                    type="text"
                    className="form-control text-center uppercase"
                    maxLength="2"
                    placeholder="Auto"
                    value={newLocCode}
                    onChange={(e) => setNewLocCode(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary height-fit">
                    <Plus size={16} /> Agregar
                  </button>
                </div>
                <span className="text-secondary font-xs mt-1 block">Dejar vacío para asignar la siguiente letra del alfabeto.</span>
              </div>
            </form>

            {/* Localities list grid */}
            <div>
              <h4 className="m-0 mb-2">Localidades Registradas</h4>
              <div className="localities-settings-grid">
                {localities.map(loc => (
                  <div key={loc.id} className="locality-settings-card">
                    <div className="locality-letter-badge">{loc.code}</div>
                    <div className="locality-card-name">{loc.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- SYNC / FIREBASE TAB --- */}
        {activeTab === 'sync' && (
          <div className="flex-column gap-4">
            <div>
              <h3 className="m-0 mb-3 flex-align-center gap-2">
                <CloudLightning size={22} className="text-primary" />
                Compartir con mi Socio (Sincronización en Tiempo Real)
              </h3>
              <p className="text-secondary small">
                Para que tú y tu socio puedan cargar y actualizar trabajos al mismo tiempo desde computadoras distintas, conectamos la aplicación a una base de datos gratuita de **Firebase Firestore**.
              </p>
            </div>

            {firebaseConfigured ? (
              // Connected State UI
              <div className="bg-success-soft p-4 rounded-lg border border-success flex-column gap-3">
                <div className="flex-align-center gap-2 text-success font-semibold">
                  <CloudLightning size={24} />
                  <span>Estado: Conectado a la Nube (Tiempo Real Activo)</span>
                </div>
                <p className="small text-secondary m-0">
                  La aplicación está sincronizando todos los trabajos y campañas en tiempo real. Cualquier cambio se verá reflejado inmediatamente en la pantalla de tu socio.
                </p>
                <div className="divider"></div>
                <div className="flex-between align-center">
                  <span className="small text-secondary font-mono">Proyecto ID: {projectId}</span>
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline text-danger border-danger"
                    onClick={handleDisconnectFirebase}
                  >
                    Desconectar Nube
                  </button>
                </div>
              </div>
            ) : (
              // Local/Not Connected State UI
              <div className="flex-column gap-3">
                <div className="bg-warning-soft p-4 rounded-lg border border-warning flex-align-center gap-3">
                  <Info size={24} className="text-warning flex-shrink-0" />
                  <div>
                    <strong className="text-warning block">Estado: Modo Local</strong>
                    <span className="small text-secondary">
                      Los datos se guardan únicamente en el navegador de esta computadora. Tu socio no podrá verlos hasta que configuren Firebase.
                    </span>
                  </div>
                </div>

                <div className="divider"></div>

                {/* Connection Form */}
                <form onSubmit={handleConnectFirebase} className="flex-column gap-3">
                  <h4>Configuración de Firebase Firestore</h4>
                  
                  <div className="grid-2 gap-3">
                    <div className="form-group col-12-mobile">
                      <label>API Key</label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="AIzaSy..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        required
                      />
                    </div>
                    
                    <div className="form-group col-12-mobile">
                      <label>Project ID</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="nombre-proyecto-12345"
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group col-12-mobile">
                      <label>Auth Domain (Opcional)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="nombre-proyecto.firebaseapp.com"
                        value={authDomain}
                        onChange={(e) => setAuthDomain(e.target.value)}
                      />
                    </div>

                    <div className="form-group col-12-mobile">
                      <label>App ID (Opcional)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="1:123456789:web:abcd123456"
                        value={appId}
                        onChange={(e) => setAppId(e.target.value)}
                      />
                    </div>
                  </div>

                  {syncStatusMsg && (
                    <div className="alert bg-dark text-center font-sm p-2 rounded border font-medium">
                      {syncStatusMsg}
                    </div>
                  )}

                  <div className="buttons-row justify-between">
                    <button
                      type="button"
                      className="btn btn-link btn-xs flex-align-center gap-1"
                      onClick={() => setShowInstructions(!showInstructions)}
                    >
                      <HelpCircle size={14} /> {showInstructions ? 'Ocultar' : 'Mostrar'} Guía de Configuración
                    </button>
                    
                    <button type="submit" className="btn btn-primary">
                      Conectar y Sincronizar
                    </button>
                  </div>
                </form>

                {/* Instructions Accordion */}
                {showInstructions && (
                  <div className="bg-dark-soft p-4 rounded-lg font-sm text-secondary flex-column gap-2 mt-2">
                    <h5 className="m-0 text-primary-dark">¿Cómo obtener tus credenciales de Firebase?</h5>
                    <ol className="m-0 pl-4 flex-column gap-2">
                      <li>Ingresa a la consola de Firebase: <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer">console.firebase.google.com</a> con tu cuenta de Google.</li>
                      <li>Haz clic en <strong>Agregar proyecto</strong> (el nombre puede ser "Optica-ISA-Gestion").</li>
                      <li>Una vez creado el proyecto, haz clic en el ícono de **Web ( {`</>`} )** para agregar una aplicación web. Regístrala con un nombre.</li>
                      <li>Firebase te mostrará un código JavaScript que contiene el bloque <code>const firebaseConfig = {`{...}`}</code>. Copia el valor de <code>apiKey</code> y <code>projectId</code> de ese bloque y pégalos en el formulario de arriba.</li>
                      <li><strong>Paso Muy Importante:</strong> En el menú lateral izquierdo de tu consola de Firebase, ve a <strong>Firestore Database</strong>, haz clic en <strong>Crear base de datos</strong>. Configúrala en "Modo de prueba" (para permitir lecturas/escrituras públicas rápidas) y selecciona una región cercana.</li>
                      <li>Una vez pegados los datos arriba, haz clic en **Conectar y Sincronizar**. ¡Eso es todo! La app subirá automáticamente tus trabajos guardados localmente a tu nueva nube y quedará lista para compartir.</li>
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
