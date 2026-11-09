import React, { useState, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  Trash2, 
  Edit,
  Package, 
  FileSpreadsheet, 
  Truck, 
  List, 
  Check, 
  Calendar,
  AlertCircle,
  Eye,
  Lock,
  X
} from 'lucide-react';
import { saveTrabajo, deleteTrabajo, resolveCampaignLocalities } from '../services/dataService';
import { getCanonicalLens, getLensStyleInfo } from './PriceList';

export default function JobList({ campaign, campaigns = [], onSelectCampaign, jobs, localities, onEditJob, onJobsUpdated }) {
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'logistics'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocFilter, setSelectedLocFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');
  const [viewingJob, setViewingJob] = useState(null);

  const isClosed = campaign?.status === 'cerrada';
  const effectiveLocalities = resolveCampaignLocalities(localities, jobs, isClosed);

  // Reset locality filter when switching campaigns so jobs are never hidden by another campaign's locality
  useEffect(() => {
    setSelectedLocFilter('');
  }, [campaign?.id]);

  // Toggle status cycling (Blocked if campaign is closed)
  const cycleStatus = async (job) => {
    if (isClosed) return;
    const states = ['Sin Pedir', 'Pedido Lab', 'Listo', 'Enviado'];
    const currentIdx = states.indexOf(job.estado);
    const nextIdx = (currentIdx + 1) % states.length;
    const nextEstado = states[nextIdx];
    
    try {
      await saveTrabajo({
        ...job,
        estado: nextEstado
      });
      if (onJobsUpdated) onJobsUpdated();
    } catch (e) {
      console.error("Error updating job status:", e);
    }
  };

  // Change state directly (Blocked if campaign is closed)
  const setJobStatus = async (job, newStatus) => {
    if (isClosed) return;
    try {
      await saveTrabajo({
        ...job,
        estado: newStatus
      });
      if (onJobsUpdated) onJobsUpdated();
    } catch (e) {
      console.error("Error setting job status:", e);
    }
  };

  // Delete handler (Blocked if campaign is closed)
  const handleDelete = async (jobId) => {
    if (isClosed) return;
    if (window.confirm('¿Estás seguro de que deseas eliminar este trabajo?')) {
      try {
        await deleteTrabajo(jobId, campaign.id);
        if (onJobsUpdated) onJobsUpdated();
      } catch (e) {
        console.error("Error deleting job:", e);
      }
    }
  };

  // Export to CSV helper
  const exportToCSV = () => {
    if (jobs.length === 0) return;
    
    const headers = [
      'Código Ref', 'Localidad', 'Paciente', 'Cristal OD', 'Cristal OI', 
      'Calibrado Tipo', 'Precio Calibrado', 'Nro Pedido Lab', 'Precio Total', 'Estado', 'Fecha'
    ];
    
    const rows = jobs.map(job => {
      const loc = effectiveLocalities.find(l => l.id === job.localidadId);
      return [
        job.refCode,
        job.localidadNombre || loc?.name || job.localidadId,
        job.paciente || 'S/D',
        job.cristalOD ? job.cristalOD.name : 'Pase / Ninguno',
        job.cristalOI ? job.cristalOI.name : 'Pase / Ninguno',
        job.calibradoTipo,
        job.calibradoPrecio,
        job.nroPedidoLab || 'S/D',
        job.precioTotal,
        job.estado,
        new Date(job.createdAt).toLocaleDateString('es-AR')
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `planilla_trabajos_${campaign.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dispatch all 'Listo' jobs for a locality (Blocked if campaign is closed)
  const dispatchAllForLocality = async (locId, locJobs) => {
    if (isClosed) return;
    const readyJobs = locJobs.filter(j => j.estado === 'Listo');
    if (readyJobs.length === 0) return;
    
    if (window.confirm(`¿Marcar los ${readyJobs.length} trabajos listos de esta localidad como enviados?`)) {
      try {
        const promises = readyJobs.map(job => saveTrabajo({ ...job, estado: 'Enviado' }));
        await Promise.all(promises);
        if (onJobsUpdated) onJobsUpdated();
      } catch (e) {
        console.error("Error dispatching jobs:", e);
      }
    }
  };

  // Formatting helper
  const formatMoney = (val) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(val || 0);
  };

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    const loc = effectiveLocalities.find(l => l.id === job.localidadId);
    const locName = (job.localidadNombre || loc?.name || job.localidadId || '').toLowerCase();
    const code = (job.refCode || '').toLowerCase();
    const patient = (job.paciente || '').toLowerCase();
    const labOrder = (job.nroPedidoLab || '').toLowerCase();
    const term = searchTerm.toLowerCase();

    const matchesSearch = code.includes(term) || 
                          patient.includes(term) || 
                          labOrder.includes(term) || 
                          locName.includes(term);

    const matchesLoc = selectedLocFilter ? job.localidadId === selectedLocFilter : true;
    const matchesStatus = selectedStatusFilter ? job.estado === selectedStatusFilter : true;

    return matchesSearch && matchesLoc && matchesStatus;
  });

  // Grouping for Logistics (uses effectiveLocalities so closed campaigns show their original towns)
  const logisticsGroups = {};
  effectiveLocalities.forEach(loc => {
    logisticsGroups[loc.id] = {
      locality: loc,
      jobs: jobs.filter(j => j.localidadId === loc.id)
    };
  });

  // Helper to render state badges (Read-Only badge when campaign is closed)
  const renderStateBadge = (job) => {
    const state = job.estado || 'Pedido Lab';
    let badgeClass = 'badge-secondary';
    let stateIcon = '🟡';
    if (state === 'Sin Pedir') {
      badgeClass = 'badge-danger-soft text-danger border-danger';
      stateIcon = '🔴';
    }
    if (state === 'Pedido Lab') {
      badgeClass = 'badge-warning-soft text-warning border-warning';
      stateIcon = '🟡';
    }
    if (state === 'Listo') {
      badgeClass = 'badge-info-soft text-info border-info';
      stateIcon = '🔵';
    }
    if (state === 'Enviado') {
      badgeClass = 'badge-success-soft text-success border-success';
      stateIcon = '🟢';
    }

    if (isClosed) {
      return (
        <span 
          className={`badge-small border px-2 py-1 rounded font-xs font-semibold flex-align-center gap-1 width-fit ${badgeClass}`}
          title="Campaña cerrada (Solo lectura)"
        >
          <span>{stateIcon}</span>
          <span>{state}</span>
        </span>
      );
    }

    return (
      <div className="status-selector-container">
        <select 
          className={`status-select-native ${badgeClass}`} 
          value={state}
          onChange={(e) => setJobStatus(job, e.target.value)}
        >
          <option value="Sin Pedir">🔴 Sin Pedir</option>
          <option value="Pedido Lab">🟡 Pedido Lab</option>
          <option value="Listo">🔵 Listo</option>
          <option value="Enviado">🟢 Enviado</option>
        </select>
      </div>
    );
  };

  if (!campaign) return null;

  return (
    <div className="flex-column gap-4">
      {/* Campaign Context Banner with Quick Campaign Switcher */}
      <div 
        className={`p-3 rounded-lg flex-between align-center flex-wrap gap-3 border ${
          isClosed 
            ? 'border-warning-soft' 
            : 'border-success-soft'
        }`}
        style={{
          background: isClosed
            ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.14) 0%, rgba(22, 28, 45, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(22, 28, 45, 0.95) 100%)'
        }}
      >
        <div className="flex-align-center gap-2 flex-wrap">
          <span className="font-md">
            {isClosed ? '🔒' : '📋'}
          </span>
          <span className="text-white font-semibold">
            Planilla de Trabajos: {campaign.name}
          </span>
          <span className={`badge-small ${isClosed ? 'bg-warning text-dark font-bold' : 'bg-success text-white font-bold'}`}>
            {isClosed ? 'Modo Solo Consulta (Protegida)' : 'Campaña Activa'}
          </span>
          <span className="text-secondary font-xs font-mono ml-2">
            ({jobs.length} trabajos)
          </span>
        </div>

        {/* Campaign Quick Selector to inspect past campaigns safely */}
        {campaigns.length > 1 && onSelectCampaign && (
          <div className="flex-align-center gap-2">
            <Calendar size={15} className="text-secondary" />
            <span className="font-xs text-secondary font-semibold">Consultar Campaña:</span>
            <select
              className="form-control form-control-sm"
              style={{ minWidth: '210px', background: 'var(--bg-dark-soft)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
              value={campaign.id}
              onChange={(e) => {
                const found = campaigns.find(c => c.id === e.target.value);
                if (found) onSelectCampaign(found);
              }}
            >
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>
                  {c.status === 'activa' ? '🟢 ' : '🔒 '} {c.name} ({c.status === 'activa' ? 'Activa' : 'Cerrada'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Filters and View Toggles */}
      <div className="glass-card p-3 flex-between flex-wrap gap-3">
        <div className="flex-align-center gap-2">
          <button 
            className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('list')}
          >
            <List size={16} /> Lista de Trabajos
          </button>
          <button 
            className={`btn btn-sm ${viewMode === 'logistics' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('logistics')}
          >
            <Truck size={16} /> Vista de Despacho
          </button>
        </div>

        {viewMode === 'list' && (
          <div className="flex-align-center flex-wrap gap-2 flex-grow-1 max-width-600 justify-end">
            {/* Search Input */}
            <div className="input-icon-container flex-grow-1">
              <Search size={16} className="search-icon-left" />
              <input 
                type="text" 
                className="form-control form-control-sm pl-5" 
                placeholder="Buscar por código, paciente, lab..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Locality Filter (uses effectiveLocalities so past deleted localities still appear) */}
            <select 
              className="form-control form-control-sm width-130"
              value={selectedLocFilter}
              onChange={(e) => setSelectedLocFilter(e.target.value)}
            >
              <option value="">Todas Localidades ({effectiveLocalities.length})</option>
              {effectiveLocalities.map(l => (
                <option key={l.id} value={l.id}>({l.code}) {l.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select 
              className="form-control form-control-sm width-120"
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
            >
              <option value="">Todos Estados</option>
              <option value="Sin Pedir">Sin Pedir</option>
              <option value="Pedido Lab">Pedido Lab</option>
              <option value="Listo">Listo</option>
              <option value="Enviado">Enviado</option>
            </select>
          </div>
        )}

        <button 
          className="btn btn-sm btn-outline flex-align-center gap-1 ml-auto-desktop"
          onClick={exportToCSV}
          disabled={jobs.length === 0}
        >
          <FileSpreadsheet size={16} /> Exportar Excel (.csv)
        </button>
      </div>

      {/* Main View rendering */}
      {viewMode === 'list' ? (
        <div className="glass-card overflow-x">
          {filteredJobs.length === 0 ? (
            <div className="p-5 text-center text-secondary">
              <Package size={48} className="mb-2 text-muted" />
              <p className="m-0">No se encontraron trabajos con los filtros seleccionados.</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th width="80">Ref</th>
                  <th width="130">Localidad</th>
                  <th>Paciente</th>
                  <th>Detalle de Lentes (OD / OI)</th>
                  <th width="140">Calibrado</th>
                  <th width="110">Pedido Lab</th>
                  <th width="110">Total Est.</th>
                  <th width="120">Estado</th>
                  <th width="110" className="text-center">{isClosed ? 'Detalle' : 'Acciones'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map(job => {
                  const loc = effectiveLocalities.find(l => l.id === job.localidadId);
                  const displayLocName = job.localidadNombre || loc?.name || job.localidadId;
                  return (
                    <tr key={job.id} className={`status-row-${job.estado?.replace(/\s+/g, '')}`}>
                      <td>
                        <strong className="ref-badge">{job.refCode}</strong>
                      </td>
                      <td>
                        <div className="flex-align-center gap-1 font-sm">
                          <MapPin size={12} className="text-secondary" />
                          <span>{displayLocName}</span>
                        </div>
                      </td>
                      <td>
                        <div className="font-semibold text-primary-dark">
                          {job.paciente || <span className="text-muted italic">S/D</span>}
                        </div>
                        {job.createdAt && (
                          <div className="text-muted font-xs">
                            {new Date(job.createdAt).toLocaleDateString('es-AR')}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="lenses-cell">
                          {job.isPaseDeCristales ? (
                            <div className="lens-tag-pill tag-slate">
                              <div className="lens-tag-header">
                                <span className="lens-tag-title">Pase de Cristales</span>
                                <span className="lens-tag-badge">PROPIO</span>
                              </div>
                              <div className="lens-tag-footer">
                                <span className="lens-tag-scope">Sin Cargo Cristales</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              {(() => {
                                const od = getCanonicalLens(job.cristalOD, [], isClosed);
                                const oi = getCanonicalLens(job.cristalOI, [], isClosed);

                                if (!od && !oi) {
                                  return <span className="text-muted italic font-xs">Sin cristales</span>;
                                }

                                const isSameLens = od && oi && od.name === oi.name;

                                if (isSameLens) {
                                  const styleInfo = getLensStyleInfo(od.name);
                                  const pairPrice = (od.price !== undefined && od.price !== null) ? od.price : ((job.precioTotal || 0) - (job.calibradoPrecio || 0));
                                  return (
                                    <div className={`lens-tag-pill tag-${styleInfo.theme}`} title={od.name}>
                                      <div className="lens-tag-header">
                                        <span className="lens-tag-title">{styleInfo.label}</span>
                                        <span className="lens-tag-badge">{styleInfo.badge}</span>
                                      </div>
                                      <div className="lens-tag-footer">
                                        <span className="lens-tag-scope">Par</span>
                                        <span className="lens-tag-price">{formatMoney(pairPrice)}</span>
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div className="lens-tags-split">
                                    {od ? (() => {
                                      const info = getLensStyleInfo(od.name);
                                      return (
                                        <div className={`lens-tag-pill tag-${info.theme} pill-mini`} title={od.name}>
                                          <span className="eye-indicator">OD:</span>
                                          <span className="lens-tag-title">{info.label}</span>
                                          <span className="lens-tag-badge">{info.badge}</span>
                                          <span className="lens-tag-price">{formatMoney(od.price / 2)}</span>
                                        </div>
                                      );
                                    })() : (
                                      <div className="lens-tag-empty">OD: <span className="text-muted">-</span></div>
                                    )}
                                    {oi ? (() => {
                                      const info = getLensStyleInfo(oi.name);
                                      return (
                                        <div className={`lens-tag-pill tag-${info.theme} pill-mini`} title={oi.name}>
                                          <span className="eye-indicator">OI:</span>
                                          <span className="lens-tag-title">{info.label}</span>
                                          <span className="lens-tag-badge">{info.badge}</span>
                                          <span className="lens-tag-price">{formatMoney(oi.price / 2)}</span>
                                        </div>
                                      );
                                    })() : (
                                      <div className="lens-tag-empty">OI: <span className="text-muted">-</span></div>
                                    )}
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="font-sm font-semibold">{job.calibradoTipo} ({job.calibradoProceso || 'Stock'})</div>
                        <div className="text-secondary font-xs">{formatMoney(job.calibradoPrecio)}</div>
                      </td>
                      <td>
                        <span className="font-mono font-medium">
                          {job.nroPedidoLab || <span className="text-muted">-</span>}
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold text-success-dark">{formatMoney(job.precioTotal)}</span>
                      </td>
                      <td>{renderStateBadge(job)}</td>
                      <td>
                        <div className="flex-align-center justify-center gap-2">
                          <button
                            type="button"
                            className="btn-icon text-info"
                            onClick={() => setViewingJob(job)}
                            title="Ver ficha completa del trabajo"
                          >
                            <Eye size={16} />
                          </button>
                          {!isClosed ? (
                            <>
                              <button 
                                type="button"
                                className="btn-icon text-primary" 
                                onClick={() => onEditJob && onEditJob(job)}
                                title="Editar trabajo"
                              >
                                <Edit size={16} />
                              </button>
                              <button 
                                type="button"
                                className="btn-icon text-danger" 
                                onClick={() => handleDelete(job.id)}
                                title="Eliminar trabajo"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          ) : (
                            <span className="text-muted font-xs flex-align-center" title="Protegido contra cambios (Campaña cerrada)">
                              <Lock size={13} />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* LOGISTICS VIEW */
        <div className="grid-2 gap-4">
          {Object.values(logisticsGroups).map(({ locality, jobs: locJobs }) => {
            const readyJobs = locJobs.filter(j => j.estado === 'Listo');
            const pendingJobs = locJobs.filter(j => j.estado === 'Pedido Lab' || j.estado === 'Sin Pedir');
            
            if (locJobs.length === 0) return null;

            return (
              <div key={locality.id} className="glass-card p-4 flex-column gap-3">
                <div className="flex-between align-center">
                  <div className="locality-name-badge">
                    <span className="locality-letter">{locality.code}</span>
                    <strong>{locality.name}</strong>
                  </div>
                  <span className="text-secondary small">{locJobs.length} Trabajos totales</span>
                </div>

                <div className="grid-2 bg-dark-soft p-3 rounded-lg text-center gap-2">
                  <div>
                    <div className="text-info font-bold font-lg">{readyJobs.length}</div>
                    <div className="text-secondary font-xs font-semibold">LISTOS PARA ENVIAR</div>
                  </div>
                  <div>
                    <div className="text-warning font-bold font-lg">{pendingJobs.length}</div>
                    <div className="text-secondary font-xs font-semibold">PENDIENTES EN LAB</div>
                  </div>
                </div>

                {/* Ready list codes */}
                <div>
                  <h4 className="m-0 mb-2 font-sm text-secondary">Trabajos Listos:</h4>
                  {readyJobs.length === 0 ? (
                    <div className="flex-align-center gap-2 p-2 bg-secondary-soft text-secondary rounded font-xs">
                      <AlertCircle size={14} />
                      No hay trabajos listos para enviar en esta localidad.
                    </div>
                  ) : (
                    <div className="flex-wrap gap-2 mb-3">
                      {readyJobs.map(j => (
                        <div 
                          key={j.id} 
                          className="job-logistic-badge"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setViewingJob(j)}
                          title="Clic para ver ficha completa"
                        >
                          <span className="ref-number">{j.refCode}</span>
                          <span className="patient-name">{j.paciente || 'S/D'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dispatch action button (Only if campaign is active) */}
                {readyJobs.length > 0 && !isClosed && (
                  <button 
                    className="btn btn-sm btn-success flex-align-center gap-1 justify-center mt-auto"
                    onClick={() => dispatchAllForLocality(locality.id, locJobs)}
                  >
                    <Check size={16} /> Despachar Todos ({readyJobs.length})
                  </button>
                )}
              </div>
            );
          })}
          {jobs.length === 0 && (
            <div className="col-12 glass-card p-5 text-center text-secondary">
              <Package size={48} className="mb-2 text-muted" />
              <p className="m-0">No hay trabajos registrados en esta campaña.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal de Ficha en Detalle de Trabajo (Solo Lectura) */}
      {viewingJob && (() => {
        const loc = effectiveLocalities.find(l => l.id === viewingJob.localidadId);
        const locName = viewingJob.localidadNombre || loc?.name || viewingJob.localidadId;
        const locCode = viewingJob.localidadCodigo || loc?.code || (viewingJob.refCode || '').replace(/[0-9]/g, '');
        const od = getCanonicalLens(viewingJob.cristalOD, [], isClosed);
        const oi = getCanonicalLens(viewingJob.cristalOI, [], isClosed);
        const priceOD = od ? (od.price || 0) / 2 : 0;
        const priceOI = oi ? (oi.price || 0) / 2 : 0;

        return (
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.72)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => setViewingJob(null)}
          >
            <div 
              className="glass-card p-4 border border-primary-soft"
              style={{ maxWidth: '580px', width: '100%', backgroundColor: '#111827' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-between align-center border-bottom pb-3 mb-3">
                <div className="flex-align-center gap-2">
                  <span className="ref-badge font-md px-3 py-1">{viewingJob.refCode}</span>
                  <div>
                    <h3 className="m-0 text-white">Ficha Detallada del Trabajo</h3>
                    <span className="font-xs text-secondary">
                      Campaña: <strong>{campaign.name}</strong> {isClosed ? '(Cerrada • Histórico)' : '(Activa)'}
                    </span>
                  </div>
                </div>
                <button 
                  type="button" 
                  className="btn-icon text-secondary" 
                  onClick={() => setViewingJob(null)}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-column gap-3 font-sm">
                <div className="grid-2 gap-3 bg-dark-soft p-3 rounded-lg border border-color">
                  <div>
                    <span className="font-xs text-muted block">Paciente</span>
                    <strong className="text-white font-md">{viewingJob.paciente || 'Sin especificar'}</strong>
                  </div>
                  <div>
                    <span className="font-xs text-muted block">Localidad de Origen</span>
                    <strong className="text-white font-md">({locCode}) {locName}</strong>
                  </div>
                  <div>
                    <span className="font-xs text-muted block">Fecha y Hora de Carga</span>
                    <span className="text-secondary font-mono font-xs">
                      {viewingJob.createdAt 
                        ? new Date(viewingJob.createdAt).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
                        : 'S/D'}
                    </span>
                  </div>
                  <div>
                    <span className="font-xs text-muted block">Nro Pedido Laboratorio</span>
                    <strong className="font-mono text-info">{viewingJob.nroPedidoLab || 'No registrado'}</strong>
                  </div>
                </div>

                {/* Cristales Detail */}
                <div className="bg-dark-soft p-3 rounded-lg border border-color flex-column gap-2">
                  <span className="font-xs text-secondary font-bold uppercase">Detalle de Cristales</span>
                  {viewingJob.isPaseDeCristales ? (
                    <div className="p-2 rounded bg-primary-soft text-primary font-semibold">
                      Pase de Cristales Propio (Sin cargo de cristales)
                    </div>
                  ) : (
                    <div className="flex-column gap-2">
                      <div className="flex-between align-center border-bottom pb-2">
                        <div>
                          <span className="badge-small bg-info-soft text-info font-bold mr-2">OD (Ojo Derecho)</span>
                          <strong className="text-white">{od ? (od.fullName || od.name) : 'Sin cristal OD'}</strong>
                        </div>
                        <span className="font-mono font-semibold text-secondary">{formatMoney(priceOD)}</span>
                      </div>
                      <div className="flex-between align-center">
                        <div>
                          <span className="badge-small bg-purple-soft text-purple font-bold mr-2">OI (Ojo Izquierdo)</span>
                          <strong className="text-white">{oi ? (oi.fullName || oi.name) : 'Sin cristal OI'}</strong>
                        </div>
                        <span className="font-mono font-semibold text-secondary">{formatMoney(priceOI)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Calibrado & Total Detail */}
                <div className="bg-dark-soft p-3 rounded-lg border border-color flex-between align-center flex-wrap gap-2">
                  <div>
                    <span className="font-xs text-muted block">Calibrado / Biselado</span>
                    <strong className="text-white">
                      {viewingJob.calibradoTipo} ({viewingJob.calibradoProceso || 'Stock'})
                    </strong>
                    {viewingJob.calibradoNombre && (
                      <span className="block font-xs text-secondary">{viewingJob.calibradoNombre}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-xs text-muted block">Costo Calibrado</span>
                    <strong className="font-mono text-white">{formatMoney(viewingJob.calibradoPrecio)}</strong>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-success-soft flex-between align-center" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                  <div>
                    <span className="font-xs text-secondary block">Estado del Trabajo: <strong>{viewingJob.estado || 'Pedido Lab'}</strong></span>
                    <strong className="text-white font-md">TOTAL DEL TRABAJO</strong>
                  </div>
                  <strong className="font-mono text-success" style={{ fontSize: '1.35rem' }}>
                    {formatMoney(viewingJob.precioTotal)}
                  </strong>
                </div>
              </div>

              <div className="flex-between align-center mt-4 pt-2 border-top">
                <span className="font-xs text-muted flex-align-center gap-1">
                  <Lock size={12} /> Vista de consulta segura (no modifica datos)
                </span>
                <div className="flex-align-center gap-2">
                  {!isClosed && onEditJob && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline text-primary border-primary flex-align-center gap-1"
                      onClick={() => {
                        const jobToEdit = viewingJob;
                        setViewingJob(null);
                        onEditJob(jobToEdit);
                      }}
                    >
                      <Edit size={14} /> Editar en Campaña Activa
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => setViewingJob(null)}
                  >
                    Cerrar Ficha
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
