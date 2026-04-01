const { getBindingCity, assertCityBinding } = require('../utils/publicCityBinding');

describe('public city binding helper', () => {
    it('returns the first non-empty binding city', () => {
        expect(getBindingCity('', '  ', 'Київ', 'Львів')).toBe('Київ');
    });

    it('allows requests when no binding city is configured', () => {
        expect(() => assertCityBinding('', '', 'посилання')).not.toThrow();
    });

    it('rejects missing submitted city when binding is enabled', () => {
        expect(() => assertCityBinding('Київ', '', 'посилання')).toThrow('Київ');
    });

    it('rejects mismatched city and ignores case differences', () => {
        expect(() => assertCityBinding('Київ', 'Львів', 'посилання')).toThrow('Київ');
        expect(() => assertCityBinding('Київ', 'київ', 'посилання')).not.toThrow();
    });
});
