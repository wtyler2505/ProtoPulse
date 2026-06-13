import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';
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
      'add_context.cjs',
      'client/public/**',
      '.obsidian/**',
      '.agents/**',
      '.claude/**',
      '.codex/**',
      '.devin/**',
      '.gemini/**',
      '.windsurf/**',
      'coverage/**',
      'docs/**/*.js',
      'playwright-report/**',
      'scripts/**/*.cjs',
      'packages/*/dist/**',
      'packages/*/coverage/**',
    ],
  },

  // ── Base JS recommended rules ───────────────────────────────────────
  js.configs.recommended,

  // ── TypeScript strict + stylistic rules ─────────────────────────────
  // CI runs `npm run check` for full type validation. Keep ESLint
  // non-type-aware so lint stays fast enough for this mixed app/vault repo.
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,

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

  // ── jsx-a11y (accessibility) ────────────────────────────────────────
  // E2E-552 / Plan 03 Phase 4 — static a11y safety net.
  {
    ...jsxA11y.flatConfigs.recommended,
    files: ['**/*.{jsx,tsx}'],
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/label-has-associated-control': 'warn',
      // autoFocus is a legitimate UX pattern in search dialogs, command
      // palettes, and modal inputs — documented false-positive per
      // eslint-plugin-jsx-a11y README.
      'jsx-a11y/no-autofocus': 'off',
    },
  },

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
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: './tsconfig.json',
        }),
      ],
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
      'import-x/no-duplicates': 'warn',
      'import-x/no-unresolved': 'off', // TypeScript handles this
      'import-x/consistent-type-specifier-style': ['warn', 'prefer-top-level'],
    },
  },

  // ── Project-specific rules ──────────────────────────────────────────
  {
    rules: {
      // ─ TypeScript ─
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // ─ General ─
      'prefer-const': 'warn',
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
      eqeqeq: ['warn', 'always'],
      curly: ['error', 'all'],
      'no-control-regex': 'warn',
      'no-empty': 'warn',
      'no-alert': 'warn',
      'no-constant-binary-expression': 'warn',
      'no-constant-condition': 'warn',
      'no-irregular-whitespace': 'warn',
      'no-regex-spaces': 'warn',
      'no-unused-expressions': 'warn',
      'no-useless-escape': 'warn',
      'require-yield': 'warn',

      // ─ React ─
      'react/prop-types': 'off', // TypeScript handles prop validation
      'react/display-name': 'off',
      'react/no-unescaped-entities': 'warn',
      'react/jsx-no-target-blank': 'warn',
      'react/no-unknown-property': 'warn',

      // ─ Relax overly strict rules for this codebase ─
      // These strictTypeChecked rules are too noisy for an existing codebase;
      // downgrade from error to warn so they don't block development while
      // the codebase is incrementally brought into compliance.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',

      // Keep legacy strict-lint debt visible without making the existing
      // historical app tree a permanent CI blocker. New cleanup can
      // ratchet these back to errors file-by-file.
      '@typescript-eslint/array-type': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/consistent-generic-constructors': 'warn',
      '@typescript-eslint/consistent-indexed-object-style': 'warn',
      '@typescript-eslint/consistent-type-definitions': 'warn',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-dynamic-delete': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-extraneous-class': 'warn',
      '@typescript-eslint/no-inferrable-types': 'warn',
      '@typescript-eslint/no-invalid-void-type': 'warn',
      '@typescript-eslint/no-namespace': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-this-alias': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-useless-default-assignment': 'off',
      '@typescript-eslint/no-useless-constructor': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/prefer-for-of': 'warn',
      '@typescript-eslint/prefer-function-type': 'warn',
      '@typescript-eslint/prefer-regexp-exec': 'off',
      '@typescript-eslint/require-await': 'off',
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

  // ── Tooling scripts (tools/) ────────────────────────────────────────
  {
    files: ['tools/screenshots/**/*.ts'],
    rules: {
      // The rig narrates its progress to the terminal by design.
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

  // ── React Three Fiber scene overrides ───────────────────────────────
  // R3F renders three.js objects through lowercase intrinsic JSX elements
  // (<mesh>, <meshStandardMaterial>, …) whose props are three.js property
  // names (geometry, castShadow, roughness, args, …). eslint-plugin-react's
  // no-unknown-property rule only knows DOM attributes, so it false-positives
  // on every R3F element. Scope the rule off to the WebGL viewer scene tree.
  {
    files: ['client/src/components/views/board-viewer-3d/**/*.tsx'],
    rules: {
      'react/no-unknown-property': 'off',
    },
  },

  // ── Disable formatting rules (Prettier handles formatting) ─────────
  prettierConfig,
);
