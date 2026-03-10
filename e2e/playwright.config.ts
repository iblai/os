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
  testDir: '.',
  platforms: [
    { name: 'auth', dependencies: [], otherTestMatch: ['**auth/*/*.spec.ts'] },
    {
      name: 'mentor',
      dependencies: ['setup'],
      otherTestMatch: [
        'tests/!(auth)/**/*.spec.ts',
        '*.common.spec.ts',
      ],
    },
  ],
  extraProjects: [
    {
      name: 'mentor-cleanup',
      dependencies: ['mentor'],
      testMatch: ['**cleanup.mentornextjs.cleanup.ts'],
    },
    {
      name: 'mentor-public-views',
      dependencies: ['mentor'],
      testMatch: ['**mentor-viewable-by-anyone.spec.ts'],
    },
  ],
});
