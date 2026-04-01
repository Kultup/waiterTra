const express = require('express');
const DeskTemplate = require('../models/DeskTemplate');
const { auth, checkRole } = require('../middleware/authMiddleware');
const { buildBaseFilter, buildOwnerQuery } = require('../utils/platformFilter');
const { DESK_EDITOR_ROLES } = require('../utils/accessPolicy');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const deskEditorAuth = [auth, checkRole(DESK_EDITOR_ROLES)];

// Get all templates (platform-scoped)
router.get('/', deskEditorAuth, async (req, res) => {
  try {
    const query = buildBaseFilter(req.user, 'targetCity');
    const templates = await DeskTemplate.find(query).sort({ createdAt: -1 });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create template
router.post('/', deskEditorAuth, async (req, res) => {
  const { name, items } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Назва шаблону є обов\'язковою' });
  }
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items повинен бути масивом' });
  }
  try {
    const template = new DeskTemplate({
      ...req.body,
      ownerId: req.user._id,
      platform: req.user.platform || ''
    });
    await template.save();
    res.status(201).json(template);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', deskEditorAuth, async (req, res) => {
  const { name } = req.body;
  if (name !== undefined && (!name || typeof name !== 'string' || !name.trim())) {
    return res.status(400).json({ error: 'Назва шаблону не може бути порожньою' });
  }
  try {
    const query = buildOwnerQuery(req.user, req.params.id);
    const template = await DeskTemplate.findOneAndUpdate(
      query,
      req.body,
      { new: true, runValidators: true }
    );
    if (!template) {
      return res.status(404).json({ error: 'Шаблон не знайдено або немає доступу' });
    }
    res.json(template);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete template
router.delete('/:id', deskEditorAuth, async (req, res) => {
  try {
    const query = buildOwnerQuery(req.user, req.params.id);
    const template = await DeskTemplate.findOneAndDelete(query);
    if (!template) return res.status(404).json({ error: 'Template not found or unauthorized' });
    res.json({ message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download scenario Excel template
router.get('/scenario-template/excel', (req, res) => {
  try {
    const templatePath = path.join(__dirname, '..', '..', 'templates', 'scenario_template.xlsx');
    
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: 'Шаблон не знайдено' });
    }
    
    res.download(templatePath, 'scenario_template.xlsx', (err) => {
      if (err) {
        console.error('Error downloading template:', err);
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
