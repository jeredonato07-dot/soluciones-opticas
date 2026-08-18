import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  PlusCircle, 
  ListCollapse, 
  Settings2, 
  CloudLightning,
  AlertTriangle,
  BookOpen,
  BarChart3,
  Wallet
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import GeneralDashboard from './components/GeneralDashboard';
import FinanceModule from './components/FinanceModule';
import JobForm from './components/JobForm';
import JobList from './components/JobList';
import Settings from './components/Settings';
import PriceList from './components/PriceList';
import { getLocalidades, subscribeCampanas, subscribeTrabajos } from './services/dataService';
import { isFirebaseConfigured } from './firebase';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'general', 'finances', 'entry', 'list', 'pricelist', 'settings'
  const [editingJob, setEditingJob] = useState(null);
  const [localities, setLocalities] = useState([]);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [firebaseConnected, setFirebaseConnected] = useState(isFirebaseConfigured());

  // Fetch localities on mount
  const fetchLocalities = () => {
    getLocalidades().then(setLocalities);
  };

  useEffect(() => {
    fetchLocalities();
  }, []);

  // Subscribe to campaigns and resolve active campaign on mount
  useEffect(() => {
    const storedId = localStorage.getItem('optica_active_campaign_id');
    const unsub = subscribeCampanas((campaignList) => {
      if (campaignList.length > 0) {
        // Find stored campaign ONLY if it is still active
        const storedActive = campaignList.find(c => c.id === storedId && c.status === 'activa');
        const firstActive = campaignList.find(c => c.status === 'activa');
        const active = storedActive || firstActive || null;
        setActiveCampaign(active);
        if (active) {
          localStorage.setItem('optica_active_campaign_id', active.id);
        } else {
          localStorage.removeItem('optica_active_campaign_id');
        }
      } else {
        setActiveCampaign(null);
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to jobs for active campaign
  useEffect(() => {
    if (activeCampaign?.id) {
      const unsub = subscribeTrabajos(activeCampaign.id, (jobsList) => {
        setJobs(jobsList);
      });
      return () => unsub();
    } else {
      setJobs([]);
    }
  }, [activeCampaign]);

  // Handle active campaign changes
  const handleActiveCampaignChange = (campaign) => {
    setActiveCampaign(campaign);
    if (campaign) {
      localStorage.setItem('optica_active_campaign_id', campaign.id);
    } else {
      localStorage.removeItem('optica_active_campaign_id');
    }
  };

  return (
    <div className="app-wrapper">
      {/* App Sidebar Navigation */}
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo bg-primary">
            <span className="brand-char">S.O</span>
          </div>
          <div className="brand-meta">
            <h1>Soluciones Ópticas</h1>
            <span className="brand-subtitle">Gestión de Planillas</span>
          </div>
        </div>

        <div className="divider mb-4"></div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <TrendingUp size={20} />
            <span>Dashboard</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <BarChart3 size={20} />
            <span>Control General</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'finances' ? 'active' : ''}`}
            onClick={() => setActiveTab('finances')}
          >
            <Wallet size={20} />
            <span>Finanzas y Gastos</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'entry' ? 'active' : ''}`}
            onClick={() => setActiveTab('entry')}
            disabled={!activeCampaign}
            title={!activeCampaign ? 'Debes crear una campaña activa primero' : ''}
          >
            <PlusCircle size={20} />
            <span>{editingJob ? '✏️ Editando Trabajo' : 'Ingresar Trabajo'}</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
            disabled={!activeCampaign}
            title={!activeCampaign ? 'Debes crear una campaña activa primero' : ''}
          >
            <ListCollapse size={20} />
            <span>Ver Trabajos ({jobs.length})</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'pricelist' ? 'active' : ''}`}
            onClick={() => setActiveTab('pricelist')}
          >
            <BookOpen size={20} />
            <span>Lista de Precios</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings2 size={20} />
            <span>Configuración</span>
          </button>
        </nav>

        {/* Sync status badge in sidebar footer */}
        <div className="sidebar-footer">
          <div className={`sync-status-badge ${firebaseConnected ? 'online' : 'offline'}`}>
            <CloudLightning size={14} />
            <span>{firebaseConnected ? 'Nube en tiempo real' : 'Guardando localmente'}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="app-main-content">
        <header className="app-main-header">
          <div className="header-campaign-info">
            {activeCampaign ? (
              <div className={`active-camp-badge ${activeCampaign.status === 'cerrada' ? 'warning border border-warning-soft' : ''}`} style={activeCampaign.status === 'cerrada' ? { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' } : {}}>
                <span className={`dot ${activeCampaign.status === 'cerrada' ? 'bg-warning' : 'bg-success animate-pulse'}`}></span>
                <span className="flex-align-center gap-1">
                  <span>{activeCampaign.status === 'cerrada' ? '🔒 Campaña Cerrada:' : '🟢 Campaña Activa:'}</span>
                  <strong>{activeCampaign.name}</strong>
                  {activeCampaign.status === 'cerrada' && (
                    <span className="badge-small bg-warning text-dark font-xs font-bold ml-1 px-1 rounded">
                      HISTÓRICO
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <div className="active-camp-badge warning">
                <AlertTriangle size={14} className="text-warning" />
                <span>No hay campaña seleccionada. Ve a Configuración.</span>
              </div>
            )}
          </div>
          <div className="header-datetime font-sm text-secondary">
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </header>

        <section className="app-content-body">
          {activeTab === 'dashboard' && (
            <Dashboard 
              campaign={activeCampaign} 
              jobs={jobs} 
              localities={localities} 
            />
          )}

          {activeTab === 'general' && (
            <GeneralDashboard 
              localities={localities} 
              onSelectCampaign={(camp) => {
                handleActiveCampaignChange(camp);
                setActiveTab('dashboard');
              }}
            />
          )}

          {activeTab === 'finances' && (
            <FinanceModule 
              activeCampaign={activeCampaign}
              onSelectCampaign={(camp) => {
                handleActiveCampaignChange(camp);
              }}
            />
          )}

          {activeTab === 'entry' && activeCampaign && (
            <JobForm 
              campaign={activeCampaign} 
              localities={localities} 
              jobs={jobs}
              editingJob={editingJob}
              onJobSaved={(isEdit) => {
                setEditingJob(null);
                if (isEdit) {
                  setActiveTab('list');
                }
              }}
              onCancelEdit={() => {
                setEditingJob(null);
                setActiveTab('list');
              }}
            />
          )}

          {activeTab === 'list' && activeCampaign && (
            <JobList 
              campaign={activeCampaign} 
              jobs={jobs} 
              localities={localities}
              onEditJob={(job) => {
                setEditingJob(job);
                setActiveTab('entry');
              }}
              onJobsUpdated={() => {
                // optional callback
              }}
            />
          )}

          {activeTab === 'pricelist' && (
            <PriceList />
          )}

          {activeTab === 'settings' && (
            <Settings 
              localities={localities} 
              jobs={jobs} 
              activeCampaign={activeCampaign}
              setActiveCampaign={handleActiveCampaignChange}
              onLocalitiesUpdated={fetchLocalities}
            />
          )}
        </section>
      </main>
    </div>
  );
}
