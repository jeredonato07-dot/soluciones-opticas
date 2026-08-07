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
import { getPriceList, getCanonicalLens } from './PriceList';

function getCalibrationUnitPrice(cType, cProcess) {
  const priceList = getPriceList();
  let processStr = 'ORGANICO STOCK';
  if (cProcess === 'Laboratorio') {
    processStr = 'ORGANICO LABORATORIO';
  } else if (cProcess === 'Pase de Cristales') {
    processStr = 'PASE DE CRISTALES';
  }

  let typeStr = 'Montura Completa';
  if (cType === 'Ranurado') typeStr = 'Ranurado / Semi al Aire';
  if (cType === 'Perforado') typeStr = 'Perforado / Al Aire';

  const calProd = priceList.find(p => p.rawName && p.rawName.includes(processStr) && p.rawName.includes(typeStr));
  return calProd ? (calProd.price || 0) : 0;
}

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

  const priceList = getPriceList();

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
  const calibrationStats = {};
  
  // Lens types breakdown (Stock vs Laboratorio, in pairs)
  const lensStats = {
    'Stock': { count: 0, billing: 0 },
    'Laboratorio': { count: 0, billing: 0 }
  };

  // Consumed lenses detailed breakdown (by product name)
  const detailedLensStats = {};

  jobs.forEach(job => {
    // Calibrado
    const cType = (job.calibradoTipo || 'Aro Completo').replace(/\s*-\s*(1\/2\s*Par|Par)/gi, '').trim();
    const cProcess = (job.calibradoProceso || 'Stock').replace(/\s*-\s*(1\/2\s*Par|Par)/gi, '').trim();
    
    // Determine if it is a half-calibration (1 lens, not Pase de Cristales)
    const hasOD = !!job.cristalOD;
    const hasOI = !!job.cristalOI;
    const isSingleEye = (hasOD && !hasOI) || (!hasOD && hasOI);
    const isHalf = isSingleEye && (cProcess !== 'Pase de Cristales');
    
    const displayName = `${cType} (${cProcess})`;
    const calCount = isHalf ? 0.5 : 1.0;
    
    const basePrice = getCalibrationUnitPrice(cType, cProcess);
    
    if (!calibrationStats[displayName]) {
      calibrationStats[displayName] = { count: 0, billing: 0, unitPrice: basePrice };
    }
    calibrationStats[displayName].count += calCount;
    calibrationStats[displayName].billing += (job.calibradoPrecio !== undefined ? job.calibradoPrecio : (isHalf ? basePrice / 2 : basePrice));
    if (!calibrationStats[displayName].unitPrice && job.calibradoPrecio !== undefined) {
      calibrationStats[displayName].unitPrice = isHalf ? job.calibradoPrecio * 2 : job.calibradoPrecio;
    }

    // Cristales (OD + OI, priced at 50% per lens)
    if (job.cristalOD) {
      const canonical = getCanonicalLens(job.cristalOD, priceList);
      const type = canonical.type || job.cristalOD.type || 'Stock';
      if (lensStats[type]) {
        lensStats[type].count += 0.5; // Half a pair
        lensStats[type].billing += (canonical.price || job.cristalOD.price || 0) / 2;
      }

      const prodName = canonical.name;
      if (!detailedLensStats[prodName]) {
        detailedLensStats[prodName] = { 
          count: 0, 
          billing: 0,
          unitPrice: canonical.price || job.cristalOD.price || 0
        };
      }
      detailedLensStats[prodName].count += 0.5;
      detailedLensStats[prodName].billing += (canonical.price || job.cristalOD.price || 0) / 2;
      if (!detailedLensStats[prodName].unitPrice && (canonical.price || job.cristalOD.price)) {
        detailedLensStats[prodName].unitPrice = canonical.price || job.cristalOD.price;
      }
    }
    
    if (job.cristalOI) {
      const canonical = getCanonicalLens(job.cristalOI, priceList);
      const type = canonical.type || job.cristalOI.type || 'Stock';
      if (lensStats[type]) {
        lensStats[type].count += 0.5; // Half a pair
        lensStats[type].billing += (canonical.price || job.cristalOI.price || 0) / 2;
      }

      const prodName = canonical.name;
      if (!detailedLensStats[prodName]) {
        detailedLensStats[prodName] = { 
          count: 0, 
          billing: 0,
          unitPrice: canonical.price || job.cristalOI.price || 0
        };
      }
      detailedLensStats[prodName].count += 0.5;
      detailedLensStats[prodName].billing += (canonical.price || job.cristalOI.price || 0) / 2;
      if (!detailedLensStats[prodName].unitPrice && (canonical.price || job.cristalOI.price)) {
        detailedLensStats[prodName].unitPrice = canonical.price || job.cristalOI.price;
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

  const totalLensPairs = (lensStats['Stock']?.count || 0) + (lensStats['Laboratorio']?.count || 0);
  const totalLensUnits = totalLensPairs * 2;
  const totalCalibrationPairs = Object.values(calibrationStats).reduce((acc, curr) => acc + curr.count, 0);

  const totalLensBilling = Object.values(detailedLensStats).reduce((acc, curr) => {
    const unitPrice = curr.unitPrice || (curr.count > 0 ? curr.billing / curr.count : 0);
    return acc + (curr.count * unitPrice);
  }, 0);

  const totalCalibrationBilling = Object.values(calibrationStats).reduce((acc, curr) => {
    const unitPrice = curr.unitPrice || (curr.count > 0 ? curr.billing / curr.count : 0);
    return acc + (curr.count * unitPrice);
  }, 0);

  const paseDeCristalesCount = Math.max(0, totalCalibrationPairs - totalLensPairs);

  const formatMoney = (val) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(val);
  };

  const formatPairs = (val) => {
    if (val === undefined || val === null) return '0';
    return Number.isInteger(val) ? val.toString() : val.toFixed(1);
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
      <div className="grid-5 mb-4">
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
          <div className="stat-icon bg-purple-soft">
            <Eye size={24} className="text-purple" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Cristales Consumidos</span>
            <h3 className="stat-value">{formatPairs(totalLensUnits)} <span className="font-xs text-muted font-normal">({formatPairs(totalLensPairs)} pares)</span></h3>
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

      {/* Resumen Comparativo de Facturación y Unidades */}
      <div className="glass-card p-3 mb-4 bg-dark-soft border border-primary-soft">
        <div className="flex-between align-center flex-wrap gap-3">
          <div className="flex-align-center gap-3 flex-wrap">
            <div className="badge-small bg-primary text-white font-mono font-bold px-2 py-1">
              RESUMEN FINANCIERO DE UNIDADES
            </div>
            <div className="flex-align-center gap-3 font-sm flex-wrap">
              <span><strong>Trabajos:</strong> {totalJobs}</span>
              <span className="text-muted">|</span>
              <span><strong>Cristales:</strong> {formatPairs(totalLensPairs)} pares ({formatMoney(totalLensBilling)})</span>
              <span className="text-muted">|</span>
              <span><strong>Calibrados:</strong> {formatPairs(totalCalibrationPairs)} pares ({formatMoney(totalCalibrationBilling)})</span>
            </div>
          </div>
          {paseDeCristalesCount > 0 && (
            <span className="badge-small bg-warning-soft text-warning font-xs" title="Trabajos con solo cobro de calibrado / armado">
              ℹ️ {formatPairs(paseDeCristalesCount)} par(es) con Pase de Cristales / Armado (sin venta de cristales)
            </span>
          )}
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
                          style={{ width: `${(loc.pedido / loc.total) * 100}%` }}
                          title={`Pedido Lab: ${loc.pedido}`}
                        />
                        <div 
                          className="progress-segment bg-danger" 
                          style={{ width: `${(loc.sinPedir / loc.total) * 100}%` }}
                          title={`Sin Pedir (❌ NO Encargado): ${loc.sinPedir}`}
                        />
                      </div>
                    </div>
                    
                    <div className="flex-align-center gap-3 mt-1 flex-wrap">
                      {loc.sinPedir > 0 && (
                        <span className="badge-dot text-danger font-xs">
                          <span className="dot bg-danger"></span> {loc.sinPedir} Sin Pedir
                        </span>
                      )}
                      {loc.pedido > 0 && (
                        <span className="badge-dot text-warning font-xs">
                          <span className="dot bg-warning"></span> {loc.pedido} Pedido Lab
                        </span>
                      )}
                      {loc.listo > 0 && (
                        <span className="badge-dot text-info font-xs">
                          <span className="dot bg-info"></span> {loc.listo} Listo
                        </span>
                      )}
                      {loc.enviado > 0 && (
                        <span className="badge-dot text-success font-xs">
                          <span className="dot bg-success"></span> {loc.enviado} Enviado
                        </span>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Totals & Billing breakdown */}
        <div className="glass-card p-4 flex-column gap-4">
          <div>
            <div className="flex-between align-center mb-3">
              <h3 className="m-0 flex-align-center gap-2">
                <Layers size={20} className="text-primary" />
                Consumo de Cristales Detallado
              </h3>
              <span className="badge-small bg-primary-soft text-primary font-mono font-medium">
                Total: {formatPairs(totalLensPairs)} pares ({formatPairs(totalLensUnits)} u.)
              </span>
            </div>
            <div className="table-xs">
              <div className="table-xs-row cols-4 header">
                <div>Producto</div>
                <div className="text-right">Precio Par</div>
                <div className="text-right">Pares</div>
                <div className="text-right">Total Est.</div>
              </div>
              {Object.keys(detailedLensStats).length === 0 ? (
                <div className="text-secondary small text-center py-2">No hay cristales consumidos.</div>
              ) : (
                Object.entries(detailedLensStats)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([name, stats], index) => {
                    const unitPrice = stats.unitPrice || (stats.count > 0 ? stats.billing / stats.count : 0);
                    const rowTotal = stats.count * unitPrice;
                    return (
                      <div key={name} className="table-xs-row cols-4">
                        <div className="font-semibold flex-align-center gap-1">
                          {name}
                          {index === 0 && (
                            <span className="badge-small bg-success-soft text-success font-xs ml-1" title="Producto más consumido">
                              #1 Más Usado
                            </span>
                          )}
                        </div>
                        <div className="text-right font-medium text-secondary">{formatMoney(unitPrice)}</div>
                        <div className="text-right font-medium">{formatPairs(stats.count)}</div>
                        <div className="text-right font-medium">{formatMoney(rowTotal)}</div>
                      </div>
                    );
                  })
              )}
              {Object.keys(detailedLensStats).length > 0 && (
                <div className="table-xs-row cols-4 footer">
                  <div className="font-bold">TOTAL CRISTALES</div>
                  <div className="text-right text-muted">-</div>
                  <div className="text-right font-bold">{formatPairs(totalLensPairs)}</div>
                  <div className="text-right font-bold">{formatMoney(totalLensBilling)}</div>
                </div>
              )}
            </div>
          </div>

          <div className="divider"></div>

          <div>
            <div className="flex-between align-center mb-3">
              <h3 className="m-0 flex-align-center gap-2">
                <TrendingUp size={20} className="text-primary" />
                Detalle de Calibrados
              </h3>
              <span className="badge-small bg-info-soft text-info font-mono font-medium">
                Total: {formatPairs(totalCalibrationPairs)} pares
              </span>
            </div>
             <div className="table-xs">
               <div className="table-xs-row cols-4 header">
                 <div>Calibrado</div>
                 <div className="text-right">Precio Par</div>
                 <div className="text-right">Pares</div>
                 <div className="text-right">Total Est.</div>
               </div>
               {Object.entries(calibrationStats)
                 .sort((a, b) => b[1].count - a[1].count)
                 .map(([name, stats]) => {
                   const unitPrice = stats.unitPrice || (stats.count > 0 ? stats.billing / stats.count : 0);
                   const rowTotal = stats.count * unitPrice;
                   return (
                     <div key={name} className="table-xs-row cols-4">
                       <div className="font-semibold">{name}</div>
                       <div className="text-right font-medium text-secondary">{formatMoney(unitPrice)}</div>
                       <div className="text-right font-medium">{formatPairs(stats.count)}</div>
                       <div className="text-right font-medium">{formatMoney(rowTotal)}</div>
                     </div>
                   );
                 })}
               {Object.keys(calibrationStats).length > 0 && (
                 <div className="table-xs-row cols-4 footer">
                   <div className="font-bold">TOTAL CALIBRADOS</div>
                   <div className="text-right text-muted">-</div>
                   <div className="text-right font-bold">{formatPairs(totalCalibrationPairs)}</div>
                   <div className="text-right font-bold">{formatMoney(totalCalibrationBilling)}</div>
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
