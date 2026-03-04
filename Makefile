# Start the development server with Turbopack for faster builds
dev:
	npm run dev

# Build the application for production
build:
	npm run build

# Start the production server
start:
	npm run start

# Run ESLint to check for code quality issues
lint:
	npm run lint

# Run ESLint to check for code quality issues without fixing
lint-check:
	npm run lint:check

# Format code using Prettier
format:
	npm run format

# Check code formatting without making changes
format-check:
	npm run format:check

# Format and lint code in one command
format-lint:
	npm run format-lint

# Install all dependencies
install:
	npm install

# run all tests
test:
	npm run test

# run all tests in watch mode
test-watch:
	npm run test:watch

# run all tests in coverage mode
test-coverage:
	npm run test:coverage

# run all tests in ui mode
test-ui:
	npm run test:ui
