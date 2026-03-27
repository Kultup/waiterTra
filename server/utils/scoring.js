/**
 * Validates student's desk item placements against a target template.
 *
 * @param {Array} userItems - Items placed by the student [{ type, x, y, ... }]
 * @param {Array} targetItems - Correct items from the template [{ type, x, y, ... }]
 * @param {number} tolerance - Pixel range for a match (default 50)
 * @returns {Object} { score, total, percentage, passed, validatedItems, ghostItems }
 */
function validateDeskPlacement(userItems, targetItems, tolerance = 50) {
  let score = 0;
  const total = targetItems.length;

  // 1. Validate each user item (mark as correct/incorrect)
  const validatedItems = userItems.map(userItem => {
    const correctMatch = targetItems.find(target =>
      String(userItem.type) === String(target.type) &&
      Math.abs(userItem.x - target.x) < tolerance &&
      Math.abs(userItem.y - target.y) < tolerance
    );
    return { ...userItem, isCorrect: !!correctMatch };
  });

  // 2. Calculate score (how many target items were correctly covered)
  targetItems.forEach(target => {
    const found = userItems.some(userItem =>
      String(userItem.type) === String(target.type) &&
      Math.abs(userItem.x - target.x) < tolerance &&
      Math.abs(userItem.y - target.y) < tolerance
    );
    if (found) score++;
  });

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = percentage >= 80;

  // 3. Prepare ghost items (correct positions for frontend overlay)
  const ghostItems = targetItems.map(i => ({
    type: i.type,
    name: i.name,
    icon: i.icon,
    x: i.x,
    y: i.y
  }));

  return {
    score,
    total,
    percentage,
    passed,
    validatedItems,
    ghostItems
  };
}

module.exports = {
  validateDeskPlacement
};
