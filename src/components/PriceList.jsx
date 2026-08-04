import React, { useState, useEffect } from 'react';
import { Search, Tag, Edit, RotateCcw, Check, X, Filter, BookOpen, DollarSign } from 'lucide-react';
import defaultPriceList from '../data/lista_de_precios.json';

export const getPriceList = () => {
  const custom = localStorage.getItem('optica_custom_price_list');
  if (custom) {
    try {
      return JSON.parse(custom);
    } catch (e) {
      console.error("Error parsing custom price list:", e);
    }
  }
  return defaultPriceList;
};

export const savePriceList = (newList) => {
  localStorage.setItem('optica_custom_price_list', JSON.stringify(newList));
};

export const getShortName = (item) => {
  if (!item) return '';
  if (item.shortName) return item.shortName;
  
  const nameToTest = item.rawName || item.name || '';
  
  if (nameToTest.includes('Organico Blue Light Cut') && (nameToTest.includes('Tipo: Stock') || nameToTest.endsWith('Stock'))) {
    return 'Org Blue c/ Ar STOCK';
  }
  if (nameToTest.includes('Organico Blue Light Cut') && (nameToTest.includes('Tipo: Rango Extendido') || nameToTest.includes('Rango Ext'))) {
    return 'Org Blue c/ Ar RANGO EXT';
  }
  if (nameToTest.includes('1.56 Orgánico Blue Light') || nameToTest.includes('Org Blue c/ Ar LAB')) {
    return 'Org Blue c/ Ar LAB';
  }
  if (nameToTest.includes('Blue Fotocromático Gris') || nameToTest.includes('Blue Light Cut + Fotocromático') || nameToTest.includes('Org Foto Blue STOCK')) {
    return 'Org Foto Blue STOCK';
  }
  if (nameToTest.includes('1.56 Orgánico Fotocromático Gris') || nameToTest.includes('1.56 Orgánico Fotocromático BLUE') || nameToTest.includes('Org Foto Blue LAB')) {
    return 'Org Foto Blue LAB';
  }
  if (nameToTest.includes('Bif. Flap Top Orgánico Blue Light Cut') || nameToTest.includes('Bifocal Blue Cut')) {
    return 'Bifocal Blue Cut';
  }
  if (nameToTest.includes('Bif. Flap Top Orgánico Fotocromático Gris') || nameToTest.includes('Bifocal Foto Gris')) {
    return 'Bifocal Foto Gris';
  }
  if ((nameToTest.includes('Orgánico BLUE LIGHT') || nameToTest.includes('Multi Blue One')) && nameToTest.includes('One')) {
    return 'Multi Blue One';
  }
  if ((nameToTest.includes('Org Fotocromático BLUELIGHT Grey') || nameToTest.includes('Multi Foto Blue One')) && nameToTest.includes('One')) {
    return 'Multi Foto Blue One';
  }

  // General fallback cleaning
  let cleaned = (item.name || '').split(' (')[0];
  const typeMatch = (item.name || '').match(/Tipo:\s*([^,\)]+)/);
  if (typeMatch) {
    const typeStr = typeMatch[1].trim();
    const shortType = typeStr === 'Rango Extendido' ? 'Rango Ext' : typeStr;
    cleaned = `${cleaned} ${shortType}`;
  }
  return cleaned;
};

export const getCanonicalLens = (cristal, priceList = []) => {
  if (!cristal) return null;

  const currentPriceList = priceList.length > 0 ? priceList : getPriceList();

  // 1. Try match by ID
  if (cristal.id) {
    const found = currentPriceList.find(p => p.id === cristal.id);
    if (found) {
      return {
        ...cristal,
        id: found.id,
        name: getShortName(found),
        price: found.price || cristal.price
      };
    }
  }

  // 2. Try match by name or rawName
  const cName = cristal.name || '';
  const foundByName = currentPriceList.find(p => {
    const pShort = getShortName(p);
    return (
      p.name === cName || 
      p.rawName === cName || 
      pShort === cName ||
      (cName.length > 4 && pShort.toLowerCase() === cName.toLowerCase()) ||
      (cName.length > 5 && p.name.toLowerCase().includes(cName.toLowerCase())) ||
      (cName.length > 5 && cName.toLowerCase().includes(p.name.split(' (')[0].toLowerCase()))
    );
  });

  if (foundByName) {
    return {
      ...cristal,
      id: foundByName.id,
      name: getShortName(foundByName),
      price: foundByName.price || cristal.price
    };
  }

  // 3. Fallback
  return {
    ...cristal,
    name: getShortName(cristal)
  };
};

export default function PriceList() {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  
  // Editing state
  const [editingItemId, setEditingItemId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState(0);

  useEffect(() => {
    setItems(getPriceList());
  }, []);

  // Unique categories and types for dropdown filters
  const categories = Array.from(new Set(defaultPriceList.map(i => i.category))).filter(Boolean);
  const types = Array.from(new Set(defaultPriceList.map(i => i.type))).filter(Boolean);

  // Filter items based on search and dropdowns
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.rawName && item.rawName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory ? item.category === selectedCategory : true;
    const matchesType = selectedType ? item.type === selectedType : true;

    return matchesSearch && matchesCategory && matchesType;
  });

  const formatMoney = (val) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(val || 0);
  };

  const handleStartEdit = (item) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditPrice(item.price);
  };

  const handleSaveEdit = (itemId) => {
    const updated = items.map(i => {
      if (i.id === itemId) {
        return {
          ...i,
          name: editName.trim(),
          price: Number(editPrice),
          priceStr: formatMoney(editPrice)
        };
      }
      return i;
    });
    setItems(updated);
    savePriceList(updated);
    setEditingItemId(null);
  };

  const handleResetCatalog = () => {
    if (window.confirm("¿Deseas restablecer la lista de precios a sus valores de fábrica originales?")) {
      localStorage.removeItem('optica_custom_price_list');
      setItems(defaultPriceList);
      setEditingItemId(null);
    }
  };

  // Stats calculation
  const totalProducts = items.length;
  const stockCount = items.filter(i => i.category === 'Lentes de Stock').length;
  const labCount = items.filter(i => i.category === 'Monofocal Lab').length;
  const multiCount = items.filter(i => i.category.includes('Multifocal') || i.category.includes('Bifocal')).length;
  const calibCount = items.filter(i => i.category === 'Calibrados y Trabajos').length;

  return (
    <div className="price-list-container">
      {/* Header */}
      <div className="flex-between align-center mb-4 flex-wrap gap-3">
        <div>
          <span className="badge badge-primary mb-1">Catálogo Oficial</span>
          <h2 className="m-0 flex-align-center gap-2">
            <BookOpen size={24} className="text-primary" />
            Lista de Precios y Productos
          </h2>
          <p className="text-secondary font-sm m-0">
            Consulta, busca y gestiona las tarifas oficiales de cristales y servicios de calibrado.
          </p>
        </div>

        <button 
          type="button" 
          className="btn btn-outline text-warning border-warning btn-sm flex-align-center gap-2"
          onClick={handleResetCatalog}
          title="Restablecer catálogo original"
        >
          <RotateCcw size={16} />
          Restablecer Catálogo Original
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid-4 mb-4">
        <div className="stat-card glass-card p-3">
          <div className="stat-icon bg-primary-soft">
            <Tag size={20} className="text-primary" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Lentes de Stock</span>
            <h4 className="stat-value m-0">{stockCount} ítems</h4>
          </div>
        </div>

        <div className="stat-card glass-card p-3">
          <div className="stat-icon bg-info-soft">
            <Tag size={20} className="text-info" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Monofocales Lab</span>
            <h4 className="stat-value m-0">{labCount} ítems</h4>
          </div>
        </div>

        <div className="stat-card glass-card p-3">
          <div className="stat-icon bg-purple-soft">
            <Tag size={20} className="text-purple" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Bifocales / Multifocales</span>
            <h4 className="stat-value m-0">{multiCount} ítems</h4>
          </div>
        </div>

        <div className="stat-card glass-card p-3">
          <div className="stat-icon bg-success-soft">
            <DollarSign size={20} className="text-success" />
          </div>
          <div className="stat-info">
            <span className="stat-label">Calibrados y Trabajos</span>
            <h4 className="stat-value m-0">{calibCount} ítems</h4>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="glass-card p-3 mb-4">
        <div className="grid-3 gap-3 align-center">
          {/* Search */}
          <div className="input-search-container w-full">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="form-control pl-5"
              placeholder="Buscar por nombre de cristal, marca o graduación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div className="flex-align-center gap-2">
            <Filter size={16} className="text-muted" />
            <select
              className="form-control form-control-sm"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">Todas las Categorías ({categories.length})</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex-align-center gap-2">
            <span className="font-xs text-muted">Tipo:</span>
            <select
              className="form-control form-control-sm"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="">Todos los Tipos</option>
              {types.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="glass-card p-4">
        <div className="flex-between align-center mb-3">
          <span className="text-secondary font-sm">
            Mostrando <strong>{filteredItems.length}</strong> de {totalProducts} productos en catálogo
          </span>
        </div>

        <div className="overflow-x">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>ID</th>
                <th style={{ width: '160px' }}>Categoría</th>
                <th>Nombre del Producto / Descripción</th>
                <th style={{ width: '130px' }}>Tipo</th>
                <th className="text-right" style={{ width: '130px' }}>Precio Par</th>
                <th className="text-right" style={{ width: '130px' }}>Precio 1/2 Par</th>
                <th className="text-center" style={{ width: '90px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center text-muted py-4">
                    No se encontraron productos que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const isEditing = editingItemId === item.id;

                  return (
                    <tr key={item.id}>
                      <td className="font-mono text-muted font-xs">#{item.id}</td>
                      <td>
                        <span className="badge-small bg-primary-soft text-primary">
                          {item.category}
                        </span>
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className="form-control form-control-sm font-semibold"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        ) : (
                          <div className="font-semibold text-primary-dark">
                            {item.name}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="font-xs text-secondary">{item.type || '-'}</span>
                      </td>
                      <td className="text-right font-mono font-bold text-success">
                        {isEditing ? (
                          <input
                            type="number"
                            className="form-control form-control-sm text-right font-bold"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                          />
                        ) : (
                          formatMoney(item.price)
                        )}
                      </td>
                      <td className="text-right font-mono font-medium text-secondary">
                        {isEditing ? (
                          formatMoney(Number(editPrice) / 2)
                        ) : (
                          formatMoney(item.price / 2)
                        )}
                      </td>
                      <td className="text-center">
                        {isEditing ? (
                          <div className="flex-align-center justify-center gap-1">
                            <button
                              type="button"
                              className="btn-icon text-success"
                              onClick={() => handleSaveEdit(item.id)}
                              title="Guardar cambios"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon text-danger"
                              onClick={() => setEditingItemId(null)}
                              title="Cancelar"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn-icon text-primary"
                            onClick={() => handleStartEdit(item)}
                            title="Editar precio o nombre"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
