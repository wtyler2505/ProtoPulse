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

[typescript-check] npm run check

> rest-express@1.0.0 check
> NODE_OPTIONS='--max-old-space-size=16384' tsc


[ipc-contract-guard] npm run lint:ipc-contract

> rest-express@1.0.0 lint:ipc-contract
> bash scripts/ci/guard-legacy-ipc-names.sh

[guard-legacy-ipc] PASS: no legacy invoke names in client/src/lib/tauri-api.ts

[rust-check] cargo_exec check --manifest-path src-tauri/Cargo.toml

[tauri-build-smoke] npm run tauri:build -- --debug --bundles deb

> rest-express@1.0.0 tauri:build
> tauri build --debug --bundles deb


== ProtoPulse Tauri Preflight Report ==
status: warning

passed:
  - toolchain: node 22.22.0
  - toolchain: npm 11.13.0
  - toolchain: rustc 1.93.0
  - toolchain: cargo 1.93.0
  - toolchain: rustup toolchain override active: 1.93.0
  - toolchain: tauri CLI 2.10.1 via /home/wtyler/Projects/ProtoPulse/node_modules/.bin/tauri
  - npm-cache: Writable cache directory: /tmp/npm-cache-protopulse
  - cargo-cache-probe: cargo_exec --list
  - cargo-cache: Writable cache directory: /tmp/cargo-home-protopulse
  - registry-npm: @tauri-apps/plugin-log@2.8.0
  - registry-npm: @tauri-apps/plugin-process@2.3.1
  - registry-npm: @tauri-apps/plugin-updater@2.10.1
  - registry-cargo: tauri-specta=2.0.0-rc.25
  - registry-cargo: specta=2.0.0-rc.25
  - registry-cargo: specta-typescript=0.0.12
  - registry-cargo: tauri-plugin-log=2.8.0
  - registry-cargo: tauri-plugin-process=2.3.1
  - registry-cargo: tauri-plugin-updater=2.10.1
  - registry-cargo: tauri-plugin-fs is resolvable
  - registry-cargo: tauri-plugin-dialog is resolvable
  - registry-cargo: tauri-plugin-shell is resolvable
  - registry-cargo: tauri-plugin-opener is resolvable
  - registry-cargo: tauri-plugin-stronghold is resolvable
  - registry-cargo: tauri-plugin-store is resolvable
  - registry-cargo: tauri-plugin-deep-link is resolvable
  - registry-cargo: tauri-plugin-single-instance is resolvable
  - registry-cargo: tauri-plugin-window-state is resolvable
  - typescript-check: npm run check
  - ipc-contract-guard: npm run lint:ipc-contract
  - rust-check: cargo_exec check --manifest-path src-tauri/Cargo.toml
  - tauri-build-smoke: npm run tauri:build -- --debug --bundles deb
  - desktop-artifact-report: dist/index.cjs present
  - tauri-config-report: withGlobalTauri:false confirmed
  - tauri-config-report: CSP present
  - vite-config-report: vite.config.ts base:'./' present

warnings:
  - bundle-identifier-report: identifier is com.protopulse.app (macOS warning follow-up). Prefer an owned reverse-DNS id, e.g. io.github.wtyler2505.protopulse, before public signing/notarization.

artifacts:
  - src-tauri/target/debug/protopulse

cache_exports_if_needed:
  export npm_config_cache=/tmp/npm-cache-protopulse
  export CARGO_HOME=/tmp/cargo-home-protopulse
