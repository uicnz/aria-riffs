# Aria Dir Differ Tests

This directory contains tests for the Aria Dir Differ riff. The dir-differ riff compares two directories and displays differences with colorful output.

## Test Coverage

NOTE: There were old tests that did not work so they were deleted.

The tests should verify that the modular TypeScript architecture correctly:

1. Validates directory paths and handles errors appropriately
2. Reads and compares file contents accurately
3. Identifies different types of changes (added, removed, modified files)
4. Handles various file content comparison scenarios
5. Respects exclusion patterns and filters
6. Provides proper CLI interface functionality
7. Displays colorful output formatting
8. Handles edge cases and error conditions
9. Summary-only mode works correctly
10. Content comparison shows line-by-line differences

## Test Files

- `dir1/` and `dir2/` - Test data directories with known differences

## Test Data Structure

The test directories contain:

### dir1/

- `identical-file.txt` - Same content in both directories
- `different-content.txt` - Different content from dir2 version
- `only-in-dir1.txt` - File that exists only in dir1
- `exclude-me.temp` - File for testing exclusion patterns
- `nested/nested-file.txt` - File in subdirectory (only in dir1)

### dir2/

- `identical-file.txt` - Same content as dir1 version
- `different-content.txt` - Different content from dir1 version (more lines)
- `only-in-dir2.txt` - File that exists only in dir2

## Running Tests

### Complete Test Suite

To run all TypeScript tests for the modular architecture:

TBD

### Manual Riff Testing

```sh
# Test basic directory comparison
bun run dev ../../test/dir-differ/dir1 ../../test/dir-differ/dir2

# Test with content differences shown
bun run dev ../../test/dir-differ/dir1 ../../test/dir-differ/dir2 --content

# Test with exclusion patterns
bun run dev ../../test/dir-differ/dir1 ../../test/dir-differ/dir2 --exclude "*.temp"

# Test summary-only mode
bun run dev ../../test/dir-differ/dir1 ../../test/dir-differ/dir2 --summary-only
```

## Expected Results

When comparing dir1 and dir2, the riff should report:

- **1 Identical file**: `identical-file.txt`
- **1 Changed file**: `different-content.txt`
- **3 Files only in directory 1**: `only-in-dir1.txt`, `exclude-me.temp`, `nested/nested-file.txt`
- **1 File only in directory 2**: `only-in-dir2.txt`

### Content Comparison

When using `--content` option on `different-content.txt`:

- Line 4: "dir1" vs "dir2"
- Line 5: "dir1" vs "dir2 - modified"
- Line 8: "Line specific to dir1" vs "A completely new line only in dir2"
- Line 9: Empty vs "Another line only in dir2"

## Test Architecture

The TypeScript tests should follow a modular approach:

- **Unit Tests**: Test individual modules (directory-validate, content-compare, output-format)
- **Integration Tests**: Test complete workflows with real test directories
- **CLI Tests**: Verify command-line interface functionality with all options
- **Error Tests**: Ensure proper error handling for invalid paths and scenarios

All tests should import from the actual TypeScript modules to verify the refactored architecture works correctly.
