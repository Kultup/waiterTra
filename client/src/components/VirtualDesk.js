import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import './VirtualDesk.css';
import API_URL, { getUserPlatform } from '../api';
import DeskModal from './virtualDesk/DeskModal';
import InventoryPanel from './virtualDesk/InventoryPanel';
import DeskCanvas from './virtualDesk/DeskCanvas';
import TemplatesPanel from './virtualDesk/TemplatesPanel';
import { SURFACE_PRESETS } from './virtualDesk/surfacePresets';
import { copyText } from '../utils/clipboard';

const buildTemplateItems = (items, dishes) => (
  items.map(({ name, icon, x, y, type, id, width, height, rotation, zIndex }) => {
    const matchedDish = dishes.find((dish) => String(dish._id || dish.id) === String(type));

    return {
      id: id || `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
    icon: icon || dishes.find((dish) => String(dish._id) === String(type))?.icon || '🍽️',
      x,
      y,
      type,
      width: width ?? matchedDish?.width ?? 40,
      height: height ?? matchedDish?.height ?? 40,
      rotation: rotation ?? matchedDish?.rotation ?? 0,
      zIndex: zIndex ?? 0,
    };
  })
);

const buildTemplateUnderlays = (underlays) => (
  underlays.map(({ id, name, image, x, y, width, height, rotation, zIndex }) => ({
    id: id || `underlay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name || 'Підкладка',
    image,
    x,
    y,
    width: width ?? 180,
    height: height ?? 180,
    rotation: rotation ?? 0,
    zIndex: zIndex ?? -10,
  }))
);

const snapToGrid = (value) => Math.round(value / 10) * 10;
const DEFAULT_SURFACE_COLORS = ['#ffffff', '#f7f4ee', '#f3f4f6', '#efe7da', '#dbeafe', '#fee2e2'];
const SURFACE_PRESET_COLORS = {
  transparent: '#ffffff',
  walnut: '#8b6a4f',
  oak: '#c9a27a',
  marble: '#f3f4f6',
  linen: '#f7f4ee',
  slate: '#6b7280',
};
const VirtualDesk = () => {
  const [items, setItems] = useState([]);
  const [underlays, setUnderlays] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [selectedDish, setSelectedDish] = useState(null);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [timeLimit, setTimeLimit] = useState(0);
  const [description, setDescription] = useState('');
  const [deskSurfacePreset, setDeskSurfacePreset] = useState('walnut');
  const [deskSurfaceColor, setDeskSurfaceColor] = useState('#ffffff');
  const [targetCity, setTargetCity] = useState('');
  const [cities, setCities] = useState([]);
  const [filterCity, setFilterCity] = useState('');
  const [user, setUser] = useState(null);
  const [copyStatus, setCopyStatus] = useState(null);
  const [multiCopyStatus, setMultiCopyStatus] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [draggingItemId, setDraggingItemId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedUnderlayId, setSelectedUnderlayId] = useState(null);
  const [deskVisualStateLoaded, setDeskVisualStateLoaded] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    show: false,
    title: '',
    type: '',
    data: null,
  });
  const underlayInputRef = useRef(null);

  const getAuthConfig = useCallback(() => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  }, []);

  const resetEditorState = () => {
    setEditingTemplateId(null);
    setTemplateName('');
    setTimeLimit(0);
    setDescription('');
    setSelectedItemId(null);
    setSelectedUnderlayId(null);
    setTargetCity('');
  };

  const resetDeskSurfaceState = useCallback(() => {
    setDeskSurfacePreset('walnut');
    setDeskSurfaceColor('#ffffff');
  }, []);

  const applyDeskVisualState = useCallback((source = {}) => {
    setUnderlays(source.underlays || []);
    setDeskSurfacePreset(source.deskSurfacePreset || source.templateSnapshot?.deskSurfacePreset || 'walnut');
    setDeskSurfaceColor(source.deskSurfaceColor || source.templateSnapshot?.deskSurfaceColor || '#ffffff');
  }, []);

  const buildTemplatePayload = () => ({
    templateName: templateName.trim(),
    name: templateName.trim(),
  items: buildTemplateItems(items, dishes),
    underlays: buildTemplateUnderlays(underlays),
    timeLimit,
    description,
    deskSurfacePreset,
    deskSurfaceColor,
    targetCity: user?.role === 'superadmin' ? targetCity : undefined,
  });

  const fetchUser = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`, getAuthConfig());
      setUser(response.data);
    } catch (error) {
      console.error(error);
    }
  }, [getAuthConfig]);

  const fetchItems = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/desk-items`, getAuthConfig());
      setItems(response.data || []);
    } catch (error) {
      console.error(error);
    }
  }, [getAuthConfig]);

  const persistDeskVisualState = useCallback(async ({
    nextUnderlays = underlays,
    nextSurfacePreset = deskSurfacePreset,
    nextSurfaceColor = deskSurfaceColor,
  } = {}) => {
    if (!deskVisualStateLoaded) return;

    try {
      await axios.put(
        `${API_URL}/desk-state`,
        {
          underlays: buildTemplateUnderlays(nextUnderlays),
          deskSurfacePreset: nextSurfacePreset,
          deskSurfaceColor: nextSurfaceColor,
        },
        getAuthConfig()
      );
    } catch (error) {
      console.error('Failed to persist desk visual state:', error);
    }
  }, [deskSurfaceColor, deskSurfacePreset, deskVisualStateLoaded, getAuthConfig, underlays]);

  const fetchDeskVisualState = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/desk-state`, getAuthConfig());
      applyDeskVisualState(response.data || {});
    } catch (error) {
      console.error('Failed to fetch desk visual state:', error);
      applyDeskVisualState();
    } finally {
      setDeskVisualStateLoaded(true);
    }
  }, [applyDeskVisualState, getAuthConfig]);

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/templates`, getAuthConfig());
      setTemplates(response.data);
    } catch (error) {
      console.error('Fetch error:', error);
    }
  }, [getAuthConfig]);

  const fetchCities = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/cities${getUserPlatform() ? `?platform=${getUserPlatform()}` : ''}`);
      setCities(response.data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchDishes = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/dishes`, getAuthConfig());
      setDishes(response.data);
      if (response.data.length > 0) {
        setSelectedDish((current) => current || response.data[0]);
      }
    } catch (error) {
      console.error(error);
    }
  }, [getAuthConfig]);

  useEffect(() => {
    fetchUser();
    fetchItems();
    fetchDeskVisualState();
    fetchTemplates();
    fetchCities();
    fetchDishes();
  }, [fetchUser, fetchItems, fetchDeskVisualState, fetchTemplates, fetchCities, fetchDishes]);

  const handleDeskClick = async (event) => {
    if (!selectedDish) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = snapToGrid(((event.clientX - rect.left) / rect.width) * 500);
    const y = snapToGrid(((event.clientY - rect.top) / rect.height) * 500);

    try {
      const response = await axios.post(
        `${API_URL}/desk-items`,
        {
          name: selectedDish.name,
          icon: selectedDish.icon,
          x,
          y,
          type: selectedDish._id || selectedDish.id || 'custom',
          width: selectedDish.width ?? 40,
          height: selectedDish.height ?? 40,
          rotation: selectedDish.rotation ?? 0,
          zIndex: items.length,
        },
        getAuthConfig()
      );
      setItems((current) => [...current, response.data]);
    } catch (error) {
      console.error(error);
    }
  };

  const handleItemPreview = (id, updates) => {
    setDraggingItemId(id);
    setSelectedItemId(id);
    setItems((current) => current.map((item) => (
      item._id === id ? { ...item, ...updates } : item
    )));
  };

  const handleItemCommit = async (id, updates) => {
    try {
      await axios.patch(`${API_URL}/desk-items/${id}`, updates, getAuthConfig());
    } catch (error) {
      console.error(error);
      await fetchItems();
    } finally {
      setDraggingItemId(null);
    }
  };

  const applyLayerUpdates = async (updates) => {
    if (!updates.length) return;

    const nextItems = items.map((item) => {
      const next = updates.find((update) => update.kind === 'item' && update.id === item._id);
      return next ? { ...item, zIndex: next.zIndex } : item;
    });

    const nextUnderlays = underlays.map((underlay) => {
      const next = updates.find((update) => update.kind === 'underlay' && update.id === underlay.id);
      return next ? { ...underlay, zIndex: next.zIndex } : underlay;
    });

    setItems(nextItems);
    setUnderlays(nextUnderlays);

    const itemUpdates = updates.filter((update) => update.kind === 'item');
    await Promise.all(itemUpdates.map((update) => (
      axios.patch(`${API_URL}/desk-items/${update.id}`, { zIndex: update.zIndex }, getAuthConfig())
    )));

    if (updates.some((update) => update.kind === 'underlay')) {
      await persistDeskVisualState({ nextUnderlays });
    }
  };

  const moveSelectedLayer = async (direction) => {
    const activeLayer = selectedItemId
      ? { kind: 'item', id: selectedItemId }
      : selectedUnderlayId
        ? { kind: 'underlay', id: selectedUnderlayId }
        : null;

    if (!activeLayer) return;

    const layers = [
      ...underlays.map((underlay) => ({ kind: 'underlay', id: underlay.id, zIndex: underlay.zIndex ?? -10 })),
      ...items.map((item) => ({ kind: 'item', id: item._id, zIndex: item.zIndex ?? 0 })),
    ].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    const currentIndex = layers.findIndex((layer) => layer.kind === activeLayer.kind && layer.id === activeLayer.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex < 0 || targetIndex >= layers.length) return;

    const reorderedLayers = [...layers];
    [reorderedLayers[currentIndex], reorderedLayers[targetIndex]] = [reorderedLayers[targetIndex], reorderedLayers[currentIndex]];

    const normalizedUpdates = reorderedLayers.map((layer, index) => ({
      ...layer,
      zIndex: index,
    }));

    const changedUpdates = normalizedUpdates.filter((layer, index) => layer.id !== layers[index]?.id || layer.kind !== layers[index]?.kind);
    await applyLayerUpdates(changedUpdates);
  };

  const moveSelectedItemToFront = async () => {
    await moveSelectedLayer('up');
  };

  const moveSelectedItemToBack = async () => {
    await moveSelectedLayer('down');
  };

  const handleDeleteItem = async (event, id) => {
    event.stopPropagation();
    try {
      await axios.delete(`${API_URL}/desk-items/${id}`, getAuthConfig());
      setItems((current) => current.filter((item) => item._id !== id));
      if (selectedItemId === id) {
        setSelectedItemId(null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUnderlayPreview = (id, updates) => {
    setSelectedUnderlayId(id);
    setSelectedItemId(null);
    setUnderlays((current) => current.map((underlay) => (
      underlay.id === id ? { ...underlay, ...updates } : underlay
    )));
  };

  const handleUnderlayCommit = async (id, updates) => {
    const nextUnderlays = underlays.map((underlay) => (
      underlay.id === id ? { ...underlay, ...updates } : underlay
    ));

    setUnderlays(nextUnderlays);
    await persistDeskVisualState({ nextUnderlays });
  };

  const handleDeleteUnderlay = async (event, id) => {
    event.stopPropagation();
    const nextUnderlays = underlays.filter((underlay) => underlay.id !== id);

    setUnderlays(nextUnderlays);
    if (selectedUnderlayId === id) {
      setSelectedUnderlayId(null);
    }
    await persistDeskVisualState({ nextUnderlays });
  };

  const handleAddUnderlayClick = () => {
    underlayInputRef.current?.click();
  };

  const handleUnderlayUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(`${API_URL}/upload`, formData, {
        ...getAuthConfig(),
        headers: {
          ...getAuthConfig().headers,
          'Content-Type': 'multipart/form-data',
        },
      });

      const nextUnderlay = {
        id: `underlay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: file.name.replace(/\.[^.]+$/, '') || 'Підкладка',
        image: response.data.url,
        x: 250,
        y: 250,
        width: 220,
        height: 160,
        rotation: 0,
        zIndex: -10,
      };

      const nextUnderlays = [...underlays, nextUnderlay];

      setUnderlays(nextUnderlays);
      setSelectedUnderlayId(nextUnderlay.id);
      setSelectedItemId(null);
      await persistDeskVisualState({ nextUnderlays });
    } catch (error) {
      console.error(error);
      alert('Помилка при завантаженні підкладки');
    } finally {
      event.target.value = '';
    }
  };

  const handleClearDesk = () => {
    setModalConfig({ show: true, title: 'Очистити стіл', type: 'clear', data: null });
  };

  const handleSaveTemplateClick = async () => {
    if (!editingTemplateId) {
      setModalConfig({ show: true, title: 'Зберегти як шаблон', type: 'save', data: null });
      return;
    }

    if (!templateName.trim()) {
      alert('Введіть назву шаблону');
      return;
    }

    try {
      await axios.put(`${API_URL}/templates/${editingTemplateId}`, buildTemplatePayload(), getAuthConfig());
      resetEditorState();
      fetchTemplates();
    } catch (error) {
      console.error(error);
      alert('Помилка при оновленні шаблону');
    }
  };

  const loadTemplateToDesk = async (template) => {
    await axios.delete(`${API_URL}/desk-items`, getAuthConfig());

    const filteredItems = (template.items || []).filter((item) => (
      dishes.some((dish) => String(dish._id) === String(item.type))
    ));

    const newItems = await Promise.all(filteredItems.map((item) => {
      const fallbackIcon = item.icon || dishes.find((dish) => String(dish._id) === String(item.type))?.icon || '🍽️';
      return axios.post(`${API_URL}/desk-items`, { ...item, icon: fallbackIcon }, getAuthConfig());
    }));

    const nextItems = newItems.map((response) => response.data);
    const nextUnderlays = template.underlays || [];
    const nextSurfacePreset = template.deskSurfacePreset || template.templateSnapshot?.deskSurfacePreset || 'walnut';
    const nextSurfaceColor = template.deskSurfaceColor || template.templateSnapshot?.deskSurfaceColor || '#ffffff';

    setItems(nextItems);
    applyDeskVisualState(template);
    setSelectedItemId(null);
    setSelectedUnderlayId(null);
    await persistDeskVisualState({
      nextUnderlays,
      nextSurfacePreset,
      nextSurfaceColor,
    });
  };

  const handleConfirmModal = async () => {
    const { type, data } = modalConfig;

    try {
      if (type === 'save') {
        if (!templateName.trim()) {
          alert('Введіть назву шаблону');
          return;
        }

        await axios.post(`${API_URL}/templates`, buildTemplatePayload(), getAuthConfig());
        resetEditorState();
        fetchTemplates();
      } else if (type === 'load' || type === 'edit') {
        if (type === 'edit') {
          setEditingTemplateId(data._id);
          setTemplateName(data.templateName || data.name || '');
          setTimeLimit(data.timeLimit || 0);
          setDescription(data.description || '');
          setTargetCity(data.targetCity || '');
        } else {
          resetEditorState();
        }

        await loadTemplateToDesk(data);
      } else if (type === 'delete') {
        await axios.delete(`${API_URL}/templates/${data}`, getAuthConfig());
        setTemplates((current) => current.filter((template) => template._id !== data));

        if (editingTemplateId === data) {
          resetEditorState();
        }
      } else if (type === 'clear') {
        await axios.delete(`${API_URL}/desk-items`, getAuthConfig());
        setItems([]);
        setUnderlays([]);
        resetDeskSurfaceState();
        resetEditorState();
        await persistDeskVisualState({
          nextUnderlays: [],
          nextSurfacePreset: 'walnut',
          nextSurfaceColor: '#ffffff',
        });
      }
    } catch (error) {
      console.error(error);
      alert('Помилка при виконанні дії');
    } finally {
      setModalConfig((current) => ({ ...current, show: false }));
    }
  };

  const generateTestUrl = async (templateId) => {
    const template = templates.find((entry) => entry._id === templateId);
    const response = await axios.post(
      `${API_URL}/tests`,
      {
        templateId,
        templateName: template?.name || template?.templateName || 'Шаблон',
        targetCity: template?.targetCity || '',
      },
      getAuthConfig()
    );

    return `${window.location.origin}/test/${response.data.hash}`;
  };

  const handleCopyLink = async (templateId) => {
    try {
      const url = await generateTestUrl(templateId);
      await copyText(url);
      setCopyStatus(templateId);
      setTimeout(() => setCopyStatus(null), 3000);
    } catch (error) {
      alert('Помилка при копіюванні');
    }
  };

  const handleShareTelegram = async (templateId) => {
    try {
      const url = await generateTestUrl(templateId);
      window.open(
        `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Запрошую пройти тест по сервіруванню столу!')}`,
        '_blank'
      );
    } catch (error) {
      alert('Помилка');
    }
  };

  const handleCopyAllLink = async () => {
    if (templates.length === 0) {
      alert('Немає збережених шаблонів');
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}/tests/multi`,
        { templateIds: templates.map((template) => template._id), targetCity: '' },
        getAuthConfig()
      );
      const url = `${window.location.origin}/multi-test/${response.data.hash}`;
      await copyText(url);
      setMultiCopyStatus(true);
      setTimeout(() => setMultiCopyStatus(false), 3000);
    } catch (error) {
      alert('Помилка при створенні посилання');
    }
  };

  const handleExportTemplate = (template) => {
    try {
      const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `template_${template.name || template.templateName || 'export'}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Помилка при експорті шаблону');
    }
  };

  const handleImportTemplate = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (readerEvent) => {
      try {
        const importedData = JSON.parse(readerEvent.target.result);
        const payload = {
          templateName: importedData.templateName || importedData.name || 'Імпортований шаблон',
          name: importedData.name || importedData.templateName || 'Імпортований шаблон',
          items: importedData.items || [],
          timeLimit: importedData.timeLimit || 0,
          description: importedData.description || '',
          deskSurfacePreset: importedData.deskSurfacePreset || 'walnut',
          deskSurfaceColor: importedData.deskSurfaceColor || '#ffffff',
          underlays: importedData.underlays || [],
          targetCity: user?.role === 'superadmin' ? (importedData.targetCity || '') : undefined,
        };

        await axios.post(`${API_URL}/templates`, payload, getAuthConfig());
        fetchTemplates();
        alert('Шаблон успішно імпортовано');
      } catch (error) {
        console.error('Import error:', error);
        alert('Помилка при читанні файлу шаблону. Переконайтеся, що це коректний JSON.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const openLoadTemplateModal = (template) => {
    setModalConfig({ show: true, title: 'Завантажити шаблон', type: 'load', data: template });
  };

  const openEditTemplateModal = (template) => {
    setModalConfig({ show: true, title: 'Редагувати шаблон', type: 'edit', data: template });
  };

  const openDeleteTemplateModal = (templateId) => {
    setModalConfig({ show: true, title: 'Видалити шаблон', type: 'delete', data: templateId });
  };

  const modalTemplate = templates.find((template) => template._id === modalConfig.data);
  const selectedItem = items.find((item) => item._id === selectedItemId) || null;
  const selectedUnderlay = underlays.find((underlay) => underlay.id === selectedUnderlayId) || null;
  const selectedLayerLabel = selectedItem
    ? selectedItem.name
    : selectedUnderlay
      ? `Підкладка: ${selectedUnderlay.name}`
      : null;
  const applySurfacePreset = async (presetId) => {
    const nextSurfaceColor = presetId !== 'transparent'
      ? (SURFACE_PRESET_COLORS[presetId] || '#ffffff')
      : deskSurfaceColor;

    setDeskSurfacePreset(presetId);
    if (presetId !== 'transparent') {
      setDeskSurfaceColor(nextSurfaceColor);
    }

    await persistDeskVisualState({
      nextSurfacePreset: presetId,
      nextSurfaceColor,
    });
  };

  const handleSurfaceColorChange = async (nextColor) => {
    setDeskSurfaceColor(nextColor);
    await persistDeskVisualState({ nextSurfaceColor: nextColor });
  };

  return (
    <div className="virtual-desk-container">
      <header className="desk-header">
        <div className="header-info">
          {editingTemplateId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.5rem' }}>✏️</span>
                <input
                  type="text"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="Назва шаблону..."
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '5px', fontSize: '1rem', minWidth: '200px' }}
                />
                <input
                  type="number"
                  value={timeLimit}
                  onChange={(event) => setTimeLimit(parseInt(event.target.value, 10) || 0)}
                  placeholder="Час (хв)"
                  title="Час на проходження (хв, 0 - без обмежень)"
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '5px', fontSize: '1rem', width: '80px' }}
                />
              </div>
              <input
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Завдання для студента (необов'язково)..."
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#ccc', padding: '5px 10px', borderRadius: '5px', fontSize: '0.85rem', width: '100%' }}
              />
              <div className="surface-presets">
                {SURFACE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`surface-preset-chip ${deskSurfacePreset === preset.id ? 'active' : ''}`}
                    onClick={() => applySurfacePreset(preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="surface-color-row">
                <label className="surface-color-label" htmlFor="desk-surface-color-header">Колір столу</label>
                <input
                  id="desk-surface-color-header"
                  className="surface-color-input"
                  type="color"
                  value={deskSurfaceColor}
                  onChange={(event) => handleSurfaceColorChange(event.target.value)}
                />
                <span className="surface-color-value">{deskSurfaceColor}</span>
              </div>
            </div>
          ) : (
            <>
              <h1>🍽️ Сервірування</h1>
              <p>На столі: {items.length} предметів</p>
            </>
          )}
        </div>

        {user?.role === 'superadmin' && (
          <div className="header-city-selector" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '0.8rem', color: '#888' }}>📍 Місто:</span>
            <select
              value={targetCity}
              onChange={(event) => setTargetCity(event.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
            >
              <option value="" style={{ color: '#000' }}>Всі міста</option>
              {cities.map((city) => (
                <option key={city._id} value={city.name} style={{ color: '#000' }}>{city.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="header-actions">
          {items.length > 0 && (
            <button className="btn-header-ghost" onClick={handleClearDesk}>
              Очистити
            </button>
          )}
          {editingTemplateId && (
            <button className="btn-header-ghost btn-cancel-edit" onClick={resetEditorState}>
              Скасувати
            </button>
          )}
          <button className="btn-save-template" onClick={handleSaveTemplateClick}>
            {editingTemplateId ? 'Оновити' : 'Зберегти'}
          </button>
        </div>
      </header>

      <div className="desk-controls-panel">
        <div className="desk-control-card desk-surface-card">
          <div className="desk-toolbar">
            <div className="desk-toolbar-group desk-toolbar-presets">
              <div className="desk-control-title">Фон</div>
              <div className="surface-presets">
                {SURFACE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`surface-preset-chip ${deskSurfacePreset === preset.id ? 'active' : ''}`}
                    onClick={() => applySurfacePreset(preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="desk-toolbar-group desk-toolbar-color">
              <div className="desk-control-title">Колір</div>
              <div className="surface-color-row">
                <input
                  id="desk-surface-color-toolbar"
                  className="surface-color-input"
                  type="color"
                  value={deskSurfaceColor}
                  onChange={(event) => handleSurfaceColorChange(event.target.value)}
                  disabled={deskSurfacePreset === 'transparent'}
                />
                <span className="surface-color-value">{deskSurfaceColor}</span>
              </div>
              <div className="surface-swatches">
                {DEFAULT_SURFACE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`surface-swatch ${deskSurfaceColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleSurfaceColorChange(color)}
                    disabled={deskSurfacePreset === 'transparent'}
                    title={color}
                  />
                ))}
              </div>
            </div>

            <div className="desk-toolbar-group desk-toolbar-actions">
              <div className="desk-control-title">Дії</div>
              <div className="toolbar-action-row">
                <button type="button" className="btn-header-ghost underlay-add-btn" onClick={handleAddUnderlayClick}>
                  Розмальовка
                </button>
                <input
                  ref={underlayInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleUnderlayUpload}
                />
                <button className="btn-header-ghost" onClick={moveSelectedItemToFront} disabled={!selectedLayerLabel}>
                  Вище
                </button>
                <button className="btn-header-ghost" onClick={moveSelectedItemToBack} disabled={!selectedLayerLabel}>
                  Нижче
                </button>
              </div>
              <div className="toolbar-status-line">
                {selectedLayerLabel ? `Шар: ${selectedLayerLabel}` : 'Обери елемент для зміни шару'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="desk-body">
        <InventoryPanel dishes={dishes} selectedDish={selectedDish} onSelectDish={setSelectedDish} />

        <DeskCanvas
          items={items}
          underlays={underlays}
          dishes={dishes}
          surfacePreset={deskSurfacePreset}
          surfaceColor={deskSurfaceColor}
          selectedItemId={selectedItemId}
          selectedUnderlayId={selectedUnderlayId}
          onSelectItem={setSelectedItemId}
          onSelectUnderlay={setSelectedUnderlayId}
          draggingItemId={draggingItemId}
          onDeskClick={handleDeskClick}
          onDeleteItem={handleDeleteItem}
          onDeleteUnderlay={handleDeleteUnderlay}
          onItemPreview={handleItemPreview}
          onItemCommit={handleItemCommit}
          onUnderlayPreview={handleUnderlayPreview}
          onUnderlayCommit={handleUnderlayCommit}
        />

        <TemplatesPanel
          templates={templates}
          templatesOpen={templatesOpen}
          onToggleOpen={() => setTemplatesOpen((current) => !current)}
          multiCopyStatus={multiCopyStatus}
          onCopyAllLink={handleCopyAllLink}
          user={user}
          filterCity={filterCity}
          onFilterCityChange={setFilterCity}
          cities={cities}
          editingTemplateId={editingTemplateId}
          copyStatus={copyStatus}
          onImportTemplate={handleImportTemplate}
          onLoadTemplate={openLoadTemplateModal}
          onCopyLink={handleCopyLink}
          onShareTelegram={handleShareTelegram}
          onExportTemplate={handleExportTemplate}
          onEditTemplate={openEditTemplateModal}
          onDeleteTemplate={openDeleteTemplateModal}
        />
      </div>

      <DeskModal
        show={modalConfig.show}
        title={modalConfig.title}
        onClose={() => setModalConfig((current) => ({ ...current, show: false }))}
        onConfirm={handleConfirmModal}
      >
        {modalConfig.type === 'save' ? (
          <div className="modal-form">
            <div className="form-group">
              <label>Назва шаблону</label>
              <input
                type="text"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Введіть назву..."
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Завдання (що потрібно зробити)</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Наприклад: Накрийте стіл на 2 персони для вечері..."
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div className="form-group">
              <label>Час на проходження (хв, 0 - без обмежень)</label>
              <input
                type="number"
                value={timeLimit}
                onChange={(event) => setTimeLimit(parseInt(event.target.value, 10) || 0)}
                min="0"
              />
            </div>
            <div className="form-group">
              <label>Фон столу</label>
              <div className="surface-presets">
                {SURFACE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`surface-preset-chip ${deskSurfacePreset === preset.id ? 'active' : ''}`}
                    onClick={() => applySurfacePreset(preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="surface-color-row" style={{ marginTop: '0.75rem' }}>
                <label className="surface-color-label" htmlFor="desk-surface-color-modal">Колір столу</label>
                <input
                  id="desk-surface-color-modal"
                  className="surface-color-input"
                  type="color"
                  value={deskSurfaceColor}
                  onChange={(event) => handleSurfaceColorChange(event.target.value)}
                />
                <span className="surface-color-value">{deskSurfaceColor}</span>
              </div>
            </div>
            {user?.role === 'superadmin' && (
              <div className="form-group">
                <label>Призначити місту (залиште порожнім для всіх)</label>
                <select value={targetCity} onChange={(event) => setTargetCity(event.target.value)}>
                  <option value="">Всі міста</option>
                  {cities.map((city) => (
                    <option key={city._id} value={city.name}>{city.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : modalConfig.type === 'load' ? (
          <p>Завантажити шаблон "<strong>{modalConfig.data?.name || modalConfig.data?.templateName}</strong>"? Поточний стіл буде очищено.</p>
        ) : modalConfig.type === 'edit' ? (
          <p>Редагувати "<strong>{modalConfig.data?.name || modalConfig.data?.templateName}</strong>"? Поточний стіл буде замінено предметами шаблону.</p>
        ) : modalConfig.type === 'clear' ? (
          <p>Очистити стіл? Усі {items.length} предметів буде видалено.</p>
        ) : (
          <p>Видалити шаблон "<strong>{modalTemplate?.name || modalTemplate?.templateName}</strong>"?</p>
        )}
      </DeskModal>
    </div>
  );
};

export default VirtualDesk;
