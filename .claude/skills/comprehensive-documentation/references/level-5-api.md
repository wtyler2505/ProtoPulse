# Level 5: API Documentation

**ALWAYS document public APIs:**

## API Documentation Example

```rust
/// Public API that external code will use
///
/// # Stability
/// This API follows semantic versioning.
///
/// # Examples
/// \`\`\`rust
/// let result = my_function(arg)?;
/// \`\`\`
///
/// # Errors
/// Returns `Error::NotFound` if resource doesn't exist.
/// Returns `Error::Timeout` if operation exceeds 5 seconds.
///
/// # Performance
/// Expected duration: 100-500ms.
/// Timeout after 5 seconds.
///
/// # Thread Safety
/// This method requires `&mut self` and is not thread-safe.
#[must_use]
pub async fn my_function(&mut self, arg: Arg) -> Result<Output> { }
```

## API Changelog Format

```markdown
# API Changelog

## Version 0.2.0 (YYYY-MM-DD)

### Added
- `new_method()` for new functionality

### Changed
- **BREAKING**: `old_method()` now returns Result instead of Option

### Deprecated
- `legacy_method()` - Use `new_method()` instead
  - Removal planned: Version 1.0.0
  - Migration: Replace X with Y

### Fixed
- Fixed edge case in `method()` when input is empty
```

## Success Criteria

- [ ] Every public API documented with examples
- [ ] Stability guarantees stated
- [ ] Error conditions enumerated
- [ ] Performance characteristics specified
- [ ] Thread safety documented
- [ ] API changelog maintained
- [ ] Migration guides for breaking changes
