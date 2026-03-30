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
	rm -rf e2e/playwright-report
	rm -rf test-results
	rm -rf e2e/test-results
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

# run all e2e tests (all browsers)
e2e:
	npx playwright test --config=e2e/playwright.config.ts

# run e2e tests in headed mode (visible browser)
e2e-headed:
	npx playwright test --config=e2e/playwright.config.ts --headed

# run e2e tests in UI mode (interactive)
e2e-ui:
	npx playwright test --config=e2e/playwright.config.ts --ui

# run e2e tests for a specific journey (usage: make e2e-journey J=01)
e2e-journey:
	npx playwright test --config=e2e/playwright.config.ts e2e/journeys/$(J)-*.spec.ts

# run e2e tests only on Chrome
e2e-chrome:
	npx playwright test --config=e2e/playwright.config.ts --project=mentor-desktop-chrome

# run e2e tests and show the HTML report
e2e-report:
	npx playwright show-report e2e/playwright-report

# install Playwright browsers
e2e-install:
	npx playwright install --with-deps

# run e2e tests in debug mode
e2e-debug:
	npx playwright test --config=e2e/playwright.config.ts --debug

# Release a new version (usage: make release VERSION=0.40.0)
release:
	@if [ -z "$(VERSION)" ]; then echo "Error: VERSION is required. Usage: make release VERSION=0.40.0"; exit 1; fi
	git tag -a v$(VERSION) -m 'chore: release v$(VERSION)'
	git push origin v$(VERSION) --no-verify
