import React, { useEffect, useRef, useState } from 'react';
import DeskScene, { DESK_SIZE } from './DeskScene';

const MIN_ITEM_SIZE = 28;
const MAX_ITEM_SIZE = 180;
const MIN_UNDERLAY_SIZE = 60;
const GRID_SIZE = 10;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const snapToGrid = (value) => Math.round(value / GRID_SIZE) * GRID_SIZE;

const toDeskPoint = (event, rect) => ({
  x: ((event.clientX - rect.left) / rect.width) * DESK_SIZE,
  y: ((event.clientY - rect.top) / rect.height) * DESK_SIZE,
});

const DeskCanvas = ({
  items,
  underlays = [],
  dishes,
  surfacePreset = 'walnut',
  surfaceColor = '#ffffff',
  selectedItemId = null,
  selectedUnderlayId = null,
  onSelectItem,
  onSelectUnderlay,
  draggingItemId,
  onDeskClick,
  onDeleteItem,
  onDeleteUnderlay,
  onItemPreview,
  onItemCommit,
  onUnderlayPreview,
  onUnderlayCommit,
}) => {
  const deskRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [activeItemId, setActiveItemId] = useState(null);
  const [activeUnderlayId, setActiveUnderlayId] = useState(null);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!dragRef.current || !deskRef.current) return;

      const rect = deskRef.current.getBoundingClientRect();
      const point = toDeskPoint(event, rect);
      let nextUpdates;

      if (dragRef.current.mode === 'resize') {
        if (dragRef.current.kind === 'underlay') {
          const minSize = MIN_UNDERLAY_SIZE;
          const deltaX = point.x - dragRef.current.startPoint.x;
          const deltaY = point.y - dragRef.current.startPoint.y;
          const direction = dragRef.current.direction || 'se';
          const affectsLeft = direction.includes('w');
          const affectsRight = direction.includes('e');
          const affectsTop = direction.includes('n');
          const affectsBottom = direction.includes('s');
          const startLeft = dragRef.current.startPosition.x - dragRef.current.startSize.width / 2;
          const startRight = dragRef.current.startPosition.x + dragRef.current.startSize.width / 2;
          const startTop = dragRef.current.startPosition.y - dragRef.current.startSize.height / 2;
          const startBottom = dragRef.current.startPosition.y + dragRef.current.startSize.height / 2;

          let nextLeft = startLeft;
          let nextRight = startRight;
          let nextTop = startTop;
          let nextBottom = startBottom;

          if (affectsLeft) {
            nextLeft = clamp(snapToGrid(startLeft + deltaX), 0, startRight - minSize);
          }
          if (affectsRight) {
            nextRight = clamp(snapToGrid(startRight + deltaX), startLeft + minSize, DESK_SIZE);
          }
          if (affectsTop) {
            nextTop = clamp(snapToGrid(startTop + deltaY), 0, startBottom - minSize);
          }
          if (affectsBottom) {
            nextBottom = clamp(snapToGrid(startBottom + deltaY), startTop + minSize, DESK_SIZE);
          }

          const nextWidth = Math.max(minSize, nextRight - nextLeft);
          const nextHeight = Math.max(minSize, nextBottom - nextTop);

          nextUpdates = {
            width: nextWidth,
            height: nextHeight,
            x: snapToGrid(nextLeft + nextWidth / 2),
            y: snapToGrid(nextTop + nextHeight / 2),
          };
        } else {
          const minSize = MIN_ITEM_SIZE;
          const maxSize = MAX_ITEM_SIZE;
          nextUpdates = {
            width: clamp(snapToGrid(dragRef.current.startSize.width + (point.x - dragRef.current.startPoint.x)), minSize, maxSize),
            height: clamp(snapToGrid(dragRef.current.startSize.height + (point.y - dragRef.current.startPoint.y)), minSize, maxSize),
          };
        }
      } else {
        if (dragRef.current.kind === 'underlay') {
          const halfWidth = (dragRef.current.startSize?.width || MIN_UNDERLAY_SIZE) / 2;
          const halfHeight = (dragRef.current.startSize?.height || MIN_UNDERLAY_SIZE) / 2;
          nextUpdates = {
            x: clamp(snapToGrid(point.x + dragRef.current.offsetX), halfWidth, DESK_SIZE - halfWidth),
            y: clamp(snapToGrid(point.y + dragRef.current.offsetY), halfHeight, DESK_SIZE - halfHeight),
          };
        } else {
          nextUpdates = {
            x: clamp(snapToGrid(point.x + dragRef.current.offsetX), 0, DESK_SIZE),
            y: clamp(snapToGrid(point.y + dragRef.current.offsetY), 0, DESK_SIZE),
          };
        }
      }

      dragRef.current.lastUpdates = nextUpdates;
      if (dragRef.current.kind === 'underlay') {
        onUnderlayPreview(dragRef.current.underlayId, nextUpdates);
      } else {
        onItemPreview(dragRef.current.itemId, nextUpdates);
      }

      if (Object.values(nextUpdates).some((value, index) => {
        const baseValues = dragRef.current.mode === 'resize'
          ? (
            dragRef.current.kind === 'underlay'
              ? [dragRef.current.startSize.width, dragRef.current.startSize.height, dragRef.current.startPosition.x, dragRef.current.startPosition.y]
              : [dragRef.current.startSize.width, dragRef.current.startSize.height]
          )
          : [dragRef.current.startPosition.x, dragRef.current.startPosition.y];
        return Math.abs(value - baseValues[index]) > 1;
      })) {
        suppressClickRef.current = true;
      }
    };

    const handlePointerUp = async () => {
      if (!dragRef.current) return;

      const { itemId, underlayId, lastUpdates, kind } = dragRef.current;
      dragRef.current = null;
      setActiveItemId(null);
      setActiveUnderlayId(null);

      if (lastUpdates) {
        if (kind === 'underlay') {
          await onUnderlayCommit(underlayId, lastUpdates);
        } else {
          await onItemCommit(itemId, lastUpdates);
        }
      }

      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onItemCommit, onItemPreview, onUnderlayCommit, onUnderlayPreview]);

  const handleDeskSurfaceClick = (event) => {
    if (suppressClickRef.current) return;
    onSelectItem?.(null);
    onSelectUnderlay?.(null);
    onDeskClick(event);
  };

  const handlePointerDown = (event, item) => {
    event.preventDefault();
    event.stopPropagation();

    if (!deskRef.current) return;

    const rect = deskRef.current.getBoundingClientRect();
    const point = toDeskPoint(event, rect);
    dragRef.current = {
      mode: 'move',
      kind: 'item',
      itemId: item._id,
      offsetX: item.x - point.x,
      offsetY: item.y - point.y,
      startPosition: { x: item.x, y: item.y },
      startSize: { width: item.width || MIN_ITEM_SIZE, height: item.height || MIN_ITEM_SIZE },
      lastUpdates: { x: item.x, y: item.y },
    };
    setActiveItemId(item._id);
    onSelectItem?.(item._id);
  };

  const handleUnderlayPointerDown = (event, underlay) => {
    event.preventDefault();
    event.stopPropagation();

    if (!deskRef.current) return;

    const rect = deskRef.current.getBoundingClientRect();
    const point = toDeskPoint(event, rect);
    dragRef.current = {
      mode: 'move',
      kind: 'underlay',
      underlayId: underlay.id,
      offsetX: underlay.x - point.x,
      offsetY: underlay.y - point.y,
      startPosition: { x: underlay.x, y: underlay.y },
      lastUpdates: { x: underlay.x, y: underlay.y },
    };
    setActiveUnderlayId(underlay.id);
    onSelectUnderlay?.(underlay.id);
    onSelectItem?.(null);
  };

  const handleResizePointerDown = (event, item) => {
    event.preventDefault();
    event.stopPropagation();

    if (!deskRef.current) return;

    const rect = deskRef.current.getBoundingClientRect();
    const point = toDeskPoint(event, rect);
    dragRef.current = {
      mode: 'resize',
      kind: 'item',
      itemId: item._id,
      startPoint: point,
      startSize: {
        width: item.width || MIN_ITEM_SIZE,
        height: item.height || MIN_ITEM_SIZE,
      },
      lastUpdates: {
        width: item.width || MIN_ITEM_SIZE,
        height: item.height || MIN_ITEM_SIZE,
      },
    };
    setActiveItemId(item._id);
    onSelectItem?.(item._id);
  };

  const handleUnderlayResizePointerDown = (event, underlay, direction = 'se') => {
    event.preventDefault();
    event.stopPropagation();

    if (!deskRef.current) return;

    const rect = deskRef.current.getBoundingClientRect();
    const point = toDeskPoint(event, rect);
    dragRef.current = {
      mode: 'resize',
      kind: 'underlay',
      direction,
      underlayId: underlay.id,
      startPoint: point,
      startPosition: {
        x: underlay.x,
        y: underlay.y,
      },
      startSize: {
        width: underlay.width || MIN_UNDERLAY_SIZE,
        height: underlay.height || MIN_UNDERLAY_SIZE,
      },
      lastUpdates: {
        width: underlay.width || MIN_UNDERLAY_SIZE,
        height: underlay.height || MIN_UNDERLAY_SIZE,
        x: underlay.x,
        y: underlay.y,
      },
    };
    setActiveUnderlayId(underlay.id);
    onSelectUnderlay?.(underlay.id);
    onSelectItem?.(null);
  };

  const handleRotate = async (event, item, delta) => {
    event.preventDefault();
    event.stopPropagation();
    const nextRotation = (((item.rotation || 0) + delta) % 360 + 360) % 360;
    onItemPreview(item._id, { rotation: nextRotation });
    await onItemCommit(item._id, { rotation: nextRotation });
  };

  return (
    <DeskScene
      deskRef={deskRef}
      items={items}
      underlays={underlays}
      dishes={dishes}
      surfacePreset={surfacePreset}
      surfaceColor={surfaceColor}
      selectedItemId={selectedItemId}
      selectedUnderlayId={selectedUnderlayId}
      activeItemId={activeItemId}
      activeUnderlayId={activeUnderlayId}
      draggingItemId={draggingItemId}
      onDeskClick={handleDeskSurfaceClick}
      onItemClick={(event, item) => {
        event.stopPropagation();
        onSelectItem?.(item._id);
      }}
      onItemPointerDown={handlePointerDown}
      onUnderlayClick={(event, underlay) => {
        event.stopPropagation();
        onSelectUnderlay?.(underlay.id);
        onSelectItem?.(null);
      }}
      onUnderlayPointerDown={handleUnderlayPointerDown}
      onResizePointerDown={handleResizePointerDown}
      onUnderlayResizePointerDown={handleUnderlayResizePointerDown}
      onRotateItem={handleRotate}
      onDeleteItem={(event, item) => onDeleteItem(event, item._id)}
      onDeleteUnderlay={(event, underlay) => onDeleteUnderlay(event, underlay.id)}
      showTransformControls
      showDeleteControl
      showUnderlayControls
      emptyIcon="+"
      emptyLabel="Натисніть для розміщення"
    />
  );
};

export default DeskCanvas;
