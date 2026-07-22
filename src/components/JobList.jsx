import React, { useState } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { saveTrabajo, deleteTrabajo } from '../services/dataService';

export default function JobList({ campaign, jobs, localities, onEditJob, onJobsUpdated }) {
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'logistics'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocFilter, setSelectedLocFilter] = useState(() => localStorage.getItem('optica_last_localidad_id') || '');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  // Toggle status cycling
  const cycleStatus = async (job) => {
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

  // Change state directly
  const setJobStatus = async (job, newStatus) => {
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

  // Delete handler
  const handleDelete = async (jobId) => {
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
    
    const rows = jobs.map(job => [
      job.refCode,
      localities.find(l => l.id === job.localidadId)?.name || job.localidadId,
      job.paciente || 'S/D',
      job.cristalOD ? job.cristalOD.name : 'Pase / Ninguno',
      job.cristalOI ? job.cristalOI.name : 'Pase / Ninguno',
      job.calibradoTipo,
      job.calibradoPrecio,
      job.nroPedidoLab || 'S/D',
      job.precioTotal,
      job.estado,
      new Date(job.createdAt).toLocaleDateString('es-AR')
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `planila_trabajos_${campaign.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dispatch all 'Listo' jobs for a locality
  const dispatchAllForLocality = async (locId, locJobs) => {
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
    }).format(val);
  };

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    const loc = localities.find(l => l.id === job.localidadId);
    const locName = loc ? loc.name.toLowerCase() : '';
    const code = job.refCode.toLowerCase();
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

  // Grouping for Logistics
  const logisticsGroups = {};
  localities.forEach(loc => {
    logisticsGroups[loc.id] = {
      locality: loc,
      jobs: jobs.filter(j => j.localidadId === loc.id)
    };
  });

  // Helper to render state badges
  const renderStateBadge = (job) => {
    const state = job.estado || 'Pedido Lab';
    let badgeClass = 'badge-secondary';
    if (state === 'Sin Pedir') badgeClass = 'badge-danger-soft text-danger border-danger';
    if (state === 'Pedido Lab') badgeClass = 'badge-warning-soft text-warning border-warning';
    if (state === 'Listo') badgeClass = 'badge-info-soft text-info border-info';
    if (state === 'Enviado') badgeClass = 'badge-success-soft text-success border-success';

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
            
            {/* Locality Filter */}
            <select 
              className="form-control form-control-sm width-130"
              value={selectedLocFilter}
              onChange={(e) => setSelectedLocFilter(e.target.value)}
            >
              <option value="">Todas Localidades</option>
              {localities.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
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
                  <th width="120">Localidad</th>
                  <th>Paciente</th>
                  <th>Detalle de Lentes (OD / OI)</th>
                  <th width="140">Calibrado</th>
                  <th width="110">Pedido Lab</th>
                  <th width="110">Total Est.</th>
                  <th width="120">Estado</th>
                  <th width="80" className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map(job => {
                  const loc = localities.find(l => l.id === job.localidadId);
                  return (
                    <tr key={job.id} className={`status-row-${job.estado?.replace(/\s+/g, '')}`}>
                      <td>
                        <strong className="ref-badge">{job.refCode}</strong>
                      </td>
                      <td>
                        <div className="flex-align-center gap-1 font-sm">
                          <MapPin size={12} className="text-secondary" />
                          {loc?.name || job.localidadId}
                        </div>
                      </td>
                      <td>
                        <div className="font-semibold text-primary-dark">
                          {job.paciente || <span className="text-muted italic">S/D</span>}
                        </div>
                      </td>
                      <td>
                        <div className="lenses-cell">
                          {job.isPaseDeCristales ? (
                            <span className="badge-small bg-secondary-soft text-secondary">Pase de Cristales Propios</span>
                          ) : (
                            <>
                              <div className="lens-detail">
                                <span className="eye-lbl">OD:</span> 
                                <span className="lens-text" title={job.cristalOD?.name || ''}>
                                  {job.cristalOD ? `${job.cristalOD.name} (${formatMoney(job.cristalOD.price / 2)})` : <span className="text-muted">-</span>}
                                </span>
                              </div>
                              <div className="lens-detail">
                                <span className="eye-lbl">OI:</span> 
                                <span className="lens-text" title={job.cristalOI?.name || ''}>
                                  {job.cristalOI ? `${job.cristalOI.name} (${formatMoney(job.cristalOI.price / 2)})` : <span className="text-muted">-</span>}
                                </span>
                              </div>
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
                        <div key={j.id} className="job-logistic-badge">
                          <span className="ref-number">{j.refCode}</span>
                          <span className="patient-name">{j.paciente || 'S/D'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dispatch action button */}
                {readyJobs.length > 0 && (
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
              <p className="m-0">No hay trabajos registrados en la campaña actual.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
