import React, { useEffect, useState } from 'react';
import API_URL from '../../api';

export const DESK_SIZE = 500;

const photoTrimCache = new Map();

const computeTrimBounds = (image) => {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);

  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let index = 3; index < data.length; index += 4) {
    if (data[index] <= 12) continue;

    const pixelIndex = (index - 3) / 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  if (maxX === -1 || maxY === -1) {
    return {
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      trimLeft: 0,
      trimTop: 0,
      trimWidth: image.naturalWidth,
      trimHeight: image.naturalHeight,
    };
  }

  return {
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    trimLeft: minX,
    trimTop: minY,
    trimWidth: Math.max(1, maxX - minX + 1),
    trimHeight: Math.max(1, maxY - minY + 1),
  };
};

const TrimmedPhotoImage = ({ src, alt, boxWidth, boxHeight }) => {
  const [trimData, setTrimData] = useState(() => photoTrimCache.get(src) || null);

  useEffect(() => {
    if (!src || trimData || typeof window === 'undefined') return undefined;

    let isActive = true;
    const image = new window.Image();

    image.onload = () => {
      if (!isActive) return;

      try {
        const nextTrimData = computeTrimBounds(image);
        photoTrimCache.set(src, nextTrimData);
        setTrimData(nextTrimData);
      } catch (error) {
        const fallbackTrimData = {
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          trimLeft: 0,
          trimTop: 0,
          trimWidth: image.naturalWidth,
          trimHeight: image.naturalHeight,
        };
        photoTrimCache.set(src, fallbackTrimData);
        setTrimData(fallbackTrimData);
      }
    };

    image.onerror = () => {
      if (!isActive) return;
      setTrimData(null);
    };

    image.src = src;

    return () => {
      isActive = false;
    };
  }, [src, trimData]);

  if (!trimData || !boxWidth || !boxHeight) {
    return (
      <img
        src={src}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    );
  }

  const scale = Math.min(boxWidth / trimData.trimWidth, boxHeight / trimData.trimHeight);
  const offsetX = ((boxWidth - trimData.trimWidth * scale) / 2) - trimData.trimLeft * scale;
  const offsetY = ((boxHeight - trimData.trimHeight * scale) / 2) - trimData.trimTop * scale;

  return (
    <span style={{ position: 'relative', display: 'block', width: '100%', height: '100%', overflow: 'hidden' }}>
      <img
        src={src}
        alt={alt}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: `${trimData.naturalWidth}px`,
          height: `${trimData.naturalHeight}px`,
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          transformOrigin: 'top left',
          display: 'block',
        }}
      />
    </span>
  );
};

export const resolveIcon = (item, dishes) => {
  if (item.icon) return item.icon;
  return dishes.find((dish) => String(dish._id || dish.id) === String(item.type))?.icon || '🍽️';
};

export const getItemProfile = (item) => {
  const text = `${item.name || ''} ${item.type || ''}`.toLowerCase();

  if (/cup|mug|чаш|круж|coffee|tea/.test(text)) return 'cup';
  if (/plate|dish|таріл|блюд|saucer/.test(text)) return 'flat';
  if (/glass|wine|champagne|келих|склян/.test(text)) return 'glass';
  if (/fork|knife|spoon|ложк|видел|вилк|ніж/.test(text)) return 'utensil';

  return 'default';
};

const buildItemStyle = (item, options = {}) => {
  const depthScale = options.disableDepthScale
    ? 1
    : 0.88 + ((item.y || 0) / DESK_SIZE) * 0.18;
  const layerBase = options.layerBase ?? 20;
  const itemHeight = `${item.height ?? 40}px`;

  const style = {
    left: `${((item.x || 0) / DESK_SIZE) * 100}%`,
    top: `${((item.y || 0) / DESK_SIZE) * 100}%`,
    width: `${item.width ?? 40}px`,
    transform: `translate(-50%, -50%) rotate(${item.rotation || 0}deg) scale(${depthScale})`,
    zIndex: layerBase + (item.zIndex ?? Math.round(item.y || 0)),
  };

  if (options.fixedHeight) {
    style.height = itemHeight;
  } else {
    style.minHeight = itemHeight;
  }

  return style;
};

const compareByZIndex = (left, right) => (
  (left.zIndex ?? Math.round(left.y || 0)) - (right.zIndex ?? Math.round(right.y || 0))
);

const getTopmostLayerAtPoint = (event) => {
  if (typeof document === 'undefined' || typeof document.elementsFromPoint !== 'function') {
    return null;
  }

  const layersAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
  for (const element of layersAtPoint) {
    if (!(element instanceof HTMLElement)) continue;

    const layerNode = element.closest('[data-layer-kind][data-layer-id]');
    if (layerNode) {
      return {
        kind: layerNode.dataset.layerKind,
        id: layerNode.dataset.layerId,
      };
    }
  }

  return null;
};

const isTopmostLayerTarget = (event, kind, id) => {
  const topmostLayer = getTopmostLayerAtPoint(event);
  if (!topmostLayer) return true;

  return topmostLayer.kind === kind && topmostLayer.id === String(id);
};

const DeskScene = ({
  deskRef,
  items,
  underlays = [],
  dishes,
  ghostItems = [],
  surfacePreset = 'walnut',
  surfaceColor = '#ffffff',
  selectedItemId = null,
  activeItemId = null,
  draggingItemId = null,
  emptyIcon = '+',
  emptyLabel = 'Натисніть для розміщення',
  onDeskClick,
  onItemClick,
  onItemPointerDown,
  onResizePointerDown,
  onRotateItem,
  onDeleteItem,
  showPlaceholder = true,
  showTransformControls = false,
  showDeleteControl = false,
  selectedUnderlayId = null,
  activeUnderlayId = null,
  onUnderlayClick,
  onUnderlayPointerDown,
  onUnderlayResizePointerDown,
  onDeleteUnderlay,
  showUnderlayControls = false,
  allowDeskClickThroughItems = false,
  forceItemsAboveUnderlays = false,
}) => {
  const sortedUnderlays = [...underlays].sort(compareByZIndex);
  const sortedItems = [...items].sort(compareByZIndex);
  const underlayLayerBase = forceItemsAboveUnderlays ? 0 : 20;
  const itemLayerBase = forceItemsAboveUnderlays ? 200 : 20;
  const ghostLayerBase = forceItemsAboveUnderlays ? 180 : 20;

  return (
    <div className="desk-workspace">
    <div className="desk-stage">
      <div className="desk-stage-shadow" aria-hidden="true" />
      <div className="desk-stage-base" aria-hidden="true" />
      <div
        ref={deskRef}
        className={`square-desk isometric-desk desk-surface-${surfacePreset}`}
        style={surfacePreset === 'transparent' ? undefined : { background: surfaceColor }}
        onClick={onDeskClick}
      >
        <div className="desk-grid" aria-hidden="true" />
        <div className="desk-guide desk-guide-horizontal" aria-hidden="true" />
        <div className="desk-guide desk-guide-vertical" aria-hidden="true" />

        {sortedUnderlays.map((underlay) => (
          <div
            key={`underlay-${underlay.id}`}
            data-layer-kind="underlay"
            data-layer-id={underlay.id}
            className={`desk-underlay ${activeUnderlayId === underlay.id ? 'dragging' : ''} ${selectedUnderlayId === underlay.id ? 'selected' : ''}`}
            style={buildItemStyle(underlay, { disableDepthScale: true, layerBase: underlayLayerBase, fixedHeight: true })}
            onClick={onUnderlayClick ? ((event) => {
              event.stopPropagation();
              if (!isTopmostLayerTarget(event, 'underlay', underlay.id)) return;
              onUnderlayClick(event, underlay);
            }) : undefined}
            onPointerDown={onUnderlayPointerDown ? ((event) => {
              if (!isTopmostLayerTarget(event, 'underlay', underlay.id)) return;
              onUnderlayPointerDown(event, underlay);
            }) : undefined}
          >
            <div className="desk-underlay-content">
              <img
                src={underlay.image.startsWith('http') ? underlay.image : `${API_URL.replace('/api', '')}${underlay.image}`}
                alt={underlay.name || 'underlay'}
                className="desk-underlay-image"
              />
            </div>
            {showUnderlayControls && (
              <>
                <div className="desk-item-controls" onPointerDown={(event) => event.stopPropagation()}>
                  <button
                    className="item-delete"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => onDeleteUnderlay?.(event, underlay)}
                  >
                    x
                  </button>
                </div>
                {[
                  'n', 's', 'e', 'w',
                  'ne', 'nw', 'se', 'sw',
                ].map((direction) => (
                  <button
                    key={`${underlay.id}-${direction}`}
                    className={`underlay-resize-handle underlay-resize-${direction}`}
                    onPointerDown={(event) => onUnderlayResizePointerDown?.(event, underlay, direction)}
                    title="Змінити розмір"
                  />
                ))}
              </>
            )}
          </div>
        ))}

        {ghostItems.map((item, index) => {
          const itemIcon = resolveIcon(item, dishes);
          const isImage = itemIcon.startsWith('http') || itemIcon.startsWith('/uploads');

          return (
            <div
              key={`ghost-${item.id || item.type || index}`}
              className={`desk-item ghost-item ${isImage ? 'is-photo-item' : ''} item-profile-${getItemProfile(item)}`}
              style={buildItemStyle(item, { layerBase: ghostLayerBase, fixedHeight: isImage })}
            >
              <div className="desk-item-content">
                <span className={`item-icon ${isImage ? 'item-icon-photo' : ''}`}>
                  {isImage ? (
                    <TrimmedPhotoImage
                      src={itemIcon.startsWith('http') ? itemIcon : `${API_URL.replace('/api', '')}${itemIcon}`}
                      alt={item.name || 'ghost-item'}
                      boxWidth={item.width ?? 40}
                      boxHeight={item.height ?? 40}
                    />
                  ) : (
                    itemIcon
                  )}
                </span>
                <span className="item-text">{item.name}</span>
              </div>
            </div>
          );
        })}

        {sortedItems.map((item) => {
          const itemIcon = resolveIcon(item, dishes);
          const isImage = itemIcon.startsWith('http') || itemIcon.startsWith('/uploads');
          const showControls = showTransformControls || showDeleteControl;

          return (
            <div
              key={item._id || item.id}
              data-layer-kind="item"
              data-layer-id={item._id || item.id}
              className={`desk-item ${isImage ? 'is-photo-item' : ''} item-profile-${getItemProfile(item)} ${draggingItemId === (item._id || item.id) || activeItemId === (item._id || item.id) ? 'dragging' : ''} ${activeItemId === (item._id || item.id) || selectedItemId === (item._id || item.id) ? 'selected' : ''} ${item.isCorrect === true ? 'correct' : ''} ${item.isCorrect === false ? 'incorrect' : ''}`}
              style={buildItemStyle(item, { layerBase: itemLayerBase, fixedHeight: isImage })}
              onClick={allowDeskClickThroughItems
                ? onItemClick ? ((event) => {
                    event.stopPropagation();
                    if (!isTopmostLayerTarget(event, 'item', item._id || item.id)) return;
                    onItemClick(event, item);
                  }) : undefined
                : ((event) => {
                    event.stopPropagation();
                    if (!isTopmostLayerTarget(event, 'item', item._id || item.id)) return;
                    onItemClick?.(event, item);
                  })}
              onPointerDown={onItemPointerDown ? ((event) => {
                if (!isTopmostLayerTarget(event, 'item', item._id || item.id)) return;
                onItemPointerDown(event, item);
              }) : undefined}
            >
              <div className="desk-item-shadow" aria-hidden="true" />
              <div className="desk-item-content">
                <span className={`item-icon ${isImage ? 'item-icon-photo' : ''}`}>
                  {isImage ? (
                    <TrimmedPhotoImage
                      src={itemIcon.startsWith('http') ? itemIcon : `${API_URL.replace('/api', '')}${itemIcon}`}
                      alt={item.name}
                      boxWidth={item.width ?? 40}
                      boxHeight={item.height ?? 40}
                    />
                  ) : (
                    itemIcon
                  )}
                </span>
                <span className="item-text">{item.name}</span>
              </div>

              {showControls && (
                <div className="desk-item-controls" onPointerDown={(event) => event.stopPropagation()}>
                  {showTransformControls && (
                    <>
                      <button className="item-control" onClick={(event) => onRotateItem?.(event, item, -15)} title="Повернути ліворуч">⟲</button>
                      <button className="item-control" onClick={(event) => onRotateItem?.(event, item, 15)} title="Повернути праворуч">⟳</button>
                    </>
                  )}
                  {showDeleteControl && (
                    <button
                      className="item-delete"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => onDeleteItem?.(event, item)}
                    >
                      x
                    </button>
                  )}
                </div>
              )}

              {showTransformControls && onResizePointerDown && (
                <button
                  className="item-resize-handle"
                  onPointerDown={(event) => onResizePointerDown(event, item)}
                  title="Змінити розмір"
                />
              )}
            </div>
          );
        })}

        {items.length === 0 && showPlaceholder && (
          <div className="desk-placeholder">
            <span className="desk-icon">{emptyIcon}</span>
            <span className="desk-label">{emptyLabel}</span>
          </div>
        )}
      </div>

      <div className="desk-stage-front" aria-hidden="true">
        <div className="desk-stage-front-glow" />
      </div>
      <div className="desk-stage-leg desk-stage-leg-left" aria-hidden="true" />
      <div className="desk-stage-leg desk-stage-leg-right" aria-hidden="true" />
    </div>
  </div>
  );
};

export default DeskScene;
