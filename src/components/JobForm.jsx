import React, { useState, useEffect, useRef } from 'react';
import { Copy, Plus, RotateCcw, AlertTriangle, Search, Sparkles, Check } from 'lucide-react';
import priceList from '../data/lista_de_precios.json';
import { getNextRefCode, saveTrabajo } from '../services/dataService';

// Quick access definitions
const QUICK_LENSES_CONFIG = [
  // COLUMNA 1: Orgánicos Blue Cut (Azul) - STOCK, RANGO EXT, LAB
  {
    label: 'Org Blue c/ Ar',
    badge: 'STOCK',
    colorClass: 'ql-blue ql-most-used',
    match: (p) => p.category === 'Lentes de Stock' && p.rawName.includes('Organico Blue Light Cut') && p.rawName.includes('Tipo: Stock')
  },
  // COLUMNA 2: Bifocales (Teal) - BLUE CUT
  {
    label: 'Bifocal Blue Cut',
    badge: 'BLUE CUT',
    colorClass: 'ql-teal',
    match: (p) => p.category === 'Bifocal' && p.rawName.includes('Bif. Flap Top Orgánico Blue Light Cut')
  },
  // COLUMNA 3: Multifocales (Púrpura) - BLUE ONE
  {
    label: 'Multi Blue One',
    badge: 'BLUE ONE',
    colorClass: 'ql-purple',
    match: (p) => p.category === 'Multifocal Digital' && p.rawName.includes('Orgánico BLUE LIGHT') && p.rawName.includes('Diseño One') && p.rawName.includes('1.56')
  },
  // COLUMNA 4: Foto Blue Monofocal (Ámbar) - STOCK
  {
    label: 'Org Foto Blue',
    badge: 'STOCK',
    colorClass: 'ql-amber',
    match: (p) => p.category === 'Lentes de Stock' && p.rawName.includes('Blue Fotocromático Gris c/ Antirreflex')
  },

  // COLUMNA 1: Orgánicos Blue Cut (Azul) - RANGO EXT
  {
    label: 'Org Blue c/ Ar',
    badge: 'RANGO EXT',
    colorClass: 'ql-blue ql-most-used',
    match: (p) => p.category === 'Lentes de Stock' && p.rawName.includes('Organico Blue Light Cut') && p.rawName.includes('Tipo: Rango Extendido')
  },
  // COLUMNA 2: Bifocales (Teal) - FOTO GRIS
  {
    label: 'Bifocal Foto Gris',
    badge: 'FOTO GRIS',
    colorClass: 'ql-teal',
    match: (p) => p.category === 'Bifocal' && p.rawName.includes('Bif. Flap Top Orgánico Fotocromático Gris')
  },
  // COLUMNA 3: Multifocales (Púrpura) - FOTO GREY
  {
    label: 'Multi Foto Blue One',
    badge: 'FOTO GREY',
    colorClass: 'ql-purple',
    match: (p) => p.category === 'Multifocal Digital' && p.rawName.includes('Org Fotocromático BLUELIGHT Grey') && p.rawName.includes('Diseño One')
  },
  // COLUMNA 4: Foto Blue Monofocal (Ámbar) - LAB
  {
    label: 'Org Foto Blue',
    badge: 'LAB',
    colorClass: 'ql-amber',
    match: (p) => p.category === 'Monofocal Lab' && p.rawName.includes('1.56 Orgánico Fotocromático Gris - Tallado Tradicional CNC')
  },

  // COLUMNA 1: Orgánicos Blue Cut (Azul) - LAB
  {
    label: 'Org Blue c/ Ar',
    badge: 'LAB',
    colorClass: 'ql-blue ql-most-used',
    match: (p) => p.category === 'Monofocal Lab' && p.rawName.includes('1.56 Orgánico Blue Light - Tallado Tradicional CNC')
  }
];

const getShortName = (item) => {
  const baseName = item.name.split(' (')[0];
  const typeMatch = item.name.match(/Tipo:\s*([^,\)]+)/);
  if (typeMatch) {
    const typeStr = typeMatch[1].trim();
    const shortType = typeStr === 'Rango Extendido' ? 'Rango Ext' : typeStr;
    return `${baseName} ${shortType}`;
  }
  return baseName;
};

export default function JobForm({ campaign, localities, jobs = [], onJobSaved }) {
  const [localidadId, setLocalidadId] = useState(() => localStorage.getItem('optica_last_localidad_id') || '');
  const [isChangingLocality, setIsChangingLocality] = useState(false);
  const [refCode, setRefCode] = useState('');
  const [sequence, setSequence] = useState(1);
  const [paciente, setPaciente] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Lens searches and selection
  const [searchOD, setSearchOD] = useState('');
  const [selectedOD, setSelectedOD] = useState(null);
  const [showODList, setShowODList] = useState(false);

  const [searchOI, setSearchOI] = useState('');
  const [selectedOI, setSelectedOI] = useState(null);
  const [showOIList, setShowOIList] = useState(false);

  // Quick Access targets: 'both', 'od', 'oi'
  const [quickAccessTarget, setQuickAccessTarget] = useState('both');

  // Calibrado options (MANUAL selection as requested)
  const [calibradoProceso, setCalibradoProceso] = useState('Stock'); // Stock, Laboratorio, Pase de Cristales
  const [calibradoTipo, setCalibradoTipo] = useState('Aro Completo'); // Aro Completo, Ranurado, Perforado
  
  const [nroPedidoLab, setNroPedidoLab] = useState('');
  const [esSinPedir, setEsSinPedir] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // DOM Refs for click-outside close
  const odRef = useRef();
  const oiRef = useRef();

  const isPaseDeCristales = calibradoProceso === 'Pase de Cristales';

  // Load next code when campaign, localidad, or job changes
  useEffect(() => {
    if (campaign && localidadId) {
      const selectedLoc = localities.find(l => l.id === localidadId);
      if (selectedLoc) {
        getNextRefCode(campaign.id, localidadId, selectedLoc.code)
          .then(res => {
            setSequence(res.sequence);
            setRefCode(res.refCode);
          });
      }
    } else {
      setRefCode('');
    }
  }, [campaign, localidadId, localities, refreshTrigger]);

  // Click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (odRef.current && !odRef.current.contains(event.target)) {
        setShowODList(false);
      }
      if (oiRef.current && !oiRef.current.contains(event.target)) {
        setShowOIList(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter list of prices for typeahead
  const getFilteredLenses = (search) => {
    const lensesOnly = priceList.filter(item => item.category !== 'Calibrados y Trabajos' && item.price !== null);
    if (!search.trim()) return lensesOnly.slice(0, 8);
    const term = search.toLowerCase();
    return lensesOnly.filter(item => 
      item.rawName.toLowerCase().includes(term) || 
      item.category.toLowerCase().includes(term)
    );
  };

  const filteredOD = getFilteredLenses(searchOD);
  const filteredOI = getFilteredLenses(searchOI);

  // Copy OD to OI helper
  const copyODtoOI = () => {
    if (selectedOD) {
      setSelectedOI(selectedOD);
      setSearchOI(selectedOD.name);
    }
  };

  // Quick access click handler
  const handleQuickAccessClick = (configItem) => {
    const matchedProduct = priceList.find(configItem.match);
    if (!matchedProduct) return;

    const displayName = configItem.badge ? `${configItem.label} ${configItem.badge}` : configItem.label;

    const formattedProduct = {
      id: matchedProduct.id,
      name: displayName,
      fullName: matchedProduct.name,
      price: matchedProduct.price,
      type: matchedProduct.type
    };

    if (quickAccessTarget === 'both') {
      setSelectedOD(formattedProduct);
      setSearchOD(displayName);
      setSelectedOI(formattedProduct);
      setSearchOI(displayName);
    } else if (quickAccessTarget === 'od') {
      setSelectedOD(formattedProduct);
      setSearchOD(displayName);
    } else if (quickAccessTarget === 'oi') {
      setSelectedOI(formattedProduct);
      setSearchOI(displayName);
    }
  };

  // Automatically reset/anulate crystals when switching to Pase de Cristales calibration
  useEffect(() => {
    if (isPaseDeCristales) {
      setSelectedOD(null);
      setSearchOD('');
      setSelectedOI(null);
      setSearchOI('');
      setCalibradoTipo('Aro Completo'); // Pase de Cristales is only valid for Aro Completo
    }
  }, [calibradoProceso]);

  // Determine calibration and lens prices
  const calculatePricing = () => {
    let priceOD = selectedOD ? selectedOD.price / 2 : 0;
    let priceOI = selectedOI ? selectedOI.price / 2 : 0;
    let calName = '';
    let calPrice = 0;

    let processStr = 'ORGANICO STOCK';
    if (calibradoProceso === 'Laboratorio') {
      processStr = 'ORGANICO LABORATORIO';
    } else if (calibradoProceso === 'Pase de Cristales') {
      processStr = 'PASE DE CRISTALES';
    }

    let typeStr = 'Montura Completa';
    if (calibradoTipo === 'Ranurado') typeStr = 'Ranurado / Semi al Aire';
    if (calibradoTipo === 'Perforado') typeStr = 'Perforado / Al Aire';

    const calProd = priceList.find(p => p.rawName.includes(processStr) && p.rawName.includes(typeStr));
    if (calProd) {
      calName = calProd.name;
      calPrice = calProd.price || 0;
    } else {
      calName = `${processStr} - ${calibradoTipo}`;
      calPrice = 0;
    }

    const total = priceOD + priceOI + calPrice;
    return {
      priceOD,
      priceOI,
      calPrice,
      calName,
      total
    };
  };

  const handleSelectLocalidad = (id) => {
    setLocalidadId(id);
    if (id) {
      localStorage.setItem('optica_last_localidad_id', id);
    } else {
      localStorage.removeItem('optica_last_localidad_id');
    }
    setIsChangingLocality(false);
  };

  const pricing = calculatePricing();

  const handleSave = async (e) => {
    e.preventDefault();
    if (!campaign) {
      setErrorMsg('No hay ninguna campaña activa.');
      return;
    }
    if (!localidadId) {
      setErrorMsg('Por favor selecciona una localidad.');
      return;
    }
    if (!isPaseDeCristales && !selectedOD && !selectedOI) {
      setErrorMsg('Por favor selecciona al menos un cristal.');
      return;
    }

    // Check if refCode already exists in campaign
    const codeExists = jobs.some(j => j.refCode === refCode);
    if (codeExists) {
      setErrorMsg(`El código de referencia "${refCode}" ya existe en esta campaña. Se está recalculando el siguiente número disponible...`);
      setRefreshTrigger(prev => prev + 1);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const jobData = {
        campanaId: campaign.id,
        localidadId,
        refCode,
        sequence,
        paciente: paciente.trim(),
        cristalOD: selectedOD ? { id: selectedOD.id, name: selectedOD.name, fullName: selectedOD.fullName || selectedOD.name, price: selectedOD.price, type: selectedOD.type } : null,
        cristalOI: selectedOI ? { id: selectedOI.id, name: selectedOI.name, fullName: selectedOI.fullName || selectedOI.name, price: selectedOI.price, type: selectedOI.type } : null,
        calibradoTipo,
        calibradoProceso,
        isPaseDeCristales,
        calibradoPrecio: pricing.calPrice,
        calibradoNombre: pricing.calName,
        precioTotal: pricing.total,
        nroPedidoLab: nroPedidoLab.trim(),
        estado: esSinPedir ? 'Sin Pedir' : 'Pedido Lab',
        createdAt: new Date().toISOString()
      };

      await saveTrabajo(jobData);
      
      // Reset form but KEEP Localidad
      setPaciente('');
      setSelectedOD(null);
      setSearchOD('');
      setSelectedOI(null);
      setSearchOI('');
      setCalibradoProceso('Stock');
      setCalibradoTipo('Aro Completo');
      setNroPedidoLab('');
      setEsSinPedir(false);
      
      setRefreshTrigger(prev => prev + 1);
      
      if (onJobSaved) onJobSaved();
      
      document.getElementById('paciente-input')?.focus();

    } catch (err) {
      console.error(err);
      setErrorMsg('Error al guardar el trabajo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    setPaciente('');
    setSelectedOD(null);
    setSearchOD('');
    setSelectedOI(null);
    setSearchOI('');
    setCalibradoProceso('Stock');
    setCalibradoTipo('Aro Completo');
    setNroPedidoLab('');
    setEsSinPedir(false);
    setErrorMsg('');
  };

  const formatMoney = (val) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="glass-card p-4 max-width-950 mx-auto">
      <div className="card-header border-bottom pb-3 mb-4">
        <h3 className="m-0 flex-align-center gap-2">
          <Sparkles size={22} className="text-primary" />
          Ingresar Nuevo Trabajo
        </h3>
        {refCode && (
          <span className="badge badge-primary font-md py-2 px-3">
            Código Ref: <strong>{refCode}</strong>
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="alert alert-danger mb-4 flex-align-center gap-2">
          <AlertTriangle size={18} />
          {errorMsg}
        </div>
      )}

      {/* Streamlined, visually clean form flow */}
      <form onSubmit={handleSave} className="flex-column gap-4">
        
        {/* STEP 1: Origin & Patient (Unified Header row) */}
        <div className="form-step-section">
          <div className="step-badge">Paso 1</div>
          <div className="step-content grid-2-1 gap-4">
            
            {/* Localidades picker */}
            <div className="form-group">
              <label className="font-semibold text-secondary">Localidad de Origen</label>
              
              {!localidadId || isChangingLocality ? (
                <select
                  className="form-control mt-2"
                  value={localidadId}
                  onChange={(e) => handleSelectLocalidad(e.target.value)}
                >
                  <option value="">-- Seleccionar Localidad --</option>
                  {localities.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      ({loc.code}) {loc.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex-align-center gap-2 mt-2">
                  {(() => {
                    const selectedLoc = localities.find(l => l.id === localidadId);
                    if (!selectedLoc) return null;
                    return (
                      <div className="btn-selector active cursor-default">
                        <span className="loc-char">{selectedLoc.code}</span>
                        <span className="loc-name">{selectedLoc.name}</span>
                      </div>
                    );
                  })()}
                  <button
                    type="button"
                    className="btn btn-xs btn-outline py-2 px-3"
                    onClick={() => setIsChangingLocality(true)}
                  >
                    Cambiar Pueblo
                  </button>
                </div>
              )}
            </div>

            {/* Paciente input */}
            <div className="form-group justify-end-desktop">
              <label htmlFor="paciente-input" className="font-semibold text-secondary">Nombre del Paciente</label>
              <input
                id="paciente-input"
                type="text"
                className="form-control mt-2"
                placeholder="Nombre del Paciente (Ej: Juan Pérez)"
                value={paciente}
                onChange={(e) => setPaciente(e.target.value)}
              />
            </div>

          </div>
        </div>

        <div className="divider"></div>

        {/* STEP 2: Calibrado */}
        <div className="form-step-section">
          <div className="step-badge">Paso 2</div>
          <div className="step-content flex-column gap-3">
            <label className="font-semibold text-secondary">Calibración y Tipo de Marco</label>
            
            <div className="grid-2 gap-3 mt-1">
              {/* Proceso */}
              <div className="form-group">
                <label className="font-xs text-muted mb-1">Proceso de Trabajo</label>
                <div className="radio-group-row">
                  {[
                    { value: 'Stock', label: 'Stock' },
                    { value: 'Laboratorio', label: 'Laboratorio' },
                    { value: 'Pase de Cristales', label: 'Pase de Cristales' }
                  ].map(proc => (
                    <button
                      key={proc.value}
                      type="button"
                      className={`btn-radio ${calibradoProceso === proc.value ? 'active' : ''}`}
                      onClick={() => setCalibradoProceso(proc.value)}
                    >
                      {proc.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo de Marco */}
              <div className="form-group">
                <label className="font-xs text-muted mb-1">Calibrado / Biselado</label>
                <div className="radio-group-row">
                  {['Aro Completo', 'Ranurado', 'Perforado'].map(tipo => {
                    const isDisabled = isPaseDeCristales && tipo !== 'Aro Completo';
                    return (
                      <button
                        key={tipo}
                        type="button"
                        className={`btn-radio ${calibradoTipo === tipo ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                        onClick={() => {
                          if (isDisabled) return;
                          setCalibradoTipo(tipo);
                        }}
                        disabled={isDisabled}
                      >
                        {tipo}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="divider"></div>

        {/* STEP 3: Cristales (Shown only if NOT Pase de Cristales) */}
        {!isPaseDeCristales ? (
          <div className="form-step-section">
            <div className="step-badge">Paso 3</div>
            <div className="step-content flex-column gap-4">
              <label className="font-semibold text-secondary">Selección de Cristales (OD / OI)</label>
              
              {/* Typeahead inputs */}
              <div className="grid-2 gap-3 mt-1">
                {/* OD Input */}
                <div className="form-group relative-container" ref={odRef}>
                  <label className="font-xs text-muted mb-1">Ojo Derecho (OD)</label>
                  <div className="input-search-container">
                    <Search size={16} className="search-icon" />
                    <input
                      type="text"
                      className="form-control pl-5"
                      placeholder="Escribe para buscar cristal OD..."
                      value={searchOD}
                      onChange={(e) => {
                        setSearchOD(e.target.value);
                        setShowODList(true);
                      }}
                      onFocus={() => setShowODList(true)}
                    />
                  </div>
                  
                  {showODList && (
                    <div className="dropdown-list-container">
                      {filteredOD.map(item => (
                        <div
                          key={item.id}
                          className={`dropdown-list-item ${selectedOD?.id === item.id ? 'selected' : ''}`}
                          onClick={() => {
                            const shortName = getShortName(item);
                            setSelectedOD({
                              id: item.id,
                              name: shortName,
                              fullName: item.name,
                              price: item.price,
                              type: item.type
                            });
                            setSearchOD(shortName);
                            setShowODList(false);
                          }}
                        >
                          <div className="flex-between">
                            <strong>{item.name}</strong>
                            <span className="badge-small bg-primary-soft text-primary">{item.category}</span>
                          </div>
                          <div className="flex-between text-secondary mt-1 font-xs">
                            <span>Índice: {item.type}</span>
                            <strong>{formatMoney(item.price / 2)} <span className="text-muted font-xs">(1/2 par)</span></strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* OI Input */}
                <div className="form-group relative-container" ref={oiRef}>
                  <div className="flex-between align-center mb-1">
                    <label className="font-xs text-muted m-0">Ojo Izquierdo (OI)</label>
                    {selectedOD && (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline flex-align-center gap-1 py-0 px-2"
                        onClick={copyODtoOI}
                      >
                        <Copy size={11} /> Copiar OD
                      </button>
                    )}
                  </div>
                  
                  <div className="input-search-container">
                    <Search size={16} className="search-icon" />
                    <input
                      type="text"
                      className="form-control pl-5"
                      placeholder="Escribe para buscar cristal OI..."
                      value={searchOI}
                      onChange={(e) => {
                        setSearchOI(e.target.value);
                        setShowOIList(true);
                      }}
                      onFocus={() => setShowOIList(true)}
                    />
                  </div>
                  
                  {showOIList && (
                    <div className="dropdown-list-container">
                      {filteredOI.map(item => (
                        <div
                          key={item.id}
                          className={`dropdown-list-item ${selectedOI?.id === item.id ? 'selected' : ''}`}
                          onClick={() => {
                            const shortName = getShortName(item);
                            setSelectedOI({
                              id: item.id,
                              name: shortName,
                              fullName: item.name,
                              price: item.price,
                              type: item.type
                            });
                            setSearchOI(shortName);
                            setShowOIList(false);
                          }}
                        >
                          <div className="flex-between">
                            <strong>{item.name}</strong>
                            <span className="badge-small bg-primary-soft text-primary">{item.category}</span>
                          </div>
                          <div className="flex-between text-secondary mt-1 font-xs">
                            <span>Índice: {item.type}</span>
                            <strong>{formatMoney(item.price / 2)} <span className="text-muted font-xs">(1/2 par)</span></strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Accesos Rápidos Panel */}
              <div className="bg-sidebar p-3 rounded-lg border border-color">
                <div className="flex-between align-center border-bottom pb-2 mb-3">
                  <span className="font-xs font-semibold text-secondary flex-align-center gap-1">
                    <Sparkles size={14} className="text-primary" />
                    Accesos Rápidos (Carga en un Clic)
                  </span>
                  
                  <div className="target-pill-selector">
                    <button
                      type="button"
                      className={`target-pill ${quickAccessTarget === 'both' ? 'active' : ''}`}
                      onClick={() => setQuickAccessTarget('both')}
                    >
                      Ambos Ojos
                    </button>
                    <button
                      type="button"
                      className={`target-pill ${quickAccessTarget === 'od' ? 'active' : ''}`}
                      onClick={() => setQuickAccessTarget('od')}
                    >
                      Solo OD
                    </button>
                    <button
                      type="button"
                      className={`target-pill ${quickAccessTarget === 'oi' ? 'active' : ''}`}
                      onClick={() => setQuickAccessTarget('oi')}
                    >
                      Solo OI
                    </button>
                  </div>
                </div>

                <div className="quick-lenses-grid">
                  {QUICK_LENSES_CONFIG.map(configItem => (
                    <button
                      key={`${configItem.label}-${configItem.badge}`}
                      type="button"
                      className={`btn-quick-lens ${configItem.colorClass || ''}`}
                      onClick={() => handleQuickAccessClick(configItem)}
                      title={priceList.find(configItem.match)?.name || ''}
                    >
                      <span className="quick-lbl">{configItem.label}</span>
                      <span className="quick-prc">
                        {formatMoney((priceList.find(configItem.match)?.price || 0) / 2)}
                      </span>
                      {configItem.badge && (
                        <span className="ql-badge">{configItem.badge}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* Visual placeholder when Pase de Cristales is selected */
          <div className="form-step-section bg-primary-soft border border-color rounded-lg p-3 text-center">
            <span className="text-primary font-semibold flex-align-center justify-center gap-2">
              <Check size={18} />
              Modo "Pase de Cristales" Activo: Los cristales no tienen costo y se anulan de la carga.
            </span>
          </div>
        )}

        <div className="divider"></div>

        {/* STEP 4: Summary & Submit (Bottom panel) */}
        <div className="form-step-section align-center">
          <div className="step-badge">Paso {isPaseDeCristales ? '3' : '4'}</div>
          
          <div className="step-content grid-2 gap-4 w-full">
            {/* Left: Checkbox "NO Encargado ❌" and Prices summary */}
            <div className="flex-column gap-3 justify-center">
              
              {/* Nro Pedido Lab Mayorista (placed at the end as requested) */}
              <div className="form-group mb-1">
                <label htmlFor="nroPedido-input" className="font-xs text-muted">Nro Pedido Lab Mayorista (Opcional)</label>
                <input
                  id="nroPedido-input"
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Escribe el número de pedido del proveedor..."
                  value={nroPedidoLab}
                  onChange={(e) => setNroPedidoLab(e.target.value)}
                />
              </div>

              <label className="checkbox-label align-center font-sm">
                <input
                  type="checkbox"
                  checked={esSinPedir}
                  onChange={(e) => setEsSinPedir(e.target.checked)}
                />
                <span className="checkbox-text text-danger font-semibold flex-align-center gap-1">
                  ❌ NO Encargado
                </span>
              </label>

              <div className="flex-align-center gap-3">
                <span className="text-secondary font-sm font-semibold">Desglose rápido:</span>
                <span className="font-mono font-xs text-muted">
                  OD: {formatMoney(pricing.priceOD)} | OI: {formatMoney(pricing.priceOI)} | Calib: {formatMoney(pricing.calPrice)}
                </span>
              </div>
            </div>

            {/* Right: Total Price box and Save buttons */}
            <div className="flex-align-center gap-3 justify-end">
              <div className="total-billing-card py-2 px-4 rounded-lg bg-sidebar border border-color text-right">
                <span className="font-xs text-secondary uppercase font-bold block mb-1">TOTAL ESTIMADO</span>
                <strong className="text-success font-lg font-mono">{formatMoney(pricing.total)}</strong>
              </div>
              
              <div className="flex-column gap-2 justify-center">
                <button
                  type="submit"
                  className="btn btn-primary btn-md flex-align-center gap-2"
                  disabled={isSubmitting || !campaign || !localidadId}
                >
                  <Plus size={18} /> Guardar Trabajo
                </button>
                <button
                  type="button"
                  className="btn btn-link btn-xs text-muted justify-center"
                  onClick={handleClear}
                  disabled={isSubmitting}
                >
                  <RotateCcw size={12} /> Limpiar campos
                </button>
              </div>
            </div>

          </div>
        </div>

      </form>
    </div>
  );
}
