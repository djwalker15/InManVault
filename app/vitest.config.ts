import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      globals: true,
      setupFiles: ['./src/test/setup.tsx'],
      css: false,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/main.tsx',
          'src/App.tsx',
          'src/lib/types.ts',
          'src/lib/supabase.ts',
          'src/routes/sso-callback.tsx',
          'src/routes/onboarding/invite.tsx',
          'src/components/top-nav.tsx',
          'src/components/signed-in/**',
          'src/components/onboarding/**',
          'src/components/auth/auth-separator.tsx',
          'src/components/auth/social-auth-button.tsx',
          'src/test/**',
          'src/**/*.test.{ts,tsx}',
          'src/**/*.spec.{ts,tsx}',
          'src/vite-env.d.ts',
        ],
        thresholds: {
          statements: 70,
          branches: 70,
          functions: 70,
          lines: 70,
        },
      },
    },
  }),
)
