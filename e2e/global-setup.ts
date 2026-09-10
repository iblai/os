import dotenv from 'dotenv';
import path from 'path';

export default function globalSetup() {
  dotenv.config({ path: path.join(__dirname, '.env.local'), override: true });
  dotenv.config({ path: path.join(__dirname, '.env') });
}
