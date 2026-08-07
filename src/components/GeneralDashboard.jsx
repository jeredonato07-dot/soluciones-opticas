import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Eye, 
  TrendingUp, 
  MapPin, 
  Layers, 
  FileText, 
  Filter, 
  Award, 
  Briefcase, 
  Calendar,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { getPriceList, getCanonicalLens } from './PriceList';
import { subscribeCampanas, subscribeAllJobs } from '../services/dataService';

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

export default function GeneralDashboard({ localities, onSelectCampaign }) {
  const [campaigns, setCampaigns] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [filterMode, setFilterMode] = useState('cerradas'); // 'cerradas' or 'todas'

  useEffect(() => {
    const unsubCamp = subscribeCampanas(setCampaigns);
    const unsubJobs = subscribeAllJobs(setAllJobs);
    return () => {
      unsubCamp();
      unsubJobs();
    };
  }, []);

  const priceList = getPriceList();

  const formatMoney = (val) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(val || 0);
  };

  const formatPairs = (val) => {
    if (val === undefined || val === null) return '0';
    return Number.isInteger(val) ? val.toString() : val.toFixed(1);
  };

  // Filter campaigns according to selected mode
  const filteredCampaigns = campaigns.filter(c => {
    if (filterMode === 'cerradas') return c.status === 'cerrada';
    return true;
  });

  const campaignIdsSet = new Set(filteredCampaigns.map(c => c.id));
  const filteredJobs = allJobs.filter(j => campaignIdsSet.has(j.campanaId));

  // --- CALCULATE GLOBAL STATS ---
  const detailedLensStats = {};
  const calibrationStats = {};
  const localityStats = {};

  localities.forEach(loc => {
    localityStats[loc.id] = { name: loc.name, code: loc.code, jobsCount: 0, billing: 0 };
  });

  // Calculate per campaign breakdowns
  const campaignBreakdowns = filteredCampaigns.map(camp => {
    const campJobs = filteredJobs.filter(j => j.campanaId === camp.id);
    const campLensStats = {};
    const campCalibrationStats = {};

    campJobs.forEach(job => {
      // Localities
      if (localityStats[job.localidadId]) {
        localityStats[job.localidadId].jobsCount++;
      }

      // Calibrado
      const cType = (job.calibradoTipo || 'Aro Completo').replace(/\s*-\s*(1\/2\s*Par|Par)/gi, '').trim();
      const cProcess = (job.calibradoProceso || 'Stock').replace(/\s*-\s*(1\/2\s*Par|Par)/gi, '').trim();
      
      const hasOD = !!job.cristalOD;
      const hasOI = !!job.cristalOI;
      const isSingleEye = (hasOD && !hasOI) || (!hasOD && hasOI);
      const isHalf = isSingleEye && (cProcess !== 'Pase de Cristales');
      
      const displayName = `${cType} (${cProcess})`;
      const calCount = isHalf ? 0.5 : 1.0;
      const basePrice = getCalibrationUnitPrice(cType, cProcess);
      
      const calibPrice = job.calibradoPrecio !== undefined ? job.calibradoPrecio : (isHalf ? basePrice / 2 : basePrice);
      const calibUnitPrice = (isHalf ? calibPrice * 2 : calibPrice) || basePrice;

      if (!campCalibrationStats[displayName]) {
        campCalibrationStats[displayName] = { count: 0, billing: 0, unitPrice: basePrice };
      }
      campCalibrationStats[displayName].count += calCount;
      campCalibrationStats[displayName].billing += calibPrice;
      if (!campCalibrationStats[displayName].unitPrice && job.calibradoPrecio !== undefined) {
        campCalibrationStats[displayName].unitPrice = calibUnitPrice;
      }

      // Global Calibrations aggregation
      if (!calibrationStats[displayName]) {
        calibrationStats[displayName] = { count: 0, billing: 0, unitPrice: basePrice };
      }
      calibrationStats[displayName].count += calCount;
      calibrationStats[displayName].billing += calibPrice;
      if (!calibrationStats[displayName].unitPrice && job.calibradoPrecio !== undefined) {
        calibrationStats[displayName].unitPrice = calibUnitPrice;
      }

      // Cristales OD
      if (job.cristalOD) {
        const canonical = getCanonicalLens(job.cristalOD, priceList);
        const prodName = canonical.name;
        const uPrice = canonical.price || job.cristalOD.price || 0;

        if (!campLensStats[prodName]) {
          campLensStats[prodName] = { count: 0, billing: 0, unitPrice: uPrice };
        }
        campLensStats[prodName].count += 0.5;
        campLensStats[prodName].billing += uPrice / 2;
        if (!campLensStats[prodName].unitPrice && uPrice) {
          campLensStats[prodName].unitPrice = uPrice;
        }

        // Global detailedLensStats
        if (!detailedLensStats[prodName]) {
          detailedLensStats[prodName] = { count: 0, billing: 0, unitPrice: uPrice };
        }
        detailedLensStats[prodName].count += 0.5;
        detailedLensStats[prodName].billing += uPrice / 2;
        if (!detailedLensStats[prodName].unitPrice && uPrice) {
          detailedLensStats[prodName].unitPrice = uPrice;
        }
      }

      // Cristales OI
      if (job.cristalOI) {
        const canonical = getCanonicalLens(job.cristalOI, priceList);
        const prodName = canonical.name;
        const uPrice = canonical.price || job.cristalOI.price || 0;

        if (!campLensStats[prodName]) {
          campLensStats[prodName] = { count: 0, billing: 0, unitPrice: uPrice };
        }
        campLensStats[prodName].count += 0.5;
        campLensStats[prodName].billing += uPrice / 2;
        if (!campLensStats[prodName].unitPrice && uPrice) {
          campLensStats[prodName].unitPrice = uPrice;
        }

        // Global detailedLensStats
        if (!detailedLensStats[prodName]) {
          detailedLensStats[prodName] = { count: 0, billing: 0, unitPrice: uPrice };
        }
        detailedLensStats[prodName].count += 0.5;
        detailedLensStats[prodName].billing += uPrice / 2;
        if (!detailedLensStats[prodName].unitPrice && uPrice) {
          detailedLensStats[prodName].unitPrice = uPrice;
        }
      }
    });

    const lensPairs = Object.values(campLensStats).reduce((acc, curr) => acc + curr.count, 0);
    const calibPairs = Object.values(campCalibrationStats).reduce((acc, curr) => acc + curr.count, 0);

    const lensBilling = Object.values(campLensStats).reduce((acc, curr) => {
      const unitPrice = curr.unitPrice || (curr.count > 0 ? curr.billing / curr.count : 0);
      return acc + (curr.count * unitPrice);
    }, 0);

    const calibBilling = Object.values(campCalibrationStats).reduce((acc, curr) => {
      const unitPrice = curr.unitPrice || (curr.count > 0 ? curr.billing / curr.count : 0);
      return acc + (curr.count * unitPrice);
    }, 0);

    return {
      campaign: camp,
      jobsCount: campJobs.length,
      lensPairs,
      lensBilling,
      calibPairs,
      calibBilling,
      totalBilling: lensBilling + calibBilling
    };
  });

  const totalJobsCount = campaignBreakdowns.reduce((acc, curr) => acc + curr.jobsCount, 0);
  const totalGlobalLensPairs = campaignBreakdowns.reduce((acc, curr) => acc + curr.lensPairs, 0);
  const totalGlobalLensUnits = totalGlobalLensPairs * 2;
  const totalGlobalLensBilling = campaignBreakdowns.reduce((acc, curr) => acc + curr.lensBilling, 0);
  const totalGlobalCalibPairs = campaignBreakdowns.reduce((acc, curr) => acc + curr.calibPairs, 0);
  const totalGlobalCalibBilling = campaignBreakdowns.reduce((acc, curr) => acc + curr.calibBilling, 0);
  const totalGlobalBilling = totalGlobalLensBilling + totalGlobalCalibBilling;

  if (typeof window !== 'undefined') {
    window.genStats = { detailedLensStats, totalGlobalLensBilling, totalGlobalCalibBilling, totalGlobalBilling, campaignBreakdowns };
  }

  return (
    <div className="dashboard-container">
      {/* Header with Filter Toggle */}
      <div className="flex-between align-center flex-wrap gap-3 mb-4">
        <div>
          <span className="badge badge-info mb-2 flex-align-center gap-1 width-fit">
            <BarChart3 size={14} /> Control General de Sociedad
          </span>
          <h2 className="m-0">Métricas Históricas y Consolidado</h2>
          <p className="text-secondary m-0">Consolidado contable de productos, calibrados y facturación de la empresa.</p>
        </div>

        {/* Filter mode Selector */}
        <div className="glass-card p-2 flex-align-center gap-2">
          <Filter size={16} className="text-muted ml-2" />
          <button 
            className={`btn btn-sm ${filterMode === 'cerradas' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterMode('cerradas')}
          >
            Solo Campañas Cerradas ({campaigns.filter(c => c.status === 'cerrada').length})
          </button>
          <button 
            className={`btn btn-sm ${filterMode === 'todas' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterMode('todas')}
          >
            Todas las Campañas ({campaigns.length})
          </button>
        </div>
      </div>

      {/* Global Stat Cards */}
      <div className="grid-5 mb-4">
        <div className="stat-card glass-card">
          <div className="stat-icon bg-primary-soft">
            <DollarSign size={24} className="text-primary" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Facturación Acumulada</span>
            <h3 className="stat-value">{formatMoney(totalGlobalBilling)}</h3>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon bg-info-soft">
            <FileText size={24} className="text-info" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Trabajos Totales</span>
            <h3 className="stat-value">{totalJobsCount}</h3>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon bg-purple-soft">
            <Eye size={24} className="text-purple" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Cristales Consumidos</span>
            <h3 className="stat-value">{formatPairs(totalGlobalLensUnits)} <span className="font-xs text-muted font-normal">({formatPairs(totalGlobalLensPairs)} pares)</span></h3>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon bg-success-soft">
            <TrendingUp size={24} className="text-success" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Calibrados Realizados</span>
            <h3 className="stat-value">{formatPairs(totalGlobalCalibPairs)} <span className="font-xs text-muted font-normal">pares</span></h3>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon bg-warning-soft">
            <Briefcase size={24} className="text-warning" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Campañas Seleccionadas</span>
            <h3 className="stat-value">{filteredCampaigns.length}</h3>
          </div>
        </div>
      </div>

      {/* Resumen de Unidades y Facturación */}
      <div className="glass-card p-3 mb-4 bg-dark-soft border border-primary-soft">
        <div className="flex-between align-center flex-wrap gap-3">
          <div className="flex-align-center gap-3 flex-wrap">
            <div className="badge-small bg-primary text-white font-mono font-bold px-2 py-1">
              DESGLOSE GLOBAL DE SOCIEDAD
            </div>
            <div className="flex-align-center gap-3 font-sm flex-wrap">
              <span><strong>Trabajos Historicos:</strong> {totalJobsCount}</span>
              <span className="text-muted">|</span>
              <span><strong>Facturación Cristales:</strong> {formatMoney(totalGlobalLensBilling)} ({formatPairs(totalGlobalLensPairs)} pares)</span>
              <span className="text-muted">|</span>
              <span><strong>Facturación Calibrados:</strong> {formatMoney(totalGlobalCalibBilling)} ({formatPairs(totalGlobalCalibPairs)} pares)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Campaigns Table vs Detailed Rankings */}
      <div className="grid-2-1 mb-4">
        {/* Left Column: Campaigns Comparative Breakdown */}
        <div className="glass-card p-4">
          <div className="flex-between align-center mb-3">
            <h3 className="m-0 flex-align-center gap-2">
              <Calendar size={20} className="text-primary" />
              Comparativa por Campaña ({filteredCampaigns.length})
            </h3>
          </div>

          {campaignBreakdowns.length === 0 ? (
            <div className="p-5 text-center text-secondary">
              <Briefcase size={48} className="mb-2 text-muted" />
              <p className="m-0">No hay campañas que coincidan con el filtro seleccionado.</p>
            </div>
          ) : (
            <div className="table-responsive overflow-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>Campaña</th>
                    <th className="text-center">Estado</th>
                    <th className="text-right">Trabajos</th>
                    <th className="text-right">Pares Cristales</th>
                    <th className="text-right">Pares Calibrados</th>
                    <th className="text-right">Facturación Total</th>
                    <th className="text-center">Ver</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignBreakdowns.map(({ campaign: camp, jobsCount, lensPairs, calibPairs, totalBilling: campBilling }) => (
                    <tr key={camp.id}>
                      <td>
                        <strong className="block">{camp.name}</strong>
                        <span className="text-muted font-xs">
                          {new Date(camp.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className={`badge-small ${camp.status === 'activa' ? 'bg-success-soft text-success' : 'bg-secondary-soft text-secondary'}`}>
                          {camp.status === 'activa' ? 'Activa' : 'Cerrada'}
                        </span>
                      </td>
                      <td className="text-right font-mono font-medium">{jobsCount}</td>
                      <td className="text-right font-mono font-medium">{formatPairs(lensPairs)}</td>
                      <td className="text-right font-mono font-medium">{formatPairs(calibPairs)}</td>
                      <td className="text-right font-mono font-bold text-success">{formatMoney(campBilling)}</td>
                      <td className="text-center">
                        <button 
                          className="btn-icon" 
                          onClick={() => onSelectCampaign && onSelectCampaign(camp)}
                          title="Inspeccionar esta campaña en el Dashboard"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Historical Crystal Product & Calibration Rankings */}
        <div className="glass-card p-4 flex-column gap-4">
          {/* Ranking Cristales */}
          <div>
            <div className="flex-between align-center mb-3">
              <h3 className="m-0 flex-align-center gap-2">
                <Award size={20} className="text-primary" />
                Ranking de Cristales Consumidos
              </h3>
            </div>
            <div className="table-xs">
              <div className="table-xs-row cols-4 header">
                <div>Producto</div>
                <div className="text-right">Precio Par</div>
                <div className="text-right">Pares</div>
                <div className="text-right">Total Est.</div>
              </div>
              {Object.keys(detailedLensStats).length === 0 ? (
                <div className="text-secondary small text-center py-2">No hay cristales registrados.</div>
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
                            <span className="badge-small bg-success-soft text-success font-xs ml-1" title="Producto más consumido históricamente">
                              #1 Más Vendido
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
                  <div className="font-bold">TOTAL HISTÓRICO</div>
                  <div className="text-right text-muted">-</div>
                  <div className="text-right font-bold">{formatPairs(totalGlobalLensPairs)}</div>
                  <div className="text-right font-bold">{formatMoney(totalGlobalLensBilling)}</div>
                </div>
              )}
            </div>
          </div>

          <div className="divider"></div>

          {/* Calibrados Global */}
          <div>
            <div className="flex-between align-center mb-3">
              <h3 className="m-0 flex-align-center gap-2">
                <Layers size={20} className="text-primary" />
                Ranking de Calibrados Ejecutados
              </h3>
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
                  <div className="font-bold">TOTAL HISTÓRICO</div>
                  <div className="text-right text-muted">-</div>
                  <div className="text-right font-bold">{formatPairs(totalGlobalCalibPairs)}</div>
                  <div className="text-right font-bold">{formatMoney(totalGlobalCalibBilling)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
