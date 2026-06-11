ProtoPulse Tauri preflight starting in /home/wtyler/Projects/ProtoPulse

[cargo-cache-probe] cargo_exec --list
Installed Commands:
    add                  Add dependencies to a Cargo.toml manifest file
    audit
    b                    alias: build
    bench                Execute all benchmarks of a local package
    build                Compile a local package and all of its dependencies
    c                    alias: check
    check                Check a local package and all of its dependencies for errors
    clean                Remove artifacts that cargo has generated in the past
    clippy               Checks a package to catch common mistakes and improve your Rust code.
    config               Inspect configuration values
    d                    alias: doc
    deny
    doc                  Build a package's documentation
    embed
    fetch                Fetch dependencies of a package from the network
    fix                  Automatically fix lint warnings reported by rustc
    flamegraph
    flash
    fmt                  Formats all bin and lib files of the current crate using rustfmt.
    fuzz
    geiger
    generate-lockfile    Generate the lockfile for a package
    git-checkout         REMOVED: This command has been removed
    help                 Displays help for a cargo command
    info                 Display information about a package
    init                 Create a new cargo package in an existing directory
    install              Install a Rust binary
    llvm-cov
    locate-project       Print a JSON representation of a Cargo.toml file's location
    login                Log in to a registry.
    logout               Remove an API token from the registry locally
    make
    metadata             Output the resolved dependencies of a package, the concrete used versions including overrides, in machine-readable format
    miri
    mutants
    new                  Create a new cargo package at <path>
    nextest
    owner                Manage the owners of a crate on the registry
    package              Assemble the local package into a distributable tarball
    pkgid                Print a fully qualified package specification
    publish              Upload a package to the registry
    r                    alias: run
    read-manifest        DEPRECATED: Print a JSON representation of a Cargo.toml manifest.
    remove               Remove dependencies from a Cargo.toml manifest file
    report               Generate and display various kinds of reports
    rm                   alias: remove
    run                  Run a binary or example of the local package
    rustc                Compile a package, and pass extra options to the compiler
    rustdoc              Build a package's documentation, using specified custom flags.
    search               Search packages in the registry. Default registry is crates.io
    semver-checks
    t                    alias: test
    tarpaulin
    tauri
    test                 Execute all unit and integration tests and build examples of a local package
    tree                 Display a tree visualization of a dependency graph
    uninstall            Remove a Rust binary
    update               Update dependencies as recorded in the local lock file
    vendor               Vendor all dependencies for a project locally
    verify-project       DEPRECATED: Check correctness of crate manifest.
    version              Show version information
    vet
    watch
    yank                 Remove a pushed crate from the index

== ProtoPulse Tauri Preflight Report ==
status: failed
failed_gate: registry-npm
failure: Expected @tauri-apps/plugin-log@2.8.0, got 'npmnotice'.
fix: Keep the plan-doc pin or update the plan before implementation.

passed:
  - toolchain: node 22.22.0
  - toolchain: npm 10.8.2
  - toolchain: rustc 1.93.0
  - toolchain: cargo 1.93.0
  - toolchain: rustup toolchain override active: 1.93.0
  - toolchain: tauri CLI 2.10.1 via /home/wtyler/Projects/ProtoPulse/node_modules/.bin/tauri
  - npm-cache: Writable cache directory: /tmp/npm-cache-protopulse
  - cargo-cache-probe: cargo_exec --list
  - cargo-cache: Writable cache directory: /tmp/cargo-home-protopulse

cache_exports_if_needed:
  export npm_config_cache=/tmp/npm-cache-protopulse
  export CARGO_HOME=/tmp/cargo-home-protopulse
