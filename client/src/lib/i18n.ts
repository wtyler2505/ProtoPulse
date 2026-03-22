/**
 * Internationalization (i18n) Framework
 *
 * Lightweight localization system for ProtoPulse UI strings.
 * Supports dot-notation key lookup, interpolation, pluralization,
 * locale-aware number/date/currency formatting, and localStorage persistence.
 *
 * Usage:
 *   const i18n = I18n.getInstance();
 *   i18n.t('common.save');                        // → 'Save'
 *   i18n.t('welcome', { name: 'Alice' });         // → 'Hello, Alice!'
 *   i18n.t('items', { count: 5 });                // → '5 items'
 *
 * React hook:
 *   const { t, locale, setLocale } = useI18n();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'ko' | 'pt';

export interface PluralRules {
  zero?: string;
  one: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export interface TranslationEntry {
  [key: string]: string | PluralRules | TranslationEntry;
}

export interface LocaleData {
  locale: Locale;
  name: string;
  direction: 'ltr' | 'rtl';
  translations: TranslationEntry;
  numberFormat: {
    decimal: string;
    thousands: string;
    currency: string;
  };
  dateFormat: {
    short: string;
    long: string;
    time: string;
  };
}

export interface FormatOptions {
  count?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-locale';

const SUPPORTED_LOCALES: Locale[] = ['en', 'es', 'fr', 'de', 'ja', 'zh', 'ko', 'pt'];

// ---------------------------------------------------------------------------
// Built-in English locale
// ---------------------------------------------------------------------------

const ENGLISH_LOCALE: LocaleData = {
  locale: 'en',
  name: 'English',
  direction: 'ltr',
  translations: {
    app: {
      title: 'ProtoPulse',
      tagline: 'AI-Powered Electronic Design Automation',
      version: 'Version {{version}}',
    },
    views: {
      architecture: 'Architecture',
      schematic: 'Schematic',
      pcb: 'PCB Layout',
      validation: 'Validation',
      output: 'Export',
    },
    menu: {
      file: {
        new: 'New Project',
        open: 'Open Project',
        save: 'Save',
        saveAs: 'Save As',
        export: 'Export',
        import: 'Import',
      },
      edit: {
        undo: 'Undo',
        redo: 'Redo',
        cut: 'Cut',
        copy: 'Copy',
        paste: 'Paste',
        delete: 'Delete',
        selectAll: 'Select All',
      },
      view: {
        zoomIn: 'Zoom In',
        zoomOut: 'Zoom Out',
        fitToScreen: 'Fit to Screen',
        grid: 'Toggle Grid',
        rulers: 'Toggle Rulers',
      },
    },
    panels: {
      chat: {
        placeholder: 'Ask the AI assistant...',
        send: 'Send',
        clear: 'Clear Chat',
      },
      bom: {
        addItem: 'Add Item',
        removeItem: 'Remove Item',
        totalCost: 'Total Cost',
        quantity: 'Quantity',
        unitPrice: 'Unit Price',
      },
      validation: {
        runDrc: 'Run DRC',
        noIssues: 'No issues found',
        issueCount: {
          zero: 'No issues',
          one: '1 issue found',
          other: '{{count}} issues found',
        },
      },
    },
    circuit: {
      addComponent: 'Add Component',
      addWire: 'Add Wire',
      deleteSelected: 'Delete Selected',
      rotateComponent: 'Rotate Component',
      flipComponent: 'Flip Component',
      netName: 'Net Name',
      pinName: 'Pin Name',
    },
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      confirm: 'Confirm',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      search: 'Search',
      filter: 'Filter',
      sort: 'Sort',
      close: 'Close',
      ok: 'OK',
      yes: 'Yes',
      no: 'No',
      back: 'Back',
      next: 'Next',
      done: 'Done',
      apply: 'Apply',
    },
    notifications: {
      saved: 'Changes saved successfully',
      deleted: 'Item deleted',
      exported: 'Export completed',
      imported: 'Import completed',
      validationPassed: 'All validation checks passed',
      validationFailed: 'Validation failed with errors',
    },
    errors: {
      notFound: 'Resource not found',
      unauthorized: 'You are not authorized to perform this action',
      serverError: 'An internal server error occurred',
      networkError: 'Network connection lost',
      invalidInput: 'Invalid input provided',
    },
    units: {
      ohms: 'Ohms',
      farads: 'Farads',
      henries: 'Henries',
      volts: 'Volts',
      amps: 'Amps',
      watts: 'Watts',
      hertz: 'Hertz',
    },
  },
  numberFormat: {
    decimal: '.',
    thousands: ',',
    currency: 'USD',
  },
  dateFormat: {
    short: 'MM/DD/YYYY',
    long: 'MMMM D, YYYY',
    time: 'HH:mm:ss',
  },
};

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPluralRules(value: unknown): value is PluralRules {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.one === 'string' && typeof obj.other === 'string';
}

function resolveNestedKey(obj: TranslationEntry, keyPath: string): string | PluralRules | TranslationEntry | undefined {
  const parts = keyPath.split('.');
  let current: string | PluralRules | TranslationEntry | undefined = obj;

  for (const part of parts) {
    if (typeof current !== 'object' || current === null || isPluralRules(current)) {
      return undefined;
    }
    current = (current as TranslationEntry)[part];
  }

  return current;
}

function selectPlural(rules: PluralRules, count: number): string {
  if (count === 0 && rules.zero !== undefined) {
    return rules.zero;
  }
  if (count === 1) {
    return rules.one;
  }
  if (count === 2 && rules.two !== undefined) {
    return rules.two;
  }
  return rules.other;
}

function interpolate(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const val = values[key];
    if (val === undefined || val === null) {
      return `{{${key}}}`;
    }
    return String(val);
  });
}

function countTranslationKeys(obj: TranslationEntry): number {
  let count = 0;
  Object.values(obj).forEach((value) => {
    if (typeof value === 'string') {
      count++;
    } else if (isPluralRules(value)) {
      count++;
    } else if (typeof value === 'object' && value !== null) {
      count += countTranslationKeys(value as TranslationEntry);
    }
  });
  return count;
}

function detectBrowserLocale(): Locale {
  try {
    if (typeof globalThis.navigator !== 'undefined' && globalThis.navigator.language) {
      const browserLang = globalThis.navigator.language;
      // Exact match first (e.g., 'en' in supported list)
      const exact = browserLang.toLowerCase() as Locale;
      if (SUPPORTED_LOCALES.includes(exact)) {
        return exact;
      }
      // Language prefix match (e.g., 'en-US' → 'en')
      const prefix = browserLang.split('-')[0].toLowerCase() as Locale;
      if (SUPPORTED_LOCALES.includes(prefix)) {
        return prefix;
      }
    }
  } catch {
    // navigator unavailable
  }
  return 'en';
}

// ---------------------------------------------------------------------------
// Month / date formatting helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function padTwo(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatDateString(date: Date, pattern: string): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  let result = pattern;
  result = result.replace('YYYY', String(year));
  result = result.replace('MMMM', MONTH_NAMES[month]);
  result = result.replace('MM', padTwo(month + 1));
  result = result.replace('DD', padTwo(day));
  // Handle 'D' without leading zero — but only standalone D, not the D in DD
  result = result.replace(/(?<!\d)D(?!\d)/, String(day));
  result = result.replace('HH', padTwo(hours));
  result = result.replace('mm', padTwo(minutes));
  result = result.replace('ss', padTwo(seconds));

  return result;
}

// ---------------------------------------------------------------------------
// I18n
// ---------------------------------------------------------------------------

/**
 * Internationalization manager. Singleton per application.
 * Provides translation lookup, interpolation, pluralization,
 * and locale-aware formatting. Notifies subscribers on locale change.
 * Persists selected locale to localStorage.
 */
export class I18n {
  private static instance: I18n | null = null;

  private locales = new Map<Locale, LocaleData>();
  private currentLocale: Locale;
  private listeners = new Set<Listener>();

  constructor() {
    // Register built-in English
    this.locales.set('en', ENGLISH_LOCALE);

    // Load saved locale from localStorage, or detect from browser
    const saved = this.loadSavedLocale();
    if (saved && SUPPORTED_LOCALES.includes(saved) && this.locales.has(saved)) {
      this.currentLocale = saved;
    } else {
      const detected = detectBrowserLocale();
      this.currentLocale = this.locales.has(detected) ? detected : 'en';
    }
  }

  /** Get or create the singleton instance. */
  static getInstance(): I18n {
    if (!I18n.instance) {
      I18n.instance = new I18n();
    }
    return I18n.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    I18n.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /** Subscribe to locale changes. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Locale management
  // -----------------------------------------------------------------------

  /** Get the current locale. */
  getLocale(): Locale {
    return this.currentLocale;
  }

  /** Switch to a different locale. Notifies subscribers. */
  setLocale(locale: Locale): void {
    if (!this.locales.has(locale)) {
      return;
    }
    this.currentLocale = locale;
    this.saveLocale(locale);
    this.notify();
  }

  /** Get all registered locale codes. */
  getAvailableLocales(): Locale[] {
    const result: Locale[] = [];
    this.locales.forEach((_data, key) => {
      result.push(key);
    });
    return result;
  }

  /** Register or update a locale. */
  registerLocale(data: LocaleData): void {
    this.locales.set(data.locale, data);
  }

  /** Get the text direction of the current locale. */
  getDirection(): 'ltr' | 'rtl' {
    const data = this.locales.get(this.currentLocale);
    return data?.direction ?? 'ltr';
  }

  // -----------------------------------------------------------------------
  // Translation
  // -----------------------------------------------------------------------

  /**
   * Translate a key using dot-notation path.
   *
   * Supports:
   * - Simple strings: `t('common.save')` → `'Save'`
   * - Interpolation: `t('app.version', { version: '1.0' })` → `'Version 1.0'`
   * - Pluralization: `t('panels.validation.issueCount', { count: 5 })` → `'5 issues found'`
   * - Missing key fallback: returns the key itself
   */
  t(key: string, options?: FormatOptions): string {
    const data = this.locales.get(this.currentLocale);
    if (!data) {
      return key;
    }

    const value = resolveNestedKey(data.translations, key);

    if (value === undefined) {
      return key;
    }

    // If it's a nested object (not a leaf), return the key
    if (typeof value === 'object' && !isPluralRules(value)) {
      return key;
    }

    let result: string;

    if (typeof value === 'string') {
      result = value;
    } else if (isPluralRules(value)) {
      const count = options?.count ?? 0;
      result = selectPlural(value, count);
    } else {
      return key;
    }

    // Interpolation
    if (options) {
      const interpolationValues: Record<string, unknown> = { ...options };
      result = interpolate(result, interpolationValues);
    }

    return result;
  }

  /** Check whether a translation key exists. */
  hasKey(key: string): boolean {
    const data = this.locales.get(this.currentLocale);
    if (!data) {
      return false;
    }
    const value = resolveNestedKey(data.translations, key);
    if (value === undefined) {
      return false;
    }
    // A key "exists" if it's a string or plural rules (a leaf), not an intermediate object
    if (typeof value === 'string' || isPluralRules(value)) {
      return true;
    }
    // Intermediate objects also count — they exist as namespaces
    return true;
  }

  // -----------------------------------------------------------------------
  // Formatting
  // -----------------------------------------------------------------------

  /** Format a number using locale-aware decimal and thousands separators. */
  formatNumber(value: number, decimals?: number): string {
    const data = this.locales.get(this.currentLocale);
    const fmt = data?.numberFormat ?? ENGLISH_LOCALE.numberFormat;

    const fixed = decimals !== undefined ? value.toFixed(decimals) : String(value);
    const [intPart, decPart] = fixed.split('.');

    // Add thousands separators
    const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, fmt.thousands);

    if (decPart !== undefined) {
      return `${withThousands}${fmt.decimal}${decPart}`;
    }
    return withThousands;
  }

  /** Format a date using locale-aware patterns. */
  formatDate(date: Date | number, format: 'short' | 'long' = 'short'): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    const data = this.locales.get(this.currentLocale);
    const dateFmt = data?.dateFormat ?? ENGLISH_LOCALE.dateFormat;
    const pattern = format === 'long' ? dateFmt.long : dateFmt.short;
    return formatDateString(d, pattern);
  }

  /** Format a currency value. */
  formatCurrency(value: number, currency?: string): string {
    const data = this.locales.get(this.currentLocale);
    const cur = currency ?? data?.numberFormat.currency ?? 'USD';
    const formatted = this.formatNumber(value, 2);

    // Simple currency symbol mapping
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '\u20AC',
      GBP: '\u00A3',
      JPY: '\u00A5',
      CNY: '\u00A5',
      KRW: '\u20A9',
      BRL: 'R$',
    };

    const symbol = symbols[cur] ?? cur;
    return `${symbol}${formatted}`;
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  /** Export a locale's translations as JSON string for translators. */
  exportTranslations(locale: Locale): string {
    const data = this.locales.get(locale);
    if (!data) {
      return JSON.stringify({ locale, translations: {} });
    }
    return JSON.stringify({ locale: data.locale, translations: data.translations }, null, 2);
  }

  /** Import translations from a JSON string. Returns stats and any errors. */
  importTranslations(json: string): { locale: Locale; keys: number; errors: string[] } {
    const errors: string[] = [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      errors.push('Invalid JSON');
      return { locale: 'en', keys: 0, errors };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      errors.push('Expected a JSON object');
      return { locale: 'en', keys: 0, errors };
    }

    const obj = parsed as Record<string, unknown>;

    if (typeof obj.locale !== 'string') {
      errors.push('Missing or invalid "locale" field');
      return { locale: 'en', keys: 0, errors };
    }

    const locale = obj.locale as Locale;

    if (!SUPPORTED_LOCALES.includes(locale)) {
      errors.push(`Unsupported locale: ${locale}`);
      return { locale, keys: 0, errors };
    }

    if (typeof obj.translations !== 'object' || obj.translations === null) {
      errors.push('Missing or invalid "translations" field');
      return { locale, keys: 0, errors };
    }

    const translations = obj.translations as TranslationEntry;
    const keyCount = countTranslationKeys(translations);

    // If locale already exists, merge translations; otherwise create a new locale
    const existing = this.locales.get(locale);
    if (existing) {
      existing.translations = translations;
    } else {
      this.locales.set(locale, {
        locale,
        name: locale,
        direction: 'ltr',
        translations,
        numberFormat: { decimal: '.', thousands: ',', currency: 'USD' },
        dateFormat: { short: 'MM/DD/YYYY', long: 'MMMM D, YYYY', time: 'HH:mm:ss' },
      });
    }

    return { locale, keys: keyCount, errors };
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private saveLocale(locale: Locale): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, locale);
      }
    } catch {
      // localStorage may be unavailable
    }
  }

  private loadSavedLocale(): Locale | null {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && SUPPORTED_LOCALES.includes(saved as Locale)) {
          return saved as Locale;
        }
      }
    } catch {
      // localStorage may be unavailable
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for using i18n in React components.
 * Subscribes to the I18n singleton and triggers re-renders on locale change.
 */
export function useI18n(): {
  t: (key: string, options?: FormatOptions) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  availableLocales: Locale[];
  direction: 'ltr' | 'rtl';
  formatNumber: (value: number, decimals?: number) => string;
  formatDate: (date: Date | number, format?: 'short' | 'long') => string;
  formatCurrency: (value: number, currency?: string) => string;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const i18n = I18n.getInstance();
    const unsubscribe = i18n.subscribe(() => {
      setTick((tick) => tick + 1);
    });
    return unsubscribe;
  }, []);

  const t = useCallback((key: string, options?: FormatOptions) => {
    return I18n.getInstance().t(key, options);
  }, []);

  const setLocale = useCallback((locale: Locale) => {
    I18n.getInstance().setLocale(locale);
  }, []);

  const formatNumber = useCallback((value: number, decimals?: number) => {
    return I18n.getInstance().formatNumber(value, decimals);
  }, []);

  const formatDate = useCallback((date: Date | number, format?: 'short' | 'long') => {
    return I18n.getInstance().formatDate(date, format);
  }, []);

  const formatCurrency = useCallback((value: number, currency?: string) => {
    return I18n.getInstance().formatCurrency(value, currency);
  }, []);

  const i18n = typeof window !== 'undefined' ? I18n.getInstance() : null;

  return {
    t,
    locale: i18n?.getLocale() ?? 'en',
    setLocale,
    availableLocales: i18n?.getAvailableLocales() ?? ['en'],
    direction: i18n?.getDirection() ?? 'ltr',
    formatNumber,
    formatDate,
    formatCurrency,
  };
}
