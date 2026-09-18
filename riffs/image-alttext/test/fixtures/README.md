# Aria Image Alttext Tests

This directory contains tests for the Aria Image Alttext riff. The image-alttext riff processes markdown files and adds alt text from figure captions, improving accessibility.

## Test Coverage

NOTE: there were old tests that were broken so they were deleted.

The tests should verify that the modular TypeScript architecture correctly:

1. Processes empty alt text images with following figure captions
2. Ignores images that already have alt text
3. Ignores images without proper figure captions
4. Handles multiple image file extensions (png, jpg, jpeg, gif, emf)
5. Processes multiple sequential images correctly
6. Handles various whitespace patterns
7. Provides appropriate error handling and debugging information
8. CLI interface works correctly with all options
9. Dry run mode doesn't modify files
10. Verbose mode provides detailed output

## Test Files

- `image-alttext-test-cases.md` - Test data file with various edge cases and scenarios

## Running Tests

### Manual Riff Testing

```sh
# Test the CLI with the test data
bun run dev process test/image-alttext-test/image-alttext-test-cases.md --verbose

# Test in dry-run mode
bun run dev process test/image-alttext-test/image-alttext-test-cases.md --dry-run

# Analyze without changes
bun run dev analyze test/image-alttext-test/image-alttext-test-cases.md
```

## Test Cases in image-alttext-test-cases.md

1. **Case 1**: Standard empty alt text with figure caption (should be processed)
2. **Case 2**: Image with existing alt text (should be ignored)
3. **Case 3**: Image without proper figure caption (should be ignored)
4. **Case 4**: Multiple sequential images with captions (all should be processed)
5. **Case 5**: Different image file extensions (all supported types should be processed)
6. **Case 6**: Varying whitespace patterns (tests newline handling)
7. **Case 7**: Edge cases (unsupported file types, whitespace-only alt text)

## Expected Results

- **Should Process**: Cases 1, 4 (both images), 5 (all supported extensions), 6 (proper spacing)
- **Should Ignore**: Cases 2 (existing alt text), 3 (no proper caption), 7 (unsupported formats)
- **Verbose Mode**: Shows match details, image paths, and captions
- **Error Handling**: Provides clear messages for invalid files or paths

## Test Architecture

The TypeScript tests should follow a modular approach:

- **Unit Tests**: Test individual modules (image-process, file-handle, types)
- **Integration Tests**: Test complete workflows with real data
- **CLI Tests**: Verify command-line interface functionality
- **Error Tests**: Ensure proper error handling and validation

All tests should import from the actual TypeScript modules to verify the refactored architecture works correctly.
