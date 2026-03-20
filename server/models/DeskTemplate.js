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
    image: { type: String },
    icon: { type: String },
    category: { type: String }
});

const deskTemplateSchema = new mongoose.Schema({
    templateName: { type: String, required: true },
    city: { type: String, default: '' },       // legacy
    targetCity: { type: String, default: '' }, // використовується в роутах
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    items: [deskItemSchema],
    description: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    platform: { type: String, default: '' }
});

deskTemplateSchema.index({ ownerId: 1, createdAt: -1 });
deskTemplateSchema.index({ targetCity: 1, createdAt: -1 });

module.exports = mongoose.model('DeskTemplate', deskTemplateSchema);
