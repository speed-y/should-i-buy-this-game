import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Load .env.local synchronously to prevent module-level Zod parsing errors in tests
try {
  const envPath = path.resolve(__dirname, '.env.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    envContent.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=')
        if (index !== -1) {
          const key = trimmed.substring(0, index).trim()
          const value = trimmed.substring(index + 1).trim()
          if (!process.env[key]) {
            process.env[key] = value
          }
        }
      }
    })
  }
} catch (error) {
  console.error('Failed to parse .env.local', error)
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
      thresholds: {
        lines: 65,
        functions: 65,
        branches: 60,
      },
    },
  },
})
