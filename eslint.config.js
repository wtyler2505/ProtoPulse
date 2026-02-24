import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import-x';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // ── Global ignores ──────────────────────────────────────────────────
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.config.*',
      'server/public/**',
      'temp/**',
      'attached_assets/**',
    ],
  },

  // ── Base JS recommended rules ───────────────────────────────────────
  js.configs.recommended,

  // ── TypeScript strict + stylistic rules ─────────────────────────────
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ── React (JSX runtime — no need to import React) ──────────────────
  {
    ...reactPlugin.configs.flat.recommended,
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  reactPlugin.configs.flat['jsx-runtime'],

  // ── React Hooks ─────────────────────────────────────────────────────
  {
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // ── Import ordering & hygiene ───────────────────────────────────────
  {
    plugins: {
      'import-x': importPlugin,
    },
    settings: {
      'import-x/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      'import-x/order': [
        'warn',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'type',
          ],
          pathGroups: [
            // React/framework imports first within external
            {
              pattern: 'react',
              group: 'external',
              position: 'before',
            },
            {
              pattern: 'react-dom/**',
              group: 'external',
              position: 'before',
            },
            // Internal path aliases after external
            {
              pattern: '@/**',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '@shared/**',
              group: 'internal',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['react'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import-x/no-duplicates': 'error',
      'import-x/no-unresolved': 'off', // TypeScript handles this
      'import-x/consistent-type-specifier-style': ['error', 'prefer-top-level'],
    },
  },

  // ── Project-specific rules ──────────────────────────────────────────
  {
    rules: {
      // ─ TypeScript ─
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // ─ General ─
      'prefer-const': 'error',
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],

      // ─ React ─
      'react/prop-types': 'off', // TypeScript handles prop validation
      'react/display-name': 'off',
      'react/no-unescaped-entities': 'warn',

      // ─ Relax overly strict rules for this codebase ─
      // These strictTypeChecked rules are too noisy for an existing codebase;
      // downgrade from error to warn so they don't block development while
      // the codebase is incrementally brought into compliance.
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'warn',
        { allowNumber: true },
      ],
    },
  },

  // ── Server-specific overrides ───────────────────────────────────────
  {
    files: ['server/**/*.ts'],
    rules: {
      // Console usage is expected in server code (logging)
      'no-console': 'off',
    },
  },

  // ── Test file overrides ─────────────────────────────────────────────
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      'no-console': 'off',
    },
  },

  // ── Disable formatting rules (Prettier handles formatting) ─────────
  prettierConfig,
);
