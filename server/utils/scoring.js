function findAnchor(items) {
  return (
    items.find((item) => /plate|таріл|plate/i.test(String(item.type || '') + ' ' + String(item.name || ''))) ||
    items[0] ||
    null
  );
}

function relativeSide(item, anchor, axis) {
  if (!item || !anchor) return null;
  const delta = axis === 'x' ? item.x - anchor.x : item.y - anchor.y;
  if (Math.abs(delta) < 15) return 'center';
  return delta > 0 ? (axis === 'x' ? 'right' : 'bottom') : (axis === 'x' ? 'left' : 'top');
}

function buildSemanticFeedback(userItems, targetItems) {
  const targetAnchor = findAnchor(targetItems);
  const userAnchor = findAnchor(userItems);
  const issues = [];

  if (!targetAnchor || !userAnchor) {
    return { summary: null, issues };
  }

  const matchedPairs = [];
  const usedUserIndexes = new Set();

  targetItems.forEach((targetItem) => {
    const userIndex = userItems.findIndex((userItem, index) => (
      !usedUserIndexes.has(index) && String(userItem.type) === String(targetItem.type)
    ));

    if (userIndex >= 0) {
      usedUserIndexes.add(userIndex);
      matchedPairs.push({ targetItem, userItem: userItems[userIndex] });
    }
  });

  matchedPairs.forEach(({ targetItem, userItem }) => {
    if (String(targetItem.type) === String(targetAnchor.type) && String(targetItem.name) === String(targetAnchor.name)) {
      return;
    }

    const expectedX = relativeSide(targetItem, targetAnchor, 'x');
    const actualX = relativeSide(userItem, userAnchor, 'x');
    const expectedY = relativeSide(targetItem, targetAnchor, 'y');
    const actualY = relativeSide(userItem, userAnchor, 'y');

    if (expectedX && actualX && expectedX !== 'center' && actualX !== expectedX) {
      issues.push({
        type: String(targetItem.type),
        itemName: targetItem.name || targetItem.type,
        message: `${targetItem.name || targetItem.type} має бути ${expectedX === 'left' ? 'ліворуч' : 'праворуч'} від центрального предмета.`,
      });
      return;
    }

    if (expectedY && actualY && expectedY !== 'center' && actualY !== expectedY) {
      issues.push({
        type: String(targetItem.type),
        itemName: targetItem.name || targetItem.type,
        message: `${targetItem.name || targetItem.type} має бути ${expectedY === 'top' ? 'вище' : 'нижче'} від центрального предмета.`,
      });
    }
  });

  const dedupedIssues = issues.filter((issue, index, array) => (
    array.findIndex((entry) => entry.message === issue.message) === index
  ));

  return {
    summary: dedupedIssues.length > 0 ? `Є ${dedupedIssues.length} позиційних підказок щодо розміщення приборів.` : null,
    issues: dedupedIssues.slice(0, 3),
  };
}

function validateDeskPlacement(userItems, targetItems, tolerance = 50) {
  let score = 0;
  const total = targetItems.length;

  const validatedItems = userItems.map((userItem) => {
    const correctMatch = targetItems.find((target) =>
      String(userItem.type) === String(target.type) &&
      Math.abs(userItem.x - target.x) < tolerance &&
      Math.abs(userItem.y - target.y) < tolerance
    );
    return { ...userItem, isCorrect: !!correctMatch };
  });

  targetItems.forEach((target) => {
    const found = userItems.some((userItem) =>
      String(userItem.type) === String(target.type) &&
      Math.abs(userItem.x - target.x) < tolerance &&
      Math.abs(userItem.y - target.y) < tolerance
    );
    if (found) score++;
  });

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = percentage >= 80;

  const ghostItems = targetItems.map((item) => ({
    type: item.type,
    name: item.name,
    icon: item.icon,
    x: item.x,
    y: item.y,
  }));

  return {
    score,
    total,
    percentage,
    passed,
    validatedItems,
    ghostItems,
    semanticFeedback: buildSemanticFeedback(userItems, targetItems),
  };
}

module.exports = {
  validateDeskPlacement,
};
