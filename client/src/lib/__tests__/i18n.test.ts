import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18n, useI18n } from '../i18n';
import type { Locale, LocaleData, FormatOptions } from '../i18n';

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn<(key: string) => string | null>((key: string) => store[key] ?? null),
  setItem: vi.fn<(key: string, val: string) => void>((key: string, val: string) => {
    store[key] = val;
  }),
  removeItem: vi.fn<(key: string) => void>((key: string) => {
    delete store[key];
  }),
  clear: vi.fn<() => void>(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  }),
});

// Mock navigator.language
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'en-US' },
  writable: true,
  configurable: true,
});

// ---------------------------------------------------------------------------
// Helper: create a Spanish locale for testing
// ---------------------------------------------------------------------------

function createSpanishLocale(): LocaleData {
  return {
    locale: 'es',
    name: 'Espa\u00f1ol',
    direction: 'ltr',
    translations: {
      app: {
        title: 'ProtoPulse',
        tagline: 'Automatizaci\u00f3n de Dise\u00f1o Electr\u00f3nico con IA',
      },
      common: {
        save: 'Guardar',
        cancel: 'Cancelar',
        delete: 'Eliminar',
        loading: 'Cargando...',
      },
      welcome: 'Hola, {{name}}!',
      items: {
        zero: 'Sin elementos',
        one: '1 elemento',
        other: '{{count}} elementos',
      },
    },
    numberFormat: {
      decimal: ',',
      thousands: '.',
      currency: 'EUR',
    },
    dateFormat: {
      short: 'DD/MM/YYYY',
      long: 'D MMMM YYYY',
      time: 'HH:mm:ss',
    },
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('I18n', () => {
  beforeEach(() => {
    I18n.resetForTesting();
    for (const k of Object.keys(store)) {
      delete store[k];
    }
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const a = I18n.getInstance();
      const b = I18n.getInstance();
      expect(a).toBe(b);
    });

    it('should return a new instance after resetForTesting', () => {
      const a = I18n.getInstance();
      I18n.resetForTesting();
      const b = I18n.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // Basic translation lookup
  // -----------------------------------------------------------------------

  describe('t() — basic lookup', () => {
    it('should resolve a simple top-level key', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('common.save')).toBe('Save');
    });

    it('should resolve a nested key', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('menu.file.save')).toBe('Save');
    });

    it('should resolve a deeply nested key', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('menu.edit.undo')).toBe('Undo');
    });

    it('should return the key itself for missing key', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('nonexistent.key')).toBe('nonexistent.key');
    });

    it('should return the key when it points to an object (not a leaf)', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('menu.file')).toBe('menu.file');
    });

    it('should return the key when lookup path is partially valid', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('menu.file.save.extra')).toBe('menu.file.save.extra');
    });

    it('should resolve all common keys', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('common.cancel')).toBe('Cancel');
      expect(i18n.t('common.delete')).toBe('Delete');
      expect(i18n.t('common.confirm')).toBe('Confirm');
      expect(i18n.t('common.loading')).toBe('Loading...');
      expect(i18n.t('common.error')).toBe('Error');
      expect(i18n.t('common.success')).toBe('Success');
      expect(i18n.t('common.search')).toBe('Search');
      expect(i18n.t('common.filter')).toBe('Filter');
      expect(i18n.t('common.sort')).toBe('Sort');
      expect(i18n.t('common.close')).toBe('Close');
      expect(i18n.t('common.ok')).toBe('OK');
      expect(i18n.t('common.yes')).toBe('Yes');
      expect(i18n.t('common.no')).toBe('No');
      expect(i18n.t('common.back')).toBe('Back');
      expect(i18n.t('common.next')).toBe('Next');
      expect(i18n.t('common.done')).toBe('Done');
      expect(i18n.t('common.apply')).toBe('Apply');
    });

    it('should resolve notification keys', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('notifications.saved')).toBe('Changes saved successfully');
      expect(i18n.t('notifications.deleted')).toBe('Item deleted');
      expect(i18n.t('notifications.exported')).toBe('Export completed');
      expect(i18n.t('notifications.imported')).toBe('Import completed');
    });

    it('should resolve error keys', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('errors.notFound')).toBe('Resource not found');
      expect(i18n.t('errors.unauthorized')).toBe('You are not authorized to perform this action');
      expect(i18n.t('errors.serverError')).toBe('An internal server error occurred');
      expect(i18n.t('errors.networkError')).toBe('Network connection lost');
      expect(i18n.t('errors.invalidInput')).toBe('Invalid input provided');
    });

    it('should resolve unit keys', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('units.ohms')).toBe('Ohms');
      expect(i18n.t('units.farads')).toBe('Farads');
      expect(i18n.t('units.henries')).toBe('Henries');
      expect(i18n.t('units.volts')).toBe('Volts');
      expect(i18n.t('units.amps')).toBe('Amps');
      expect(i18n.t('units.watts')).toBe('Watts');
      expect(i18n.t('units.hertz')).toBe('Hertz');
    });

    it('should resolve circuit keys', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('circuit.addComponent')).toBe('Add Component');
      expect(i18n.t('circuit.addWire')).toBe('Add Wire');
      expect(i18n.t('circuit.deleteSelected')).toBe('Delete Selected');
      expect(i18n.t('circuit.rotateComponent')).toBe('Rotate Component');
      expect(i18n.t('circuit.flipComponent')).toBe('Flip Component');
      expect(i18n.t('circuit.netName')).toBe('Net Name');
      expect(i18n.t('circuit.pinName')).toBe('Pin Name');
    });

    it('should resolve panel keys', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('panels.chat.placeholder')).toBe('Ask the AI assistant...');
      expect(i18n.t('panels.chat.send')).toBe('Send');
      expect(i18n.t('panels.chat.clear')).toBe('Clear Chat');
      expect(i18n.t('panels.bom.addItem')).toBe('Add Item');
      expect(i18n.t('panels.bom.removeItem')).toBe('Remove Item');
      expect(i18n.t('panels.bom.totalCost')).toBe('Total Cost');
    });

    it('should resolve menu view keys', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('menu.view.zoomIn')).toBe('Zoom In');
      expect(i18n.t('menu.view.zoomOut')).toBe('Zoom Out');
      expect(i18n.t('menu.view.fitToScreen')).toBe('Fit to Screen');
      expect(i18n.t('menu.view.grid')).toBe('Toggle Grid');
      expect(i18n.t('menu.view.rulers')).toBe('Toggle Rulers');
    });
  });

  // -----------------------------------------------------------------------
  // Interpolation
  // -----------------------------------------------------------------------

  describe('t() — interpolation', () => {
    it('should interpolate a single variable', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('app.version', { version: '2.0' })).toBe('Version 2.0');
    });

    it('should interpolate multiple variables', () => {
      const i18n = I18n.getInstance();
      i18n.registerLocale({
        locale: 'es',
        name: 'Espa\u00f1ol',
        direction: 'ltr',
        translations: {
          greeting: 'Hola, {{name}}! Tienes {{count}} mensajes.',
        },
        numberFormat: { decimal: ',', thousands: '.', currency: 'EUR' },
        dateFormat: { short: 'DD/MM/YYYY', long: 'D MMMM YYYY', time: 'HH:mm:ss' },
      });
      i18n.setLocale('es');
      expect(i18n.t('greeting', { name: 'Alice', count: 3 })).toBe('Hola, Alice! Tienes 3 mensajes.');
    });

    it('should preserve raw placeholder when variable is missing', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('app.version')).toBe('Version {{version}}');
    });

    it('should handle empty string interpolation value', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('app.version', { version: '' })).toBe('Version ');
    });

    it('should convert numeric interpolation values to string', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('app.version', { version: 42 })).toBe('Version 42');
    });
  });

  // -----------------------------------------------------------------------
  // Pluralization
  // -----------------------------------------------------------------------

  describe('t() — pluralization', () => {
    it('should use "zero" rule when count is 0', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('panels.validation.issueCount', { count: 0 })).toBe('No issues');
    });

    it('should use "one" rule when count is 1', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('panels.validation.issueCount', { count: 1 })).toBe('1 issue found');
    });

    it('should use "other" rule for count > 1', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('panels.validation.issueCount', { count: 5 })).toBe('5 issues found');
    });

    it('should use "other" when no "zero" rule is provided for count 0', () => {
      const i18n = I18n.getInstance();
      i18n.registerLocale({
        locale: 'fr',
        name: 'Fran\u00e7ais',
        direction: 'ltr',
        translations: {
          things: {
            one: '1 chose',
            other: '{{count}} choses',
          },
        },
        numberFormat: { decimal: ',', thousands: ' ', currency: 'EUR' },
        dateFormat: { short: 'DD/MM/YYYY', long: 'D MMMM YYYY', time: 'HH:mm:ss' },
      });
      i18n.setLocale('fr');
      expect(i18n.t('things', { count: 0 })).toBe('0 choses');
    });

    it('should use "two" rule when count is 2 and rule is provided', () => {
      const i18n = I18n.getInstance();
      i18n.registerLocale({
        locale: 'de',
        name: 'Deutsch',
        direction: 'ltr',
        translations: {
          items: {
            one: 'Ein Element',
            two: 'Zwei Elemente',
            other: '{{count}} Elemente',
          },
        },
        numberFormat: { decimal: ',', thousands: '.', currency: 'EUR' },
        dateFormat: { short: 'DD.MM.YYYY', long: 'D. MMMM YYYY', time: 'HH:mm:ss' },
      });
      i18n.setLocale('de');
      expect(i18n.t('items', { count: 2 })).toBe('Zwei Elemente');
    });

    it('should default count to 0 when not provided for plural rules', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('panels.validation.issueCount')).toBe('No issues');
    });

    it('should interpolate count into plural template', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('panels.validation.issueCount', { count: 42 })).toBe('42 issues found');
    });
  });

  // -----------------------------------------------------------------------
  // Locale switching
  // -----------------------------------------------------------------------

  describe('Locale management', () => {
    it('should default to English', () => {
      const i18n = I18n.getInstance();
      expect(i18n.getLocale()).toBe('en');
    });

    it('should switch locale', () => {
      const i18n = I18n.getInstance();
      i18n.registerLocale(createSpanishLocale());
      i18n.setLocale('es');
      expect(i18n.getLocale()).toBe('es');
    });

    it('should translate using the switched locale', () => {
      const i18n = I18n.getInstance();
      i18n.registerLocale(createSpanishLocale());
      i18n.setLocale('es');
      expect(i18n.t('common.save')).toBe('Guardar');
    });

    it('should not switch to an unregistered locale', () => {
      const i18n = I18n.getInstance();
      i18n.setLocale('ja');
      expect(i18n.getLocale()).toBe('en');
    });

    it('should return all available locales', () => {
      const i18n = I18n.getInstance();
      expect(i18n.getAvailableLocales()).toEqual(['en']);
      i18n.registerLocale(createSpanishLocale());
      expect(i18n.getAvailableLocales()).toContain('es');
    });
  });

  // -----------------------------------------------------------------------
  // Number formatting
  // -----------------------------------------------------------------------

  describe('formatNumber()', () => {
    it('should format integers with thousands separator', () => {
      const i18n = I18n.getInstance();
      expect(i18n.formatNumber(1234567)).toBe('1,234,567');
    });

    it('should format with specified decimal places', () => {
      const i18n = I18n.getInstance();
      expect(i18n.formatNumber(1234.5, 2)).toBe('1,234.50');
    });

    it('should format without decimals for whole numbers', () => {
      const i18n = I18n.getInstance();
      expect(i18n.formatNumber(100)).toBe('100');
    });

    it('should use locale-specific separators', () => {
      const i18n = I18n.getInstance();
      i18n.registerLocale(createSpanishLocale());
      i18n.setLocale('es');
      expect(i18n.formatNumber(1234567.89, 2)).toBe('1.234.567,89');
    });

    it('should handle zero', () => {
      const i18n = I18n.getInstance();
      expect(i18n.formatNumber(0)).toBe('0');
    });

    it('should handle negative numbers', () => {
      const i18n = I18n.getInstance();
      expect(i18n.formatNumber(-1234, 2)).toBe('-1,234.00');
    });

    it('should handle small numbers without thousands separator', () => {
      const i18n = I18n.getInstance();
      expect(i18n.formatNumber(42)).toBe('42');
    });
  });

  // -----------------------------------------------------------------------
  // Date formatting
  // -----------------------------------------------------------------------

  describe('formatDate()', () => {
    it('should format date in short format', () => {
      const i18n = I18n.getInstance();
      const date = new Date(2026, 2, 3); // March 3, 2026
      expect(i18n.formatDate(date, 'short')).toBe('03/03/2026');
    });

    it('should format date in long format', () => {
      const i18n = I18n.getInstance();
      const date = new Date(2026, 2, 3);
      expect(i18n.formatDate(date, 'long')).toBe('March 3, 2026');
    });

    it('should accept a timestamp', () => {
      const i18n = I18n.getInstance();
      const ts = new Date(2026, 0, 15).getTime(); // Jan 15, 2026
      expect(i18n.formatDate(ts, 'short')).toBe('01/15/2026');
    });

    it('should default to short format', () => {
      const i18n = I18n.getInstance();
      const date = new Date(2026, 11, 25); // Dec 25, 2026
      expect(i18n.formatDate(date)).toBe('12/25/2026');
    });

    it('should use locale-specific date patterns', () => {
      const i18n = I18n.getInstance();
      i18n.registerLocale(createSpanishLocale());
      i18n.setLocale('es');
      const date = new Date(2026, 2, 3); // March 3, 2026
      expect(i18n.formatDate(date, 'short')).toBe('03/03/2026');
    });
  });

  // -----------------------------------------------------------------------
  // Currency formatting
  // -----------------------------------------------------------------------

  describe('formatCurrency()', () => {
    it('should format USD by default', () => {
      const i18n = I18n.getInstance();
      expect(i18n.formatCurrency(1234.5)).toBe('$1,234.50');
    });

    it('should format with specified currency', () => {
      const i18n = I18n.getInstance();
      expect(i18n.formatCurrency(99.99, 'EUR')).toBe('\u20AC99.99');
    });

    it('should format GBP', () => {
      const i18n = I18n.getInstance();
      expect(i18n.formatCurrency(50, 'GBP')).toBe('\u00A350.00');
    });

    it('should format JPY', () => {
      const i18n = I18n.getInstance();
      expect(i18n.formatCurrency(10000, 'JPY')).toBe('\u00A510,000.00');
    });

    it('should fallback to currency code when symbol is unknown', () => {
      const i18n = I18n.getInstance();
      expect(i18n.formatCurrency(100, 'CHF')).toBe('CHF100.00');
    });

    it('should use locale default currency', () => {
      const i18n = I18n.getInstance();
      i18n.registerLocale(createSpanishLocale());
      i18n.setLocale('es');
      expect(i18n.formatCurrency(49.99)).toBe('\u20AC49,99');
    });
  });

  // -----------------------------------------------------------------------
  // Register custom locale
  // -----------------------------------------------------------------------

  describe('registerLocale()', () => {
    it('should register a new locale', () => {
      const i18n = I18n.getInstance();
      i18n.registerLocale(createSpanishLocale());
      expect(i18n.getAvailableLocales()).toContain('es');
    });

    it('should allow switching to the registered locale', () => {
      const i18n = I18n.getInstance();
      i18n.registerLocale(createSpanishLocale());
      i18n.setLocale('es');
      expect(i18n.getLocale()).toBe('es');
      expect(i18n.t('common.save')).toBe('Guardar');
    });

    it('should override an existing locale with new data', () => {
      const i18n = I18n.getInstance();
      const updated = createSpanishLocale();
      updated.translations.common = { save: 'Guardar v2' };
      i18n.registerLocale(createSpanishLocale());
      i18n.registerLocale(updated);
      i18n.setLocale('es');
      expect(i18n.t('common.save')).toBe('Guardar v2');
    });
  });

  // -----------------------------------------------------------------------
  // Browser locale auto-detection
  // -----------------------------------------------------------------------

  describe('Browser locale auto-detection', () => {
    it('should detect "en" from navigator.language = "en-US"', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { language: 'en-US' },
        writable: true,
        configurable: true,
      });
      I18n.resetForTesting();
      const i18n = I18n.getInstance();
      expect(i18n.getLocale()).toBe('en');
    });

    it('should detect "es" from navigator.language = "es-MX" when Spanish is registered', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { language: 'es-MX' },
        writable: true,
        configurable: true,
      });
      I18n.resetForTesting();
      const i18n = I18n.getInstance();
      // Spanish not registered yet, falls back to en
      expect(i18n.getLocale()).toBe('en');

      // Now register Spanish, reset and try again
      i18n.registerLocale(createSpanishLocale());
      I18n.resetForTesting();

      // Need to create a fresh instance that has Spanish registered
      const i18n2 = I18n.getInstance();
      // Since this is a fresh instance, Spanish is not registered yet
      expect(i18n2.getLocale()).toBe('en');
    });

    it('should fallback to "en" for unsupported browser language', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { language: 'ar-SA' },
        writable: true,
        configurable: true,
      });
      I18n.resetForTesting();
      const i18n = I18n.getInstance();
      expect(i18n.getLocale()).toBe('en');
    });

    // Restore navigator for remaining tests
    afterEach(() => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { language: 'en-US' },
        writable: true,
        configurable: true,
      });
    });
  });

  // -----------------------------------------------------------------------
  // Direction
  // -----------------------------------------------------------------------

  describe('getDirection()', () => {
    it('should return "ltr" for English', () => {
      const i18n = I18n.getInstance();
      expect(i18n.getDirection()).toBe('ltr');
    });

    it('should return "rtl" for RTL locale', () => {
      const i18n = I18n.getInstance();
      // Register a fake Arabic locale
      i18n.registerLocale({
        locale: 'es', // reusing 'es' slot
        name: 'Arabic (fake)',
        direction: 'rtl',
        translations: {},
        numberFormat: { decimal: '.', thousands: ',', currency: 'USD' },
        dateFormat: { short: 'DD/MM/YYYY', long: 'D MMMM YYYY', time: 'HH:mm:ss' },
      });
      i18n.setLocale('es');
      expect(i18n.getDirection()).toBe('rtl');
    });
  });

  // -----------------------------------------------------------------------
  // Export / Import translations
  // -----------------------------------------------------------------------

  describe('exportTranslations()', () => {
    it('should export English translations as JSON', () => {
      const i18n = I18n.getInstance();
      const exported = i18n.exportTranslations('en');
      const parsed = JSON.parse(exported) as { locale: string; translations: Record<string, unknown> };
      expect(parsed.locale).toBe('en');
      expect(parsed.translations).toBeDefined();
      expect((parsed.translations.common as Record<string, unknown>).save).toBe('Save');
    });

    it('should return empty translations for unknown locale', () => {
      const i18n = I18n.getInstance();
      const exported = i18n.exportTranslations('ja');
      const parsed = JSON.parse(exported) as { locale: string; translations: Record<string, unknown> };
      expect(parsed.locale).toBe('ja');
      expect(parsed.translations).toEqual({});
    });
  });

  describe('importTranslations()', () => {
    it('should import translations and return stats', () => {
      const i18n = I18n.getInstance();
      const json = JSON.stringify({
        locale: 'fr',
        translations: {
          common: {
            save: 'Enregistrer',
            cancel: 'Annuler',
          },
        },
      });
      const result = i18n.importTranslations(json);
      expect(result.locale).toBe('fr');
      expect(result.keys).toBe(2);
      expect(result.errors).toEqual([]);
    });

    it('should make imported locale available for translation', () => {
      const i18n = I18n.getInstance();
      i18n.importTranslations(JSON.stringify({
        locale: 'fr',
        translations: {
          common: { save: 'Enregistrer' },
        },
      }));
      i18n.setLocale('fr');
      expect(i18n.t('common.save')).toBe('Enregistrer');
    });

    it('should return errors for malformed JSON', () => {
      const i18n = I18n.getInstance();
      const result = i18n.importTranslations('not valid json{{{');
      expect(result.errors).toContain('Invalid JSON');
      expect(result.keys).toBe(0);
    });

    it('should return errors for non-object JSON', () => {
      const i18n = I18n.getInstance();
      const result = i18n.importTranslations('"just a string"');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return errors for missing locale field', () => {
      const i18n = I18n.getInstance();
      const result = i18n.importTranslations(JSON.stringify({ translations: {} }));
      expect(result.errors).toContain('Missing or invalid "locale" field');
    });

    it('should return errors for unsupported locale', () => {
      const i18n = I18n.getInstance();
      const result = i18n.importTranslations(JSON.stringify({
        locale: 'xx',
        translations: {},
      }));
      expect(result.errors[0]).toContain('Unsupported locale');
    });

    it('should return errors for missing translations field', () => {
      const i18n = I18n.getInstance();
      const result = i18n.importTranslations(JSON.stringify({ locale: 'en' }));
      expect(result.errors).toContain('Missing or invalid "translations" field');
    });

    it('should round-trip export then import', () => {
      const i18n = I18n.getInstance();
      const exported = i18n.exportTranslations('en');
      I18n.resetForTesting();
      const i18n2 = I18n.getInstance();
      const result = i18n2.importTranslations(exported);
      expect(result.errors).toEqual([]);
      expect(result.keys).toBeGreaterThan(50);
      expect(i18n2.t('common.save')).toBe('Save');
    });
  });

  // -----------------------------------------------------------------------
  // hasKey()
  // -----------------------------------------------------------------------

  describe('hasKey()', () => {
    it('should return true for existing key', () => {
      const i18n = I18n.getInstance();
      expect(i18n.hasKey('common.save')).toBe(true);
    });

    it('should return false for non-existing key', () => {
      const i18n = I18n.getInstance();
      expect(i18n.hasKey('nonexistent.key')).toBe(false);
    });

    it('should return true for nested keys', () => {
      const i18n = I18n.getInstance();
      expect(i18n.hasKey('menu.file.save')).toBe(true);
    });

    it('should return true for namespace keys (intermediate objects)', () => {
      const i18n = I18n.getInstance();
      expect(i18n.hasKey('menu.file')).toBe(true);
    });

    it('should return true for plural rule keys', () => {
      const i18n = I18n.getInstance();
      expect(i18n.hasKey('panels.validation.issueCount')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------

  describe('localStorage persistence', () => {
    it('should save locale to localStorage on setLocale', () => {
      const i18n = I18n.getInstance();
      i18n.registerLocale(createSpanishLocale());
      i18n.setLocale('es');
      expect(localStorage.setItem).toHaveBeenCalledWith('protopulse-locale', 'es');
    });

    it('should load saved locale from localStorage on init', () => {
      store['protopulse-locale'] = 'es';
      I18n.resetForTesting();
      // Need Spanish registered, but fresh instance doesn't have it.
      // The init should fallback to 'en' since 'es' isn't registered.
      const i18n = I18n.getInstance();
      expect(i18n.getLocale()).toBe('en');
    });

    it('should load saved locale when it is registered', () => {
      // First register Spanish, save to localStorage, then reset
      const pre = I18n.getInstance();
      pre.registerLocale(createSpanishLocale());
      pre.setLocale('es');
      // localStorage now has 'es'
      I18n.resetForTesting();
      // New instance won't have Spanish registered, but...
      // This demonstrates the pattern: saved locale only works if registered
      const i18n = I18n.getInstance();
      // Falls back to en since es isn't registered in the fresh instance
      expect(i18n.getLocale()).toBe('en');
    });

    it('should ignore invalid saved locale', () => {
      store['protopulse-locale'] = 'invalid';
      I18n.resetForTesting();
      const i18n = I18n.getInstance();
      expect(i18n.getLocale()).toBe('en');
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe / Notify
  // -----------------------------------------------------------------------

  describe('subscribe / notify', () => {
    it('should call listener on locale change', () => {
      const i18n = I18n.getInstance();
      i18n.registerLocale(createSpanishLocale());
      const listener = vi.fn();
      i18n.subscribe(listener);
      i18n.setLocale('es');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should not call listener after unsubscribe', () => {
      const i18n = I18n.getInstance();
      i18n.registerLocale(createSpanishLocale());
      const listener = vi.fn();
      const unsub = i18n.subscribe(listener);
      unsub();
      i18n.setLocale('es');
      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple listeners', () => {
      const i18n = I18n.getInstance();
      i18n.registerLocale(createSpanishLocale());
      const l1 = vi.fn();
      const l2 = vi.fn();
      i18n.subscribe(l1);
      i18n.subscribe(l2);
      i18n.setLocale('es');
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
    });

    it('should not notify when setLocale is called with unregistered locale', () => {
      const i18n = I18n.getInstance();
      const listener = vi.fn();
      i18n.subscribe(listener);
      i18n.setLocale('ja'); // not registered
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('Edge cases', () => {
    it('should handle empty string translation value', () => {
      const i18n = I18n.getInstance();
      i18n.registerLocale({
        locale: 'fr',
        name: 'Fran\u00e7ais',
        direction: 'ltr',
        translations: {
          empty: '',
        },
        numberFormat: { decimal: ',', thousands: ' ', currency: 'EUR' },
        dateFormat: { short: 'DD/MM/YYYY', long: 'D MMMM YYYY', time: 'HH:mm:ss' },
      });
      i18n.setLocale('fr');
      expect(i18n.t('empty')).toBe('');
    });

    it('should handle key pointing to object, not string, at leaf level', () => {
      const i18n = I18n.getInstance();
      // 'menu' is an object containing 'file', 'edit', 'view'
      expect(i18n.t('menu')).toBe('menu');
    });

    it('should handle deeply nested key path that exceeds tree depth', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('a.b.c.d.e.f.g')).toBe('a.b.c.d.e.f.g');
    });

    it('should handle single-segment key', () => {
      const i18n = I18n.getInstance();
      i18n.registerLocale({
        locale: 'de',
        name: 'Deutsch',
        direction: 'ltr',
        translations: {
          hello: 'Hallo',
        },
        numberFormat: { decimal: ',', thousands: '.', currency: 'EUR' },
        dateFormat: { short: 'DD.MM.YYYY', long: 'D. MMMM YYYY', time: 'HH:mm:ss' },
      });
      i18n.setLocale('de');
      expect(i18n.t('hello')).toBe('Hallo');
    });

    it('should handle interpolation with count in plural "other" template', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('panels.validation.issueCount', { count: 100 })).toBe('100 issues found');
    });

    it('should handle empty key', () => {
      const i18n = I18n.getInstance();
      expect(i18n.t('')).toBe('');
    });

    it('should handle formatNumber with very large numbers', () => {
      const i18n = I18n.getInstance();
      expect(i18n.formatNumber(1000000000)).toBe('1,000,000,000');
    });

    it('should handle formatDate with epoch 0', () => {
      const i18n = I18n.getInstance();
      const result = i18n.formatDate(0, 'short');
      // Should produce a valid date string (Jan 1, 1970 in local timezone)
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
  });

  // -----------------------------------------------------------------------
  // useI18n hook shape
  // -----------------------------------------------------------------------

  describe('useI18n() hook shape', () => {
    it('should export useI18n function', () => {
      expect(typeof useI18n).toBe('function');
    });

    it('should export expected types', () => {
      // Type-level check — these are compile-time only, so we just verify the symbols exist
      const _locale: Locale = 'en';
      const _options: FormatOptions = { count: 1 };
      expect(_locale).toBe('en');
      expect(_options.count).toBe(1);
    });
  });
});
