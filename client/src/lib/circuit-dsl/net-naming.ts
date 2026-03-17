/**
 * Net Naming & Scoping — hierarchical net scope management for the Circuit DSL.
 *
 * Enables hierarchical subcircuit encapsulation: each subcircuit gets its own
 * NetScope where local net names are isolated. Names resolve upward through
 * parent scopes (like lexical scoping), and every net has a globally-unique
 * qualified name (e.g. "power_supply.regulator.VCC") for unambiguous
 * cross-scope references and netlist export.
 *
 * Also supports PinAlias — a named alias that maps a friendly external-facing
 * pin name to an internal net (and optionally a specific pin within that net).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A net defined within a specific scope. */
export interface LocalNet {
  /** The local (unqualified) name within its scope. */
  readonly name: string;
  /** The ID of the scope this net belongs to. */
  readonly scopeId: string;
  /** The globally-unique qualified name (e.g. "top.sub.VCC"). */
  readonly globalName: string;
}

/** A hierarchical scope that contains nets. */
export interface NetScope {
  /** Unique identifier for this scope. */
  readonly id: string;
  /** Parent scope ID (undefined for root scopes). */
  readonly parentId: string | undefined;
  /** Map of local net name → LocalNet. */
  readonly nets: Map<string, LocalNet>;
}

/** A named alias mapping a friendly name to a net (and optionally a pin). */
export interface PinAlias {
  /** The alias name (e.g. "INPUT", "OUTPUT"). */
  readonly alias: string;
  /** The net this alias refers to. */
  readonly targetNet: string;
  /** Optional specific pin within the net. */
  readonly targetPin: string | undefined;
}

// ---------------------------------------------------------------------------
// NetScopeManager
// ---------------------------------------------------------------------------

/**
 * Manages hierarchical net scopes. Thread-safe for single-threaded JS
 * environments (no concurrent mutation expected).
 */
export class NetScopeManager {
  private readonly scopes = new Map<string, NetScope>();
  private readonly aliases = new Map<string, Map<string, PinAlias>>();
  private nextScopeId = 0;

  // -----------------------------------------------------------------------
  // Scope lifecycle
  // -----------------------------------------------------------------------

  /**
   * Create a new scope, optionally nested under a parent.
   * @param parentId - parent scope ID; undefined for a root scope
   * @returns the newly created scope's ID
   */
  createScope(parentId?: string): string {
    if (parentId !== undefined && !this.scopes.has(parentId)) {
      throw new Error(`Parent scope "${parentId}" does not exist`);
    }

    const id = `scope_${this.nextScopeId++}`;
    const scope: NetScope = {
      id,
      parentId,
      nets: new Map(),
    };
    this.scopes.set(id, scope);
    this.aliases.set(id, new Map());
    return id;
  }

  // -----------------------------------------------------------------------
  // Net definition & resolution
  // -----------------------------------------------------------------------

  /**
   * Define a net within a scope. The net gets a globally-unique qualified name
   * built from the scope ancestry chain.
   *
   * @param scopeId - scope to define the net in
   * @param localName - the local name (must be unique within the scope)
   * @returns the new LocalNet
   */
  defineNet(scopeId: string, localName: string): LocalNet {
    const scope = this.requireScope(scopeId);

    if (localName.length === 0) {
      throw new Error('Net name must not be empty');
    }

    if (scope.nets.has(localName)) {
      throw new Error(`Net "${localName}" already defined in scope "${scopeId}"`);
    }

    const globalName = this.buildQualifiedName(scopeId, localName);

    const net: LocalNet = {
      name: localName,
      scopeId,
      globalName,
    };

    // NetScope.nets is typed readonly for consumers, but we own it internally
    (scope.nets as Map<string, LocalNet>).set(localName, net);

    return net;
  }

  /**
   * Resolve a net name within a scope. Searches the given scope first, then
   * walks up the parent chain (like lexical scoping).
   *
   * @param scopeId - scope to start resolution from
   * @param name - local net name to resolve
   * @returns the resolved LocalNet, or undefined if not found
   */
  resolveNet(scopeId: string, name: string): LocalNet | undefined {
    let currentId: string | undefined = scopeId;

    while (currentId !== undefined) {
      const scope = this.scopes.get(currentId);
      if (!scope) {
        return undefined;
      }

      const net = scope.nets.get(name);
      if (net) {
        return net;
      }

      currentId = scope.parentId;
    }

    return undefined;
  }

  /**
   * Get the fully-qualified global name for a net in a scope.
   *
   * @param scopeId - scope the net belongs to
   * @param localName - local net name
   * @returns the fully-qualified global name
   * @throws if the net is not found in the specified scope
   */
  getGlobalName(scopeId: string, localName: string): string {
    const scope = this.requireScope(scopeId);
    const net = scope.nets.get(localName);
    if (!net) {
      throw new Error(`Net "${localName}" not found in scope "${scopeId}"`);
    }
    return net.globalName;
  }

  /**
   * Get all nets defined directly in the given scope (not inherited).
   *
   * @param scopeId - scope to query
   * @returns array of LocalNets in the scope
   */
  getScopeNets(scopeId: string): LocalNet[] {
    const scope = this.requireScope(scopeId);
    return Array.from(scope.nets.values());
  }

  /**
   * Collect all nets across all scopes into a flat array.
   *
   * @returns array of every LocalNet in every scope
   */
  flattenScopes(): LocalNet[] {
    const result: LocalNet[] = [];
    for (const scope of Array.from(this.scopes.values())) {
      for (const net of Array.from(scope.nets.values())) {
        result.push(net);
      }
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Pin aliases
  // -----------------------------------------------------------------------

  /**
   * Define a pin alias within a scope. Aliases map a friendly name to a
   * target net (and optionally a specific pin on that net).
   *
   * @param scopeId - scope to define the alias in
   * @param alias - the alias name
   * @param net - the target net name (must be resolvable from the scope)
   * @param pin - optional specific pin name
   * @returns the new PinAlias
   */
  definePinAlias(scopeId: string, alias: string, net: string, pin?: string): PinAlias {
    this.requireScope(scopeId);

    if (alias.length === 0) {
      throw new Error('Alias name must not be empty');
    }

    const scopeAliases = this.aliases.get(scopeId);
    if (!scopeAliases) {
      throw new Error(`Alias map missing for scope "${scopeId}"`);
    }

    if (scopeAliases.has(alias)) {
      throw new Error(`Alias "${alias}" already defined in scope "${scopeId}"`);
    }

    // Verify the target net is resolvable
    const resolved = this.resolveNet(scopeId, net);
    if (!resolved) {
      throw new Error(`Target net "${net}" not resolvable from scope "${scopeId}"`);
    }

    const pinAlias: PinAlias = {
      alias,
      targetNet: net,
      targetPin: pin,
    };

    scopeAliases.set(alias, pinAlias);
    return pinAlias;
  }

  /**
   * Get all pin aliases defined in a scope.
   *
   * @param scopeId - scope to query
   * @returns array of PinAliases
   */
  getScopeAliases(scopeId: string): PinAlias[] {
    this.requireScope(scopeId);
    const scopeAliases = this.aliases.get(scopeId);
    if (!scopeAliases) {
      return [];
    }
    return Array.from(scopeAliases.values());
  }

  /**
   * Resolve a pin alias within a scope. Returns the PinAlias if found,
   * undefined otherwise.
   *
   * @param scopeId - scope to search
   * @param alias - alias name to look up
   * @returns the PinAlias, or undefined
   */
  resolveAlias(scopeId: string, alias: string): PinAlias | undefined {
    const scopeAliases = this.aliases.get(scopeId);
    if (!scopeAliases) {
      return undefined;
    }
    return scopeAliases.get(alias);
  }

  // -----------------------------------------------------------------------
  // Scope queries
  // -----------------------------------------------------------------------

  /**
   * Get a scope by ID.
   *
   * @param scopeId - scope ID
   * @returns the NetScope, or undefined
   */
  getScope(scopeId: string): NetScope | undefined {
    return this.scopes.get(scopeId);
  }

  /**
   * Get the IDs of all child scopes of the given scope.
   *
   * @param parentId - parent scope ID
   * @returns array of child scope IDs
   */
  getChildScopes(parentId: string): string[] {
    this.requireScope(parentId);
    const children: string[] = [];
    for (const scope of Array.from(this.scopes.values())) {
      if (scope.parentId === parentId) {
        children.push(scope.id);
      }
    }
    return children;
  }

  /**
   * Get the total number of scopes managed.
   */
  get scopeCount(): number {
    return this.scopes.size;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Build the fully-qualified net name by walking up the scope ancestry.
   * Produces names like "grandparent.parent.localName".
   */
  private buildQualifiedName(scopeId: string, localName: string): string {
    const segments: string[] = [localName];
    let currentId: string | undefined = scopeId;

    while (currentId !== undefined) {
      const scope = this.scopes.get(currentId);
      if (!scope) {
        break;
      }
      segments.unshift(currentId);
      currentId = scope.parentId;
    }

    return segments.join('.');
  }

  /**
   * Get a scope by ID or throw if it doesn't exist.
   */
  private requireScope(scopeId: string): NetScope {
    const scope = this.scopes.get(scopeId);
    if (!scope) {
      throw new Error(`Scope "${scopeId}" does not exist`);
    }
    return scope;
  }
}
