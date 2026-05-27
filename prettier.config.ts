import type { Config } from 'prettier'

const config: Config = {
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 100,
  plugins: ['prettier-plugin-tailwindcss'],
}

export default config
