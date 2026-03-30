const mongoose = require('mongoose');

const deskItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  x: { type: Number },
  y: { type: Number },
  rotation: { type: Number, default: 0 },
  zIndex: { type: Number, default: 0 },
  image: { type: String },
  icon: { type: String },
  category: { type: String },
});

const deskUnderlaySchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, default: 'Підкладка' },
  image: { type: String, required: true },
  x: { type: Number, default: 250 },
  y: { type: Number, default: 250 },
  width: { type: Number, default: 180 },
  height: { type: Number, default: 180 },
  rotation: { type: Number, default: 0 },
  zIndex: { type: Number, default: -10 },
});

const deskTemplateSchema = new mongoose.Schema({
  templateName: { type: String, required: true },
  city: { type: String, default: '' },
  targetCity: { type: String, default: '' },
  deskSurfacePreset: { type: String, default: 'walnut' },
  deskSurfaceColor: { type: String, default: '#ffffff' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [deskItemSchema],
  underlays: [deskUnderlaySchema],
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  platform: { type: String, default: '' },
});

deskTemplateSchema.index({ ownerId: 1, createdAt: -1 });
deskTemplateSchema.index({ targetCity: 1, createdAt: -1 });

module.exports = mongoose.model('DeskTemplate', deskTemplateSchema);
