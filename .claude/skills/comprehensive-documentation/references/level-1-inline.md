# Level 1: Inline Documentation (Code Comments)

**ALWAYS document at the code level:**

## Function/Method Documentation

```rust
/// Attempts to reconnect to a disconnected device using exponential backoff.
///
/// This function implements a retry strategy with exponential backoff to avoid
/// overwhelming the device or host resources during reconnection attempts.
///
/// # Arguments
/// * `transport` - The transport layer to reconnect
/// * `max_attempts` - Maximum number of reconnection attempts (typically 3)
///
/// # Returns
/// * `Ok(())` if reconnection successful
/// * `Err(TransportError)` if all attempts fail
///
/// # Examples
/// ```rust
/// let transport = Arc::new(SerialTransport::new("COM3", 9600)?);
/// reconnect_with_backoff(transport, 3).await?;
/// ```
///
/// # Design Rationale
/// Exponential backoff chosen over:
/// - Fixed delay: Doesn't adapt to persistent failures
/// - Linear backoff: Too aggressive for devices with slow recovery
///
/// See: docs/architecture/reconnection-strategy.md
pub async fn reconnect_with_backoff(
    transport: Arc<TokioMutex<dyn Transport>>,
    max_attempts: u32,
) -> TransportResult<()> { }
```

## Complex Logic Documentation

```rust
// CRITICAL: cleanup_resources() MUST be called before disconnect()
//
// WHY: Windows holds file handle references that prevent port release
// if disconnect() is called first. This causes "port in use" errors.
//
// Alternative considered: cleanup after disconnect
// Rejected because: Windows driver doesn't release port handle until
// process explicitly clears buffers and drops port reference.
```

## Magic Numbers Documentation

```rust
pub const MAX_RECONNECT_ATTEMPTS: u32 = 3;  // Tested: 3 balances reliability (99.7%) vs delay (max 10.5s)
pub const INITIAL_BACKOFF_MS: u64 = 100;     // Minimum: device needs 50ms recovery, 100ms provides margin
pub const MAX_BACKOFF_MS: u64 = 5000;        // Maximum: user tolerance threshold from UX testing
```

## Tricky Code Documentation

```rust
// TRICKY: Must drop Arc before cleanup_resources() or deadlock occurs
//
// Context: Arc<TokioMutex<Transport>> held by connection monitor thread
// will prevent cleanup_resources() from acquiring lock.
//
// Test case: tests/transport/test_cleanup_deadlock.rs
let connection_monitor = Arc::clone(&self.transport);
drop(connection_monitor);  // REQUIRED: Release Arc reference before cleanup
```

## Success Criteria

- [ ] Every public function has complete doc comment
- [ ] Every complex algorithm explained with WHY
- [ ] Every magic number justified with testing data
- [ ] Every tricky code section has TRICKY comment
- [ ] Every decision has alternatives and reasoning
