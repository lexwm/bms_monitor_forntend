import tseslint from 'typescript-eslint';
export default tseslint.config(
 { ignores: ['src/api/generated/**', 'dist/**', 'node_modules/**', 'test-results/**'] },
 { files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'],
   languageOptions: { parser: tseslint.parser, parserOptions: { project: './tsconfig.json', tsconfigRootDir: import.meta.dirname } },
   plugins: { '@typescript-eslint': tseslint.plugin },
   rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-type-assertion': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
   }
 }
);
