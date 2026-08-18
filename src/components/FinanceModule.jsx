import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Wallet, 
  PieChart, 
  Plus, 
  Trash2, 
  Download, 
  Users, 
  Tag, 
  Calendar, 
  FileText, 
  AlertTriangle, 
  CheckCircle,
  Truck,
  Package,
  Eye,
  CreditCard,
  Briefcase
} from 'lucide-react';
import { getPriceList, getCanonicalLens } from './PriceList';
import { subscribeCampanas, subscribeAllJobs, subscribeGastos, subscribeAllGastos, saveGasto, deleteGasto } from '../services/dataService';

// Categorías de gastos predeterminadas
const GASTO_CATEGORIAS = [
  { id: 'logistica', label: 'Logística y Fletes', icon: Truck, desc: 'Comisionistas, cadetes, envíos, nafta', color: '#3b82f6' },
  { id: 'insumos', label: 'Insumos y Embalaje', icon: Package, desc: 'Cajas, cintas, sobres, franelas, estuches', color: '#8b5cf6' },
  { id: 'mermas', label: 'Cristales Rotos / Pérdidas', icon: Eye, desc: 'Roturas de taller, mermas, reposiciones', color: '#ef4444' },
  { id: 'operativos', label: 'Operativos y Viáticos', icon: CreditCard, desc: 'Estacionamiento, peajes, comidas de viaje', color: '#f59e0b' },
  { id: 'varios', label: 'Varios / Otros', icon: Briefcase, desc: 'Gastos administrativos y varios', color: '#10b981' }
];

const SOCIOS = [
  { id: 'Jere', name: 'Jere', color: 'badge-primary' },
  { id: 'Isa', name: 'Isa', color: 'badge-purple' },
  { id: 'Caja', name: 'Caja / Sociedad', color: 'badge-success' }
];

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

export default function FinanceModule({ activeCampaign, onSelectCampaign }) {
  const [campaigns, setCampaigns] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [selectedCampId, setSelectedCampId] = useState(activeCampaign ? activeCampaign.id : 'todas');
  const [gastos, setGastos] = useState([]);
  
  // Form State
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('logistica');
  const [pagadoPor, setPagadoPor] = useState('Jere');
  const [observacion, setObservacion] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters State
  const [filterPagador, setFilterPagador] = useState('todos');
  const [filterCategoria, setFilterCategoria] = useState('todas');

  // Subscriptions
  useEffect(() => {
    const unsubCamp = subscribeCampanas(setCampaigns);
    const unsubJobs = subscribeAllJobs(setAllJobs);
    return () => {
      unsubCamp();
      unsubJobs();
    };
  }, []);

  // Update selectedCampId if activeCampaign changes and wasn't manually set
  useEffect(() => {
    if (activeCampaign && selectedCampId === 'todas') {
      setSelectedCampId(activeCampaign.id);
    }
  }, [activeCampaign]);

  // Subscribe to gastos for selected campaign (or all)
  useEffect(() => {
    if (selectedCampId === 'todas') {
      const unsub = subscribeAllGastos(setGastos);
      return () => unsub();
    } else {
      const unsub = subscribeGastos(selectedCampId, setGastos);
      return () => unsub();
    }
  }, [selectedCampId]);

  const priceList = getPriceList();

  const formatMoney = (val) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(val || 0);
  };

  // Resolve current selected campaign object
  const currentCampaign = selectedCampId === 'todas' 
    ? { id: 'todas', name: 'Consolidado Global de Todas las Campañas', status: 'global' }
    : campaigns.find(c => c.id === selectedCampId) || activeCampaign || { id: '', name: 'Campaña Desconocida' };

  // Calculate Gross Billing for the selected scope
  const filteredJobs = selectedCampId === 'todas' 
    ? allJobs 
    : allJobs.filter(j => j.campanaId === selectedCampId);

  // Calculate Exact Billing using same formula as Dashboard
  const detailedLensStats = {};
  const calibrationStats = {};

  filteredJobs.forEach(job => {
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

  const totalLensBilling = Object.values(detailedLensStats).reduce((acc, curr) => {
    const unitPrice = curr.unitPrice || (curr.count > 0 ? curr.billing / curr.count : 0);
    return acc + (curr.count * unitPrice);
  }, 0);

  const totalCalibrationBilling = Object.values(calibrationStats).reduce((acc, curr) => {
    const unitPrice = curr.unitPrice || (curr.count > 0 ? curr.billing / curr.count : 0);
    return acc + (curr.count * unitPrice);
  }, 0);

  const totalFacturacionBruta = totalLensBilling + totalCalibrationBilling;

  // --- CALCULATE EXPENSES TOTALS ---
  const totalGastos = gastos.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
  const gananciaNeta = totalFacturacionBruta - totalGastos;
  const margenPorcentaje = totalFacturacionBruta > 0 ? ((gananciaNeta / totalFacturacionBruta) * 100).toFixed(1) : '0';

  // Por socio
  const gastoJere = gastos.filter(g => g.pagadoPor === 'Jere').reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
  const gastoIsa = gastos.filter(g => g.pagadoPor === 'Isa').reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
  const gastoCaja = gastos.filter(g => g.pagadoPor === 'Caja').reduce((acc, g) => acc + (Number(g.monto) || 0), 0);

  // Balance entre socios (compensación de aportes personales)
  const diferenciaAportes = gastoJere - gastoIsa;
  const mitadDiferencia = Math.abs(diferenciaAportes) / 2;

  // Gastos por categoría
  const gastosPorCategoria = GASTO_CATEGORIAS.map(cat => {
    const totalCat = gastos.filter(g => g.categoria === cat.id).reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
    const porcentaje = totalGastos > 0 ? ((totalCat / totalGastos) * 100).toFixed(1) : 0;
    return { ...cat, total: totalCat, porcentaje };
  });

  // Handle Save Gasto
  const handleSaveGasto = async (e) => {
    e.preventDefault();
    const numMonto = parseFloat(monto);
    if (!numMonto || numMonto <= 0) {
      alert("Por favor ingresa un monto válido mayor a 0.");
      return;
    }

    if (selectedCampId === 'todas' && !activeCampaign) {
      alert("Por favor selecciona una campaña específica para asignar el gasto.");
      return;
    }

    const targetCampId = selectedCampId === 'todas' ? activeCampaign.id : selectedCampId;

    try {
      setIsSubmitting(true);
      await saveGasto({
        campanaId: targetCampId,
        monto: numMonto,
        categoria,
        pagadoPor,
        observacion: observacion.trim(),
        fecha
      });

      // Reset form
      setMonto('');
      setObservacion('');
    } catch (err) {
      console.error(err);
      alert("Error al guardar el gasto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Gasto
  const handleDeleteGasto = async (gasto) => {
    if (window.confirm(`¿Estás seguro de eliminar el gasto "${gasto.observacion || gasto.categoria}" por ${formatMoney(gasto.monto)}?`)) {
      try {
        await deleteGasto(gasto.id, gasto.campanaId);
      } catch (err) {
        console.error(err);
        alert("Error al eliminar el gasto.");
      }
    }
  };

  // Export Gastos to CSV
  const handleExportCSV = () => {
    if (gastos.length === 0) return;
    const headers = ['Fecha', 'Campaña', 'Categoría', 'Pagado Por', 'Observación / Detalle', 'Monto'];
    const rows = gastos.map(g => [
      g.fecha ? new Date(g.fecha).toLocaleDateString('es-AR') : '',
      campaigns.find(c => c.id === g.campanaId)?.name || g.campanaId,
      GASTO_CATEGORIAS.find(c => c.id === g.categoria)?.label || g.categoria,
      g.pagadoPor,
      g.observacion || 'Sin detalle',
      g.monto
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gastos_${currentCampaign.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Gastos List
  const displayedGastos = gastos.filter(g => {
    const matchPagador = filterPagador === 'todos' ? true : g.pagadoPor === filterPagador;
    const matchCat = filterCategoria === 'todas' ? true : g.categoria === filterCategoria;
    return matchPagador && matchCat;
  });

  return (
    <div className="dashboard-container">
      {/* Header with Campaign Switcher */}
      <div className="flex-between align-center flex-wrap gap-3 mb-4">
        <div>
          <span className="badge badge-purple mb-2 flex-align-center gap-1 width-fit">
            <Wallet size={14} /> Módulo Financiero y Sociedad
          </span>
          <h2 className="m-0">Finanzas, Gastos y Balance de Sociedad</h2>
          <p className="text-secondary m-0">Control de egresos, rentabilidad neta y rendición de cuentas entre Isa y Jere.</p>
        </div>

        {/* Campaign Filter Selector */}
        <div className="glass-card p-2 flex-align-center gap-2">
          <Calendar size={16} className="text-muted ml-2" />
          <span className="font-xs text-secondary font-semibold">Campaña:</span>
          <select 
            className="form-control form-control-sm"
            style={{ minWidth: '220px', background: 'var(--bg-dark-soft)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
            value={selectedCampId}
            onChange={(e) => setSelectedCampId(e.target.value)}
          >
            {activeCampaign && (
              <option value={activeCampaign.id}>
                🟢 {activeCampaign.name} (Activa)
              </option>
            )}
            <option value="todas">🌐 Todas las Campañas (Consolidado Global)</option>
            {campaigns
              .filter(c => !activeCampaign || c.id !== activeCampaign.id)
              .map(camp => (
                <option key={camp.id} value={camp.id}>
                  {camp.status === 'cerrada' ? '🔒' : '📁'} {camp.name} ({camp.status === 'cerrada' ? 'Cerrada' : 'Activa'})
                </option>
              ))
            }
          </select>
        </div>
      </div>

      {/* Scope Context Banner */}
      <div 
        className={`p-3 mb-4 rounded-lg flex-between align-center flex-wrap gap-2 border ${
          currentCampaign.status === 'cerrada' 
            ? 'border-warning-soft' 
            : currentCampaign.status === 'global' 
              ? 'border-info-soft' 
              : 'border-success-soft'
        }`}
        style={{
          background: currentCampaign.status === 'cerrada'
            ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(22, 28, 45, 0.95) 100%)'
            : currentCampaign.status === 'global'
              ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(22, 28, 45, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(22, 28, 45, 0.95) 100%)'
        }}
      >
        <div className="flex-align-center gap-2">
          <span className="font-lg">
            {currentCampaign.status === 'cerrada' ? '🔒' : currentCampaign.status === 'global' ? '🌐' : '🟢'}
          </span>
          <span className="text-white font-semibold">
            Visualizando Finanzas de: <strong>{currentCampaign.name}</strong>
          </span>
        </div>
        <span className="text-secondary font-xs font-mono">
          {filteredJobs.length} Trabajos • {gastos.length} Gastos Registrados
        </span>
      </div>

      {/* Top 5 Financial Metric Cards */}
      <div className="grid-5 mb-4">
        {/* Facturación Bruta */}
        <div className="stat-card glass-card border border-primary-soft">
          <div className="stat-icon bg-primary-soft">
            <DollarSign size={24} className="text-primary" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Facturación Bruta</span>
            <h3 className="stat-value text-primary">{formatMoney(totalFacturacionBruta)}</h3>
          </div>
        </div>

        {/* Gastos Totales */}
        <div className="stat-card glass-card border border-danger-soft">
          <div className="stat-icon bg-danger-soft">
            <TrendingUp size={24} className="text-danger" style={{ transform: 'rotate(180deg)' }} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Gastos Totales</span>
            <h3 className="stat-value text-danger">{formatMoney(totalGastos)}</h3>
          </div>
        </div>

        {/* Ganancia Neta Real */}
        <div className="stat-card glass-card border border-success-soft" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(22, 28, 45, 0.85) 100%)' }}>
          <div className="stat-icon bg-success-soft">
            <CheckCircle size={24} className="text-success" />
          </div>
          <div className="stat-info">
            <span className="stat-label flex-align-center gap-1">
              Ganancia Neta Real
              <span className="badge-small bg-success text-white font-xs px-1 rounded">{margenPorcentaje}%</span>
            </span>
            <h3 className="stat-value text-success font-extrabold">{formatMoney(gananciaNeta)}</h3>
          </div>
        </div>

        {/* Aportado por Jere */}
        <div className="stat-card glass-card border border-info-soft">
          <div className="stat-icon bg-info-soft">
            <Users size={24} className="text-info" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Aportado por Jere</span>
            <h3 className="stat-value text-info">{formatMoney(gastoJere)}</h3>
          </div>
        </div>

        {/* Aportado por Isa */}
        <div className="stat-card glass-card border border-purple-soft">
          <div className="stat-icon bg-purple-soft">
            <Users size={24} className="text-purple" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Aportado por Isa</span>
            <h3 className="stat-value text-purple">{formatMoney(gastoIsa)}</h3>
          </div>
        </div>
      </div>

      {/* Rendición de Cuentas y Reparto entre Socios */}
      <div className="glass-card p-4 mb-4 border border-color" style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(15, 20, 34, 0.95) 100%)' }}>
        <div className="flex-between align-center flex-wrap gap-2 mb-3 border-bottom pb-2">
          <h3 className="m-0 flex-align-center gap-2">
            <Users size={20} className="text-purple" />
            Rendición de Cuentas y Reparto de Sociedad (Isa & Jere)
          </h3>
          <span className="badge-small bg-purple-soft text-purple font-mono font-medium">
            Reparto 50 / 50
          </span>
        </div>

        <div className="grid-3 gap-4 font-sm">
          {/* Card Jere */}
          <div className="glass-card p-3 bg-dark-soft border border-info-soft rounded-lg">
            <div className="flex-between align-center mb-2">
              <span className="font-semibold text-info flex-align-center gap-1">
                <span className="dot bg-info"></span> Jere
              </span>
              <span className="text-muted font-xs">Aporte de Bolsillo</span>
            </div>
            <h4 className="m-0 text-white font-bold text-lg">{formatMoney(gastoJere)}</h4>
            <p className="text-secondary font-xs m-0 mt-1">
              En logística, envíos y gastos varios.
            </p>
          </div>

          {/* Card Isa */}
          <div className="glass-card p-3 bg-dark-soft border border-purple-soft rounded-lg">
            <div className="flex-between align-center mb-2">
              <span className="font-semibold text-purple flex-align-center gap-1">
                <span className="dot bg-purple"></span> Isa
              </span>
              <span className="text-muted font-xs">Aporte de Bolsillo</span>
            </div>
            <h4 className="m-0 text-white font-bold text-lg">{formatMoney(gastoIsa)}</h4>
            <p className="text-secondary font-xs m-0 mt-1">
              En insumos, mercadería y gastos varios.
            </p>
          </div>

          {/* Balance y Compensación */}
          <div className="glass-card p-3 bg-dark-soft border border-warning-soft rounded-lg">
            <div className="flex-between align-center mb-2">
              <span className="font-semibold text-warning flex-align-center gap-1">
                ⚖️ Compensación de Gastos
              </span>
              <span className="text-muted font-xs">Equiparación</span>
            </div>
            {diferenciaAportes === 0 ? (
              <div className="text-success font-semibold font-sm">
                ✅ Aportes perfectamente equilibrados.
              </div>
            ) : diferenciaAportes > 0 ? (
              <div>
                <p className="m-0 text-white font-medium">
                  Jere puso <strong className="text-info">{formatMoney(Math.abs(diferenciaAportes))}</strong> más que Isa.
                </p>
                <p className="m-0 text-warning font-xs mt-1">
                  👉 Para equilibrar, reintegrar <strong>{formatMoney(mitadDiferencia)}</strong> a Jere.
                </p>
              </div>
            ) : (
              <div>
                <p className="m-0 text-white font-medium">
                  Isa puso <strong className="text-purple">{formatMoney(Math.abs(diferenciaAportes))}</strong> más que Jere.
                </p>
                <p className="m-0 text-warning font-xs mt-1">
                  👉 Para equilibrar, reintegrar <strong>{formatMoney(mitadDiferencia)}</strong> a Isa.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Reparto Neto Sugerido */}
        <div className="mt-3 p-3 bg-dark-soft rounded-lg flex-between align-center flex-wrap gap-2 border border-color">
          <div className="flex-align-center gap-2">
            <DollarSign size={18} className="text-success" />
            <span className="text-secondary font-sm">
              Ganancia Neta Disponible para Distribuir: <strong className="text-success font-mono font-bold text-base">{formatMoney(gananciaNeta)}</strong>
            </span>
          </div>
          <div className="flex-align-center gap-3 font-sm">
            <span>Reparto por socio (50%): <strong className="text-white font-mono">{formatMoney(gananciaNeta / 2)}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Grid: Add Expense Form & Categories vs Expenses Table */}
      <div className="grid-2-1 mb-4">
        {/* Left Column: Form & Registered Expenses Table */}
        <div className="flex-column gap-4">
          
          {/* Formulario de Carga Rápida */}
          <div className="glass-card p-4 border border-color">
            <h3 className="m-0 mb-3 flex-align-center gap-2 text-primary">
              <Plus size={20} />
              Registrar Nuevo Gasto de Campaña
            </h3>

            <form onSubmit={handleSaveGasto} className="flex-column gap-3">
              <div className="grid-3 gap-3">
                {/* Monto */}
                <div className="form-group">
                  <label className="font-semibold text-secondary font-xs">Monto ($) *</label>
                  <div className="input-icon-container mt-1">
                    <DollarSign size={16} className="input-icon text-muted" />
                    <input 
                      type="number"
                      step="any"
                      min="1"
                      className="form-control font-bold"
                      style={{ paddingLeft: '32px' }}
                      placeholder="Ej: 45000"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Pagado Por */}
                <div className="form-group">
                  <label className="font-semibold text-secondary font-xs">¿Quién lo pagó? *</label>
                  <select 
                    className="form-control font-semibold mt-1"
                    value={pagadoPor}
                    onChange={(e) => setPagadoPor(e.target.value)}
                  >
                    <option value="Jere">👤 Jere (Bolsillo Jere)</option>
                    <option value="Isa">👤 Isa (Bolsillo Isa)</option>
                    <option value="Caja">🏢 Caja / Sociedad</option>
                  </select>
                </div>

                {/* Categoría */}
                <div className="form-group">
                  <label className="font-semibold text-secondary font-xs">Categoría de Gasto *</label>
                  <select 
                    className="form-control mt-1"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                  >
                    {GASTO_CATEGORIAS.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid-2-1 gap-3">
                {/* Detalle / Observación */}
                <div className="form-group">
                  <label className="font-semibold text-secondary font-xs">Detalle / Observación</label>
                  <input 
                    type="text"
                    className="form-control mt-1"
                    placeholder="Ej: Comisionista Puerto Madryn, Cajas y Cintas, Estacionamiento..."
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                  />
                </div>

                {/* Fecha */}
                <div className="form-group">
                  <label className="font-semibold text-secondary font-xs">Fecha</label>
                  <input 
                    type="date"
                    className="form-control mt-1"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-between align-center mt-2">
                <span className="text-muted font-xs">
                  Se asignará a: <strong>{currentCampaign.name}</strong>
                </span>
                <button 
                  type="submit" 
                  className="btn btn-primary flex-align-center gap-2 px-4"
                  disabled={isSubmitting}
                >
                  <Plus size={16} />
                  {isSubmitting ? 'Guardando...' : 'Registrar Gasto'}
                </button>
              </div>
            </form>
          </div>

          {/* Tabla de Gastos */}
          <div className="glass-card p-4 border border-color">
            <div className="flex-between align-center flex-wrap gap-2 mb-3 border-bottom pb-3">
              <div>
                <h3 className="m-0 flex-align-center gap-2">
                  <FileText size={20} className="text-primary" />
                  Listado de Gastos Registrados ({displayedGastos.length})
                </h3>
              </div>

              <div className="flex-align-center gap-2 flex-wrap">
                {/* Filtro Pagador */}
                <select 
                  className="form-control form-control-sm"
                  style={{ width: '130px', fontSize: '0.8rem' }}
                  value={filterPagador}
                  onChange={(e) => setFilterPagador(e.target.value)}
                >
                  <option value="todos">Todos los Pagadores</option>
                  <option value="Jere">Solo Jere</option>
                  <option value="Isa">Solo Isa</option>
                  <option value="Caja">Solo Caja</option>
                </select>

                {/* Filtro Categoría */}
                <select 
                  className="form-control form-control-sm"
                  style={{ width: '150px', fontSize: '0.8rem' }}
                  value={filterCategoria}
                  onChange={(e) => setFilterCategoria(e.target.value)}
                >
                  <option value="todas">Todas las Categorías</option>
                  {GASTO_CATEGORIAS.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>

                {/* Botón Exportar CSV */}
                <button 
                  className="btn btn-sm btn-outline flex-align-center gap-1"
                  onClick={handleExportCSV}
                  disabled={gastos.length === 0}
                  title="Exportar gastos a CSV"
                >
                  <Download size={14} /> Exportar CSV
                </button>
              </div>
            </div>

            {displayedGastos.length === 0 ? (
              <div className="p-5 text-center text-secondary">
                <Wallet size={40} className="mb-2 text-muted" />
                <p className="m-0">No hay gastos registrados con los filtros seleccionados.</p>
              </div>
            ) : (
              <div className="table-responsive overflow-x">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Categoría</th>
                      <th>Detalle / Observación</th>
                      <th className="text-center">Pagado Por</th>
                      <th className="text-right">Monto</th>
                      <th className="text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedGastos.map(gasto => {
                      const catObj = GASTO_CATEGORIAS.find(c => c.id === gasto.categoria) || GASTO_CATEGORIAS[4];
                      const IconComponent = catObj.icon;
                      return (
                        <tr key={gasto.id}>
                          <td className="font-xs text-muted font-mono">
                            {gasto.fecha ? new Date(gasto.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                          </td>
                          <td>
                            <span className="flex-align-center gap-1 font-semibold font-sm" style={{ color: catObj.color }}>
                              <IconComponent size={14} />
                              {catObj.label}
                            </span>
                          </td>
                          <td className="font-medium text-white">
                            {gasto.observacion || <span className="text-muted font-xs italic">Sin detalle</span>}
                          </td>
                          <td className="text-center">
                            <span className={`badge-small ${gasto.pagadoPor === 'Jere' ? 'bg-info-soft text-info font-bold' : gasto.pagadoPor === 'Isa' ? 'bg-purple-soft text-purple font-bold' : 'bg-success-soft text-success font-bold'}`}>
                              {gasto.pagadoPor}
                            </span>
                          </td>
                          <td className="text-right font-mono font-bold text-danger">
                            {formatMoney(gasto.monto)}
                          </td>
                          <td className="text-center">
                            <button 
                              className="btn-icon text-danger hover-danger"
                              onClick={() => handleDeleteGasto(gasto)}
                              title="Eliminar este gasto"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="4" className="font-bold text-right">TOTAL GASTOS:</td>
                      <td className="text-right font-mono font-extrabold text-danger text-base">
                        {formatMoney(displayedGastos.reduce((acc, g) => acc + (Number(g.monto) || 0), 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Categories Breakdown & Cost Structure */}
        <div className="flex-column gap-4">
          <div className="glass-card p-4 border border-color">
            <h3 className="m-0 mb-3 flex-align-center gap-2 text-primary">
              <PieChart size={20} />
              Desglose de Gastos por Rubro
            </h3>

            <div className="flex-column gap-3">
              {gastosPorCategoria.map(cat => {
                const IconComponent = cat.icon;
                return (
                  <div key={cat.id} className="p-2 rounded bg-dark-soft border border-color">
                    <div className="flex-between align-center mb-1 font-sm">
                      <span className="flex-align-center gap-1 font-semibold" style={{ color: cat.color }}>
                        <IconComponent size={16} />
                        {cat.label}
                      </span>
                      <span className="font-mono font-bold">{formatMoney(cat.total)}</span>
                    </div>

                    <div className="progress-bar-bg" style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${cat.porcentaje}%`, 
                          height: '100%', 
                          background: cat.color,
                          borderRadius: '3px' 
                        }} 
                      />
                    </div>
                    <div className="flex-between align-center mt-1 font-xs text-muted">
                      <span>{cat.desc}</span>
                      <span>{cat.porcentaje}% del total</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="divider mt-4 mb-3"></div>

            <div className="flex-between align-center p-2 bg-danger-soft rounded border border-danger font-sm">
              <span className="font-bold text-danger">TOTAL EGRESOS:</span>
              <span className="font-mono font-extrabold text-danger text-base">{formatMoney(totalGastos)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
