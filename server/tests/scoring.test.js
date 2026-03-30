const { validateDeskPlacement } = require('../utils/scoring');

describe('validateDeskPlacement', () => {
  const targetItems = [
    { type: 'plate', x: 100, y: 100, name: 'Plate', icon: '🍽️' },
    { type: 'fork', x: 50, y: 100, name: 'Fork', icon: '🍴' }
  ];

  test('should return 100% for perfect match', () => {
    const userItems = [
      { type: 'plate', x: 100, y: 100 },
      { type: 'fork', x: 50, y: 100 }
    ];
    const result = validateDeskPlacement(userItems, targetItems);
    expect(result.score).toBe(2);
    expect(result.percentage).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.validatedItems[0].isCorrect).toBe(true);
  });

  test('should respect tolerance (50px)', () => {
    const userItems = [
      { type: 'plate', x: 120, y: 120 }, // Within 50px
      { type: 'fork', x: 10, y: 100 }     // Exactly 40px away, within 50px
    ];
    const result = validateDeskPlacement(userItems, targetItems);
    expect(result.score).toBe(2);
    expect(result.percentage).toBe(100);
  });

  test('should fail if outside tolerance', () => {
    const userItems = [
      { type: 'plate', x: 200, y: 200 }, // Way off
      { type: 'fork', x: 50, y: 100 }
    ];
    const result = validateDeskPlacement(userItems, targetItems);
    expect(result.score).toBe(1);
    expect(result.percentage).toBe(50);
    expect(result.passed).toBe(false);
  });

  test('should mark user duplicates correctly', () => {
    const userItems = [
      { type: 'plate', x: 100, y: 100 },
      { type: 'plate', x: 110, y: 110 } // Both match the same target
    ];
    const result = validateDeskPlacement(userItems, targetItems);
    // Score should be 1 because only one target item is covered
    expect(result.score).toBe(1);
    expect(result.validatedItems.every(i => i.isCorrect)).toBe(true);
  });

  test('should handle empty items', () => {
    const result = validateDeskPlacement([], targetItems);
    expect(result.score).toBe(0);
    expect(result.total).toBe(2);
    expect(result.percentage).toBe(0);
  });

  test('should return semantic feedback when item is placed on the wrong side', () => {
    const userItems = [
      { type: 'plate', x: 100, y: 100, name: 'Plate' },
      { type: 'fork', x: 150, y: 100, name: 'Fork' }
    ];
    const result = validateDeskPlacement(userItems, targetItems);
    expect(result.semanticFeedback).toBeDefined();
    expect(result.semanticFeedback.issues.length).toBeGreaterThan(0);
  });
});
