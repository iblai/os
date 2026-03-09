import { createPlaywrightConfig } from '@iblai/iblai-js/playwright';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : '.env.development';

dotenv.config({ path: path.resolve(__dirname, envFile) });

export default createPlaywrightConfig({
  platforms: [
    { name: 'auth', dependencies: [], otherTestMatch: ['**auth/*/*.spec.ts'] },
    { name: 'mentor', dependencies: ['setup'], otherTestMatch: ['*.common.spec.ts'] },
    {
      name: 'mentornextjs',
      dependencies: ['setup'],
      otherTestMatch: ['**mentornextjs/*/*.spec.ts', '**mentornextjs/**/*.spec.ts'],
    },
  ],
  extraProjects: [
    {
      name: 'mentornextjs-cleanup',
      dependencies: ['mentornextjs'],
      testMatch: ['**cleanup.mentornextjs.cleanup.ts'],
    },
    {
      name: 'mentornextjs-public-views',
      dependencies: ['mentornextjs'],
      testMatch: ['**mentor-viewable-by-anyone.spec.ts'],
    },
  ],
});
