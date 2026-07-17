import React from 'react';
import { 
  DollarSign, 
  Eye, 
  TrendingUp, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Layers,
  FileText
} from 'lucide-react';

export default function Dashboard({ campaign, jobs, localities }) {
  if (!campaign) {
    return (
      <div className="card text-center py-5">
        <Layers size={48} className="text-muted mb-3" />
        <h3>No hay ninguna campaña activa</h3>
        <p className="text-secondary">Crea o selecciona una campaña en la pestaña de Configuración para comenzar.</p>
      </div>
    );
  }

  // Calculate statistics
  const totalJobs = jobs.length;
  const totalBilling = jobs.reduce((acc, job) => acc + (job.precioTotal || 0), 0);
  
  // Status breakdown
  const statusCounts = {
    'Sin Pedir': 0,
    'Pedido Lab': 0,
    'Listo': 0,
    'Enviado': 0
  };
  jobs.forEach(job => {
    if (statusCounts[job.estado] !== undefined) {
      statusCounts[job.estado]++;
    } else {
      statusCounts['Pedido Lab']++;
    }
  });

  // Calibration types breakdown (per pair/job price)
  const calibrationStats = {
    'Aro Completo': { count: 0, billing: 0 },
    'Ranurado': { count: 0, billing: 0 },
    'Perforado': { count: 0, billing: 0 }
  };
  
  // Lens types breakdown (Stock vs Laboratorio, in pairs)
  const lensStats = {
    'Stock': { count: 0, billing: 0 },
    'Laboratorio': { count: 0, billing: 0 }
  };

  jobs.forEach(job => {
    // Calibrado (always full price)
    const cType = job.calibradoTipo || 'Aro Completo';
    if (calibrationStats[cType]) {
      calibrationStats[cType].count++;
      calibrationStats[cType].billing += (job.calibradoPrecio || 0);
    }

    // Cristales (OD + OI, priced at 50% per lens)
    if (job.cristalOD) {
      const type = job.cristalOD.type || 'Stock';
      if (lensStats[type]) {
        lensStats[type].count += 0.5; // Half a pair
        lensStats[type].billing += (job.cristalOD.price || 0) / 2;
      }
    }
    if (job.cristalOI) {
      const type = job.cristalOI.type || 'Stock';
      if (lensStats[type]) {
        lensStats[type].count += 0.5; // Half a pair
        lensStats[type].billing += (job.cristalOI.price || 0) / 2;
      }
    }
  });

  // Localities breakdown
  const localityStats = {};
  localities.forEach(loc => {
    localityStats[loc.id] = {
      name: loc.name,
      code: loc.code,
      total: 0,
      pedido: 0,
      sinPedir: 0,
      listo: 0,
      enviado: 0
    };
  });

  jobs.forEach(job => {
    const locId = job.localidadId;
    if (localityStats[locId]) {
      localityStats[locId].total++;
      if (job.estado === 'Pedido Lab') localityStats[locId].pedido++;
      if (job.estado === 'Sin Pedir') localityStats[locId].sinPedir++;
      if (job.estado === 'Listo') localityStats[locId].listo++;
      if (job.estado === 'Enviado') localityStats[locId].enviado++;
    }
  });

  const formatMoney = (val) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header mb-4">
        <div>
          <span className="badge badge-success mb-2">Campaña Activa</span>
          <h2 className="m-0">{campaign.name}</h2>
          <p className="text-secondary m-0">Iniciada el {new Date(campaign.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid-4 mb-4">
        <div className="stat-card glass-card">
          <div className="stat-icon bg-primary-soft">
            <DollarSign size={24} className="text-primary" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Facturación Total Est.</span>
            <h3 className="stat-value">{formatMoney(totalBilling)}</h3>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon bg-info-soft">
            <FileText size={24} className="text-info" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Trabajos Totales</span>
            <h3 className="stat-value">{totalJobs}</h3>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon bg-success-soft">
            <CheckCircle2 size={24} className="text-success" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Calibrados Listos</span>
            <h3 className="stat-value">{statusCounts['Listo']}</h3>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon bg-warning-soft">
            <Clock size={24} className="text-warning" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Pendientes en Lab</span>
            <h3 className="stat-value">{statusCounts['Pedido Lab'] + statusCounts['Sin Pedir']}</h3>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid-2-1 mb-4">
        {/* Localities Summary */}
        <div className="glass-card p-4">
          <div className="card-header mb-3">
            <h3 className="m-0 flex-align-center gap-2">
              <MapPin size={20} className="text-primary" />
              Estado por Localidades
            </h3>
          </div>
          
          <div className="localities-grid">
            {Object.values(localityStats).filter(loc => loc.total > 0).length === 0 ? (
              <p className="text-secondary text-center py-4">No hay trabajos cargados aún en esta campaña.</p>
            ) : (
              Object.values(localityStats)
                .filter(loc => loc.total > 0)
                .map(loc => (
                  <div key={loc.name} className="locality-stat-row">
                    <div className="locality-info-header">
                      <div className="locality-name-badge">
                        <span className="locality-letter">{loc.code}</span>
                        <strong>{loc.name}</strong>
                      </div>
                      <span className="text-secondary small">{loc.total} trabajos</span>
                    </div>
                    
                    <div className="progress-bar-container">
                      <div className="progress-bar-segments">
                        <div 
                          className="progress-segment bg-success" 
                          style={{ width: `${(loc.enviado / loc.total) * 100}%` }}
                          title={`Enviados: ${loc.enviado}`}
                        />
                        <div 
                          className="progress-segment bg-info" 
                          style={{ width: `${(loc.listo / loc.total) * 100}%` }}
                          title={`Listos: ${loc.listo}`}
                        />
                        <div 
                          className="progress-segment bg-warning" 
                          style={{ width: `${((loc.pedido + loc.sinPedir) / loc.total) * 100}%` }}
                          title={`Pendientes: ${loc.pedido + loc.sinPedir}`}
                        />
                      </div>
                    </div>
                    
                    <div className="locality-details-row">
                      <span className="badge-dot text-warning font-xs">
                        <span className="dot bg-warning"></span> {loc.pedido + loc.sinPedir} Pend.
                      </span>
                      <span className="badge-dot text-info font-xs">
                        <span className="dot bg-info"></span> {loc.listo} Listos
                      </span>
                      <span className="badge-dot text-success font-xs">
                        <span className="dot bg-success"></span> {loc.enviado} Env.
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Totals & Billing breakdown */}
        <div className="glass-card p-4 flex-column gap-4">
          <div>
            <h3 className="m-0 mb-3 flex-align-center gap-2">
              <Eye size={20} className="text-primary" />
              Resumen de Cristales
            </h3>
            <div className="table-xs">
              <div className="table-xs-row header">
                <div>Tipo</div>
                <div className="text-right">Pares</div>
                <div className="text-right">Total Est.</div>
              </div>
              <div className="table-xs-row">
                <div>Cristales Stock</div>
                <div className="text-right font-medium">{lensStats['Stock'].count.toFixed(1)}</div>
                <div className="text-right font-medium">{formatMoney(lensStats['Stock'].billing)}</div>
              </div>
              <div className="table-xs-row">
                <div>Cristales Lab</div>
                <div className="text-right font-medium">{lensStats['Laboratorio'].count.toFixed(1)}</div>
                <div className="text-right font-medium">{formatMoney(lensStats['Laboratorio'].billing)}</div>
              </div>
            </div>
            <span className="text-muted font-xs mt-2 block">* Cantidad expresada en pares equivalentes (1 cristal = 0.5 pares).</span>
          </div>

          <div className="divider"></div>

          <div>
            <h3 className="m-0 mb-3 flex-align-center gap-2">
              <TrendingUp size={20} className="text-primary" />
              Detalle de Calibrados
            </h3>
            <div className="table-xs">
              <div className="table-xs-row header">
                <div>Calibrado</div>
                <div className="text-right">Cant.</div>
                <div className="text-right">Total Est.</div>
              </div>
              {Object.entries(calibrationStats).map(([name, stats]) => (
                <div key={name} className="table-xs-row">
                  <div>{name}</div>
                  <div className="text-right font-medium">{stats.count}</div>
                  <div className="text-right font-medium">{formatMoney(stats.billing)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
