const express = require('express');
const DeskState = require('../models/DeskState');
const { auth, checkRole } = require('../middleware/authMiddleware');
const { DESK_EDITOR_ROLES } = require('../utils/accessPolicy');

const router = express.Router();
const deskEditorAuth = [auth, checkRole(DESK_EDITOR_ROLES)];

const DEFAULT_STATE = {
  underlays: [],
  deskSurfacePreset: 'walnut',
  deskSurfaceColor: '#ffffff',
};

router.get('/', deskEditorAuth, async (req, res) => {
  try {
    const state = await DeskState.findOne({ ownerId: req.user._id }).lean();
    if (!state) {
      return res.json(DEFAULT_STATE);
    }

    res.json({
      underlays: state.underlays || [],
      deskSurfacePreset: state.deskSurfacePreset || DEFAULT_STATE.deskSurfacePreset,
      deskSurfaceColor: state.deskSurfaceColor || DEFAULT_STATE.deskSurfaceColor,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/', deskEditorAuth, async (req, res) => {
  const payload = {};

  if (req.body.underlays !== undefined) {
    if (!Array.isArray(req.body.underlays)) {
      return res.status(400).json({ error: 'underlays must be an array' });
    }
    payload.underlays = req.body.underlays;
  }

  if (req.body.deskSurfacePreset !== undefined) {
    if (typeof req.body.deskSurfacePreset !== 'string') {
      return res.status(400).json({ error: 'deskSurfacePreset must be a string' });
    }
    payload.deskSurfacePreset = req.body.deskSurfacePreset;
  }

  if (req.body.deskSurfaceColor !== undefined) {
    if (typeof req.body.deskSurfaceColor !== 'string') {
      return res.status(400).json({ error: 'deskSurfaceColor must be a string' });
    }
    payload.deskSurfaceColor = req.body.deskSurfaceColor;
  }

  try {
    const state = await DeskState.findOneAndUpdate(
      { ownerId: req.user._id },
      { ...payload, ownerId: req.user._id },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    res.json({
      underlays: state.underlays || [],
      deskSurfacePreset: state.deskSurfacePreset || DEFAULT_STATE.deskSurfacePreset,
      deskSurfaceColor: state.deskSurfaceColor || DEFAULT_STATE.deskSurfaceColor,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/', deskEditorAuth, async (req, res) => {
  try {
    await DeskState.findOneAndDelete({ ownerId: req.user._id });
    res.json({ message: 'Desk state cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
