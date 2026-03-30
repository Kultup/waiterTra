const mongoose = require('mongoose');

const deskUnderlaySchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, default: 'РџС–РґРєР»Р°РґРєР°' },
  image: { type: String, required: true },
  x: { type: Number, default: 250 },
  y: { type: Number, default: 250 },
  width: { type: Number, default: 180 },
  height: { type: Number, default: 180 },
  rotation: { type: Number, default: 0 },
  zIndex: { type: Number, default: -10 },
}, { _id: false });

const deskStateSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  deskSurfacePreset: { type: String, default: 'walnut' },
  deskSurfaceColor: { type: String, default: '#ffffff' },
  underlays: [deskUnderlaySchema],
}, {
  timestamps: true,
});

module.exports = mongoose.model('DeskState', deskStateSchema);
