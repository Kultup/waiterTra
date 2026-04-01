function toSerializableObject(value) {
  return typeof value?.toObject === 'function' ? value.toObject() : { ...value };
}

function mapAllowedItem(item, index) {
  return {
    id: item.id || `${item.type}-${index}`,
    type: item.type,
    name: item.name,
    icon: item.icon,
    width: item.width,
    height: item.height,
    rotation: item.rotation || 0,
    zIndex: item.zIndex || 0
  };
}

function mapSnapshotItem(item) {
  return {
    id: item.id,
    type: item.type,
    name: item.name,
    icon: item.icon,
    width: item.width,
    height: item.height,
    rotation: item.rotation || 0,
    zIndex: item.zIndex || 0
  };
}

function mapSnapshotUnderlay(underlay) {
  return {
    id: underlay.id,
    name: underlay.name,
    image: underlay.image,
    x: underlay.x,
    y: underlay.y,
    width: underlay.width,
    height: underlay.height,
    rotation: underlay.rotation || 0,
    zIndex: underlay.zIndex ?? -10
  };
}

function buildPublicDeskTemplate(template) {
  const templateObject = toSerializableObject(template);
  const items = Array.isArray(templateObject.items) ? templateObject.items : [];
  const underlays = Array.isArray(templateObject.underlays) ? templateObject.underlays : [];

  return {
    ...templateObject,
    allowedItems: items.map(mapAllowedItem),
    templateSnapshot: {
      deskSurfacePreset: templateObject.deskSurfacePreset || 'walnut',
      deskSurfaceColor: templateObject.deskSurfaceColor || '#ffffff',
      underlays: underlays.map(mapSnapshotUnderlay),
      items: items.map(mapSnapshotItem)
    },
    underlays,
    items: undefined
  };
}

module.exports = {
  buildPublicDeskTemplate
};
