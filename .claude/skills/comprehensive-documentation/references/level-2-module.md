# Level 2: Module Documentation

**ALWAYS document at the module level:**

## Module Overview (lib.rs or mod.rs)

```rust
//! Transport Layer Module
//!
//! This module provides a hardware-abstracted transport layer for device communication.
//! It supports serial, TCP, UDP, SSH, and I2C transports with unified error handling.
//!
//! # Architecture
//!
//! ```text
//! ┌──────────────────────────────────────┐
//! │         Device Drivers               │
//! ├──────────────────────────────────────┤
//! │    Transport Abstraction Layer       │ ← This module
//! ├──────────────────────────────────────┤
//! │  Serial │ TCP │ UDP │ SSH │ I2C     │
//! └──────────────────────────────────────┘
//! ```
//!
//! # Key Patterns
//!
//! - **Arc<TokioMutex<dyn Transport>>**: Thread-safe transport sharing
//! - **cleanup_resources() before disconnect()**: Critical Windows requirement
//!
//! # Usage Example
//!
//! ```rust
//! let transport = Arc::new(TokioMutex::new(SerialTransport::new("COM3", 9600)?));
//! transport.lock().await.connect().await?;
//! transport.lock().await.send(b"HELLO").await?;
//! transport.lock().await.cleanup_resources().await?;
//! transport.lock().await.disconnect().await?;
//! ```
//!
//! # Design Decisions
//!
//! ## Why Arc<TokioMutex<>> instead of channels?
//! Chose Arc<TokioMutex<>> for simplicity and correctness in async context.
//! See ADR-001 for full analysis.

pub mod serial;
pub mod tcp;
pub mod udp;
```

## Success Criteria

- [ ] Module purpose explained in first paragraph
- [ ] Architecture diagram showing relationships
- [ ] Key patterns documented with examples
- [ ] Complete usage example provided
- [ ] Design decisions with alternatives and reasoning
