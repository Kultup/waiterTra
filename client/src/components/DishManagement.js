import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import API_URL from '../api';
import ConfirmModal from './ConfirmModal';
import './DishManagement.css';
import { useToast } from '../contexts/ToastContext';
import { isAssetUrl, resolveAssetUrl } from '../utils/assetUrl';
import { getUploadErrorMessage } from '../utils/uploadError';

const PRESET_ICONS = [
  '🍽️', '🍷', '🍴', '🔪', '🥄', '☕', '🍲', '🥣',
  '🥡', '🥢', '🍱', '🍻', '🥃', '🍞', '🥤', '🍜',
];

const DEFAULT_ICON = '🍽️';
const normalizeRotation = (value) => ((value % 360) + 360) % 360;

const DishManagement = () => {
  const [dishes, setDishes] = useState([]);
  const [editingDish, setEditingDish] = useState(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [rotation, setRotation] = useState(0);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, idToDelete: null });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const toast = useToast();

  const fetchDishes = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/dishes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDishes(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Помилка завантаження посуду');
    }
  }, [toast]);

  useEffect(() => {
    fetchDishes();
  }, [fetchDishes]);

  const resetForm = () => {
    setEditingDish(null);
    setName('');
    setIcon(DEFAULT_ICON);
    setRotation(0);
  };

  const handleRotate = (delta) => {
    setRotation((current) => normalizeRotation(current + delta));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error('Введіть назву предмету');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const payload = {
        name: name.trim(),
        icon,
        rotation: normalizeRotation(rotation),
      };
      const config = { headers: { Authorization: `Bearer ${token}` } };

      if (editingDish) {
        await axios.put(`${API_URL}/dishes/${editingDish._id}`, payload, config);
        toast.success('Предмет оновлено успішно');
      } else {
        await axios.post(`${API_URL}/dishes`, payload, config);
        toast.success('Предмет додано успішно');
      }

      resetForm();
      fetchDishes();
    } catch (err) {
      console.error(err);
      toast.error('Сталася помилка при збереженні');
    }
  };

  const handleConfirmDelete = async () => {
    const id = confirmModal.idToDelete;
    if (!id) return;

    setConfirmModal({ isOpen: false, idToDelete: null });

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/dishes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Предмет успішно видалено');
      fetchDishes();
    } catch (err) {
      console.error(err);
      toast.error('Сталася помилка при видаленні');
    }
  };

  const startEdit = (dish) => {
    setEditingDish(dish);
    setName(dish.name);
    setIcon(dish.icon || DEFAULT_ICON);
    setRotation(normalizeRotation(dish.rotation || 0));
  };

  const deleteClick = (id) => {
    setConfirmModal({ isOpen: true, idToDelete: id });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setIcon(res.data.url);
      setRotation(0);
      toast.success('Іконку завантажено');
    } catch (err) {
      console.error(err);
      toast.error(getUploadErrorMessage(err, 'файлу'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderIcon = (iconValue, options = {}) => {
    if (!iconValue) return null;

    const {
      className = '',
      rotationValue = 0,
    } = options;
    const normalizedRotation = normalizeRotation(rotationValue);

    if (isAssetUrl(iconValue)) {
      return (
        <img
          src={resolveAssetUrl(iconValue)}
          alt="icon"
          className={className}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: `rotate(${normalizedRotation}deg)`,
          }}
        />
      );
    }

    return (
      <span className={className} style={{ transform: `rotate(${normalizedRotation}deg)` }}>
        {iconValue}
      </span>
    );
  };

  const isPhotoIcon = isAssetUrl(icon);

  return (
    <div className="dish-management-container">
      <header className="content-header">
        <h2>🍽️ Керування предметами столу</h2>
      </header>

      <div className="dish-layout">
        <div className="dish-form-card">
          <h3>{editingDish ? 'Редагувати предмет' : 'Додати новий предмет'}</h3>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>Назва предмету</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Напр. Бокал для вина"
              />
            </div>

            <div className="form-group">
              <label>Іконка (Емодзі або фото)</label>
              <div className="icon-selector">
                {PRESET_ICONS.map((presetIcon) => (
                  <button
                    type="button"
                    key={presetIcon}
                    className={`icon-btn ${icon === presetIcon ? 'active' : ''}`}
                    onClick={() => {
                      setIcon(presetIcon);
                      setRotation(0);
                    }}
                  >
                    {presetIcon}
                  </button>
                ))}

                <input
                  type="text"
                  value={isPhotoIcon ? '🖼️ Фото' : icon}
                  onChange={(event) => {
                    setIcon(event.target.value);
                    setRotation(0);
                  }}
                  placeholder="Своє 💎"
                  className="custom-icon-input"
                  maxLength={4}
                  disabled={isPhotoIcon}
                />

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  accept="image/*"
                />

                <button
                  type="button"
                  className="btn-upload-icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? '⌛' : '📷'}
                </button>

                {isPhotoIcon && (
                  <>
                    <button
                      type="button"
                      className="btn-rotate-icon"
                      onClick={() => handleRotate(-90)}
                      title="Повернути вліво"
                    >
                      -90°
                    </button>
                    <button
                      type="button"
                      className="btn-rotate-icon"
                      onClick={() => handleRotate(90)}
                      title="Повернути вправо"
                    >
                      +90°
                    </button>
                    <button
                      type="button"
                      className="btn-remove-icon"
                      onClick={() => {
                        setIcon(DEFAULT_ICON);
                        setRotation(0);
                      }}
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>

              {isPhotoIcon && (
                <div className="icon-preview-tools">
                  <span className="rotation-indicator">Поворот: {normalizeRotation(rotation)}°</span>
                </div>
              )}

              {isPhotoIcon && (
                <div className="icon-preview-large">
                  <div className="icon-preview-stage">
                    {renderIcon(icon, { rotationValue: rotation })}
                  </div>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                {editingDish ? 'Зберегти зміни' : 'Створити'}
              </button>
              {editingDish && (
                <button type="button" className="btn-secondary" onClick={resetForm}>
                  Скасувати
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="dish-list-card">
          <h3>Збережені предмети ({dishes.length})</h3>
          {dishes.length === 0 ? (
            <div className="empty-dish-msg">
              У вас ще немає доданих предметів. Створіть перший зліва!
            </div>
          ) : (
            <div className="dish-grid">
              {dishes.map((dish) => (
                <div key={dish._id} className="dish-item-card">
                  <div className="dish-icon-preview">
                    {renderIcon(dish.icon, { rotationValue: dish.rotation || 0 })}
                  </div>
                  <div className="dish-details">
                    <h4>{dish.name}</h4>
                    <span>Поворот: {normalizeRotation(dish.rotation || 0)}°</span>
                    <span>Додано: {new Date(dish.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="dish-actions">
                    <button className="btn-icon" onClick={() => startEdit(dish)} title="Редагувати">✏️</button>
                    <button className="btn-icon btn-danger" onClick={() => deleteClick(dish._id)} title="Видалити">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Видалення предмету"
        message="Ви впевнені, що хочете видалити цей предмет столу? Це може вплинути на існуючі сервіровки."
        confirmText="Видалити предмет"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmModal({ isOpen: false, idToDelete: null })}
      />
    </div>
  );
};

export default DishManagement;
