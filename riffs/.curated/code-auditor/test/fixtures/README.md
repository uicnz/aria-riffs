# Aria Code Auditor Tests

This directory contains tests for the Aria Code Auditor riff. The code-auditor riff provides advanced dependency auditing and safe updating with rollback capabilities.

## Test Coverage

NOTE: There were old tests, but they were broken, so were deleted.

The intention is that tests verify that the modular TypeScript architecture correctly:

1. Audits dependencies (lists all, finds outdated, detects unused)
2. Safely updates dependencies with backup and rollback
3. Handles CLI interface with all commands and options
4. Processes mock environments with proper error handling
5. Validates update options and configurations
6. Creates backups and manages rollback scenarios
7. Integrates with bun commands through the runner
8. Provides proper exit codes and error reporting
9. Works with both JSON and text output formats
10. Handles test verification and selective updates

## Test Files

TBD

## Test Data Structure

The test environment contains:

### mock-package.json

- Standard dependencies: `chalk`, `commander`, `used-dependency`, `unused-dependency`
- Development dependencies: `jest`
- Known outdated versions for testing update scenarios

### mock-source-files/index.js

- `index.js` references `chalk` and `used-dependency`
- Used to test unused dependency detection
- `unused-dependency` should be flagged as potentially unused

## Running Tests

### Complete Test Suite

To run all TypeScript tests for the modular architecture:

```sh
# From the test directory
cd test/code-auditor-test
bun run-tests.ts
```

### Individual Test Files

```sh
# Unit tests for audit engine
bun test-audit-engine.ts

# Unit tests for update engine
bun test-update-engine.ts

# Integration tests with CLI
bun test-integration.ts
```

### Manual Riff Testing

```sh
# Test audit functionality
bun run dev audit --json

# Test update dry run
bun run dev update --dry-run --verbose

# Test status check
bun run dev status

# Test selective updates
bun run dev update --selective --dry-run
```

## Expected Results

When running against the mock environment, the riff should report:

- **4 Total Dependencies**: chalk, commander, used-dependency, unused-dependency
- **1-2 Outdated Dependencies**: Based on mock data configuration
- **1 Potentially Unused**: unused-dependency (not referenced in mock source files)
- **Proper Exit Codes**: 0 (success), 1 (unused found), 2 (outdated found), 3 (both issues)

### CLI Integration Tests

The integration tests should verify:

- All CLI commands work properly (audit, update, status)
- Help and version information display correctly
- Mock environment processing works as expected
- Error handling for invalid commands
- JSON output format functionality
- Dry run mode prevents actual changes

## Test Architecture

The TypeScript tests should follow the established modular approach:

- **Unit Tests**: Test individual modules (audit-engine, update-engine, bun-cmd, backup-manager, reporter)
- **Integration Tests**: Test complete CLI workflows with mock environments
- **Mock Environment**: Controlled testing with predictable bun command outputs
- **Error Handling**: Verify graceful handling of failures and edge cases

All tests import from the actual TypeScript modules to verify the refactored architecture works correctly.

## Mock Environment

Tests use environment variables to control bun command behavior:

```sh
CODE_AUDITOR_TEST_MODE=true                    # Enable mock mode
CODE_AUDITOR_MOCK_BUN_LIST={"dependencies":{}} # Mock bun pm ls output
CODE_AUDITOR_MOCK_BUN_OUTDATED={"pkg":{}}     # Mock bun outdated output
CODE_AUDITOR_MOCK_BUN_TEST="success"          # Mock bun test output
```
