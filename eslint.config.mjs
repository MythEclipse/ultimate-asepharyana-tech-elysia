import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  typescript: true,
  rules: {
    'no-console': 'off',
    'eslint-comments/no-unlimited-disable': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'node/prefer-global/process': 'off',
    'node/prefer-global/buffer': 'off',
    'antfu/top-level-function': 'off',
    'perfectionist/sort-imports': 'off', // Can be annoying when organizing by logic
    'e18e/prefer-static-regex': 'off',
  },
})
