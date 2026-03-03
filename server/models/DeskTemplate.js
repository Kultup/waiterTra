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
    category: { type: String }
});

const deskTemplateSchema = new mongoose.Schema({
    templateName: { type: String, required: true },
    city: { type: String, default: '' },
    items: [deskItemSchema],
    createdAt: { type: Date, default: Date.now }
});

deskTemplateSchema.index({ city: 1, createdAt: -1 });

module.exports = mongoose.model('DeskTemplate', deskTemplateSchema);
