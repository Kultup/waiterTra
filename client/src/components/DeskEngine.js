import React, { useEffect, useRef, useState } from 'react';
import './VirtualDesk.css';
import DeskScene, { DESK_SIZE } from './virtualDesk/DeskScene';
import { isAssetUrl, resolveAssetUrl } from '../utils/assetUrl';

const normalizeInventoryDish = (dish, index) => {
  const sourceId = String(dish._id || dish.type || dish.id || dish.name || `dish-${index}`);
  const inventoryId = String(dish.inventoryId || `${sourceId}-${index}`);

  return {
    ...dish,
    inventoryId,
    id: inventoryId,
    _id: sourceId,
  };
};

const DeskEngine = ({
  dishes,
  description,
  timeLimit = 0,
  deskSurfacePreset = 'walnut',
  deskSurfaceColor = '#ffffff',
  underlays = [],
  onSubmit,
  onResult,
  embedded = false,
  nextButton,
}) => {
  const [items, setItems] = useState([]);
  const [availableDishes, setAvailableDishes] = useState([]);
  const [selectedDish, setSelectedDish] = useState(null);
  const [result, setResult] = useState(null);
  const [semanticFeedback, setSemanticFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const handleCheckRef = useRef(null);
  const inventoryRegistryRef = useRef(new Map());
  const inventoryOrderRef = useRef(new Map());
  const placementGuardRef = useRef({
    time: 0,
    x: null,
    y: null,
    dishKey: null,
  });

  useEffect(() => {
    const registry = new Map();
    const order = new Map();
    const normalizedDishes = dishes.map(normalizeInventoryDish);

    normalizedDishes.forEach((dish, index) => {
      registry.set(dish.inventoryId, dish);
      order.set(dish.inventoryId, index);
    });

    inventoryRegistryRef.current = registry;
    inventoryOrderRef.current = order;
    setAvailableDishes(normalizedDishes);
  }, [dishes]);

  useEffect(() => {
    if (availableDishes.length === 0) {
      setSelectedDish(null);
      return;
    }

    if (!selectedDish) {
      setSelectedDish(availableDishes[0]);
      return;
    }

    const selectedDishId = String(selectedDish.inventoryId || selectedDish.id || selectedDish._id);
    const stillAvailable = availableDishes.find((dish) => String(dish.inventoryId || dish.id || dish._id) === selectedDishId);
    if (!stillAvailable) {
      setSelectedDish(availableDishes[0]);
    }
  }, [availableDishes, selectedDish]);

  useEffect(() => {
    if (timeLimit > 0 && !result) {
      setTimeLeft(timeLimit * 60);
    }
  }, [timeLimit, result]);

  useEffect(() => {
    if (timeLeft === null || result) return undefined;
    if (timeLeft === 0) {
      handleCheckRef.current?.();
      return undefined;
    }

    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, result]);

  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  const handleDeskClick = (event) => {
    if (result || !selectedDish) return;
    if (event.target instanceof Element && event.target.closest('.desk-item')) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * DESK_SIZE;
    const y = ((event.clientY - rect.top) / rect.height) * DESK_SIZE;
    const nextDishKey = selectedDish.id || selectedDish._id || selectedDish.type || selectedDish.name;
    const now = Date.now();
    const previousPlacement = placementGuardRef.current;
    const isDuplicatePlacement =
      previousPlacement.dishKey === nextDishKey
      && previousPlacement.x !== null
      && previousPlacement.y !== null
      && now - previousPlacement.time < 300
      && Math.abs(previousPlacement.x - x) < 6
      && Math.abs(previousPlacement.y - y) < 6;

    if (isDuplicatePlacement) return;

    placementGuardRef.current = {
      time: now,
      x,
      y,
      dishKey: nextDishKey,
    };

    const selectedDishId = String(selectedDish.inventoryId || selectedDish.id || selectedDish._id || selectedDish.type || selectedDish.name);
    const nextAvailableDishes = availableDishes.filter((dish) => (
      String(dish.inventoryId || dish.id || dish._id || dish.type || dish.name) !== selectedDishId
    ));

    setAvailableDishes(nextAvailableDishes);
    setSelectedDish(nextAvailableDishes[0] || null);

    setItems((prev) => [
      ...prev,
      {
        _id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        inventoryId: selectedDishId,
        name: selectedDish.name,
        icon: selectedDish.icon,
        x,
        y,
        type: selectedDish.type || selectedDish.id || selectedDish._id,
        width: selectedDish.width ?? 40,
        height: selectedDish.height ?? 40,
        rotation: selectedDish.rotation ?? 0,
        zIndex: selectedDish.zIndex ?? prev.length,
      },
    ]);
  };

  const handleDelete = (itemId) => {
    if (result) return;

    const removedItem = items.find((item) => item._id === itemId);
    if (!removedItem) return;

    setItems((prev) => prev.filter((item) => item._id !== itemId));

    const restoredDish = inventoryRegistryRef.current.get(String(removedItem.inventoryId));
    if (!restoredDish) return;

    setAvailableDishes((prev) => (
      [...prev, restoredDish].sort((left, right) => (
        (inventoryOrderRef.current.get(String(left.inventoryId || left.id || left._id)) ?? 0) -
        (inventoryOrderRef.current.get(String(right.inventoryId || right.id || right._id)) ?? 0)
      ))
    ));

    setSelectedDish((current) => current || restoredDish);
  };

  const handleCheck = async () => {
    if (result || items.length === 0) return;

    try {
      const payload = items.map(({ type, name, icon, x, y, width, height, rotation, zIndex }) => ({
        type,
        name,
        icon,
        x,
        y,
        width,
        height,
        rotation,
        zIndex,
      }));

      const response = await onSubmit(payload);
      const mergedItems = items.map((item, index) => ({
        ...item,
        isCorrect: response.validatedItems?.[index]?.isCorrect ?? false,
      }));

      setItems(mergedItems);
      setSemanticFeedback(response.semanticFeedback || null);

      const nextResult = {
        score: response.score,
        total: response.total,
        percentage: response.percentage,
        passed: response.passed,
        semanticFeedback: response.semanticFeedback || null,
        submittedItems: payload,
      };

      setResult(nextResult);
      onResult?.(nextResult);
    } catch (error) {
      console.error('Desk check error:', error);
      alert('Помилка при перевірці');
    }
  };

  handleCheckRef.current = handleCheck;

  return (
    <div className={`virtual-desk-container student-test ${result ? 'has-result' : ''}`} style={embedded ? { flex: 1 } : {}}>
      <header className="desk-header">
        <div className="header-info">
          {description && (
            <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '10px', padding: '0.6rem 1rem', marginBottom: '0.4rem', fontSize: '0.9rem', color: '#e2e8f0', lineHeight: 1.4 }}>
              📋 {description}
            </div>
          )}
          <p>На столі: {items.length} предметів</p>
        </div>
        <div className="header-actions">
          {timeLeft !== null && !result && (
            <span className={`test-timer ${timeLeft < 60 ? 'timer-warning' : ''}`} style={{ fontSize: '1.4rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              ⏱ {formatTime(timeLeft)}
            </span>
          )}
          {!result && (
            <button className="btn-add" onClick={handleCheck} disabled={items.length === 0}>
              Перевірити результат
            </button>
          )}
          {result && nextButton}
        </div>
      </header>

      <div className="desk-body">
        <aside className="desk-panel inventory-panel">
          <div className="panel-label">Посуд</div>
          <div className="inventory-grid">
            {availableDishes.map((dish) => (
              <div
                key={dish.inventoryId || dish.id || dish._id}
                className={`inv-item ${selectedDish && (selectedDish.inventoryId || selectedDish.id || selectedDish._id) === (dish.inventoryId || dish.id || dish._id) ? 'active' : ''}`}
                onClick={() => !result && setSelectedDish(dish)}
              >
                <span className="inv-icon">
                  {dish.icon && isAssetUrl(dish.icon) ? (
                    <img
                      src={resolveAssetUrl(dish.icon)}
                      alt={dish.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        transform: `rotate(${(((dish.rotation || 0) % 360) + 360) % 360}deg)`,
                      }}
                    />
                  ) : (
                    dish.icon || '🍽️'
                  )}
                </span>
                <span className="inv-name">{dish.name}</span>
              </div>
            ))}
            {availableDishes.length === 0 && <div className="sidebar-empty">Немає посуду</div>}
          </div>
        </aside>

        <DeskScene
          items={items}
          underlays={underlays}
          dishes={dishes}
          ghostItems={[]}
          surfacePreset={deskSurfacePreset}
          surfaceColor={deskSurfaceColor}
          onDeskClick={handleDeskClick}
          allowDeskClickThroughItems
          onDeleteItem={(event, item) => {
            event.stopPropagation();
            handleDelete(item._id);
          }}
          showDeleteControl={!result}
          emptyIcon="📋"
          emptyLabel="Розпочніть сервірування"
        />

        {result && (
          <aside className="desk-panel results-panel">
            <div className="panel-label">Результат</div>
            <div className="result-card">
              <div className="result-score" style={{ color: result.passed ? '#4ade80' : '#f87171' }}>
                {result.percentage}%
              </div>
              <p>Правильно: {result.score} з {result.total}</p>
              <p className="result-status">
                {result.passed ? 'Пройдено' : 'Не пройдено'}
              </p>
              {semanticFeedback?.summary && (
                <div style={{ marginTop: '1rem', textAlign: 'left', fontSize: '0.85rem', color: '#cbd5e1' }}>
                  <strong>Підказки:</strong>
                  {semanticFeedback.issues?.map((issue, index) => (
                    <div key={`${issue.type}-${index}`} style={{ marginTop: '0.45rem' }}>
                      • {issue.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default DeskEngine;
