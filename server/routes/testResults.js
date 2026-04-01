const express = require('express');
const TestResult = require('../models/TestResult');
const { auth, checkRole } = require('../middleware/authMiddleware');
const { buildResultFilter } = require('../utils/platformFilter');
const { RESULT_VIEW_ROLES, RESULT_EDIT_ROLES } = require('../utils/accessPolicy');

const router = express.Router();

router.get('/', auth, checkRole(RESULT_VIEW_ROLES), async (req, res) => {
  try {
    const query = await buildResultFilter(req.user, 'studentCity');
    const results = await TestResult.find(query).sort({ completedAt: -1 });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/city', auth, checkRole(RESULT_EDIT_ROLES), async (req, res) => {
  try {
    const { city } = req.body;
    if (!city || !city.trim()) {
      return res.status(400).json({ error: "РњС–СЃС‚Рѕ РѕР±РѕРІ'язРєРѕРІРµ" });
    }

    const query = await buildResultFilter(req.user, 'studentCity');
    query._id = req.params.id;

    const result = await TestResult.findOneAndUpdate(
      query,
      { studentCity: city.trim(), city: city.trim() },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ error: 'Р РµР·СѓР»СЊС‚Р°С‚ РЅРµ Р·РЅР°Р№РґРµРЅРѕ' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
