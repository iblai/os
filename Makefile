# Start the development server with Turbopack for faster builds
dev:
	pnpm run dev

# Build the application for production
build:
	pnpm run build

# Start the production server
start:
	pnpm run start

# Run ESLint to check for code quality issues
lint:
	pnpm run lint

# Run ESLint to check for code quality issues without fixing
lint-check:
	pnpm run lint:check

# Format code using Prettier
format:
	pnpm run format

# Check code formatting without making changes
format-check:
	pnpm run format:check

# Format and lint code in one command
format-lint:
	pnpm run format-lint

# Install all dependencies
install:
	pnpm install

# Clean build artifacts and dependencies
clean:
	rm -rf node_modules
	rm -rf .next
	rm -rf dist
	rm -rf dist-electron
	rm -rf .turbo
	rm -rf playwright-report
	rm -rf test-results
	rm -rf coverage

# Clean everything and reinstall
clean-install:
	$(MAKE) clean
	$(MAKE) install

# run all tests
test:
	pnpm run test

# run all tests in watch mode
test-watch:
	pnpm run test:watch

# run all tests in coverage mode
test-coverage:
	pnpm run test:coverage

# run all tests in ui mode
test-ui:
	pnpm run test:ui
