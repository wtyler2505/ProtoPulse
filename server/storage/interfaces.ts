import type {
  Project, InsertProject,
  ArchitectureNode, InsertArchitectureNode,
  ArchitectureEdge, InsertArchitectureEdge,
  BomItem, InsertBomItem,
  ValidationIssue, InsertValidationIssue,
  ChatMessage, InsertChatMessage,
  HistoryItem, InsertHistoryItem,
  ComponentPart, InsertComponentPart,
  ComponentLibraryEntry, InsertComponentLibrary,
  UserChatSettings, InsertUserChatSettings,
  CircuitDesignRow, InsertCircuitDesign,
  CircuitInstanceRow, InsertCircuitInstance,
  CircuitNetRow, InsertCircuitNet,
  CircuitWireRow, InsertCircuitWire,
  CircuitViaRow, InsertCircuitVia,
  SimulationResultRow, InsertSimulationResult,
  SimulationScenario, InsertSimulationScenario,
  AiActionRow, InsertAiAction,
  HierarchicalPortRow, InsertHierarchicalPort,
  SpiceModelRow, InsertSpiceModel,
  DesignPreference, InsertDesignPreference,
  BomSnapshot, InsertBomSnapshot,
  ComponentLifecycle, InsertComponentLifecycle,
  DesignSnapshot, InsertDesignSnapshot,
  DesignComment, InsertDesignComment,
  PcbOrder, InsertPcbOrder,
  PcbZone, InsertPcbZone,
  ArduinoWorkspace, InsertArduinoWorkspace,
  ArduinoBuildProfile, InsertArduinoBuildProfile,
  ArduinoJob, InsertArduinoJob,
  ArduinoSerialSession, InsertArduinoSerialSession,
  ArduinoSketchFile, InsertArduinoSketchFile,
} from '@shared/schema';

export interface PaginationOptions {
  limit: number;
  offset: number;
  sort: 'asc' | 'desc';
}

export interface IStorage {
  getProjects(opts?: PaginationOptions): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  getProjectsByOwner(userId: number): Promise<Project[]>;
  isProjectOwner(projectId: number, userId: number): Promise<boolean>;
  createProject(project: InsertProject, ownerId?: number): Promise<Project>;
  updateProject(id: number, data: Partial<InsertProject>, expectedVersion?: number): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;

  getNodes(projectId: number, opts?: PaginationOptions): Promise<ArchitectureNode[]>;
  createNode(node: InsertArchitectureNode): Promise<ArchitectureNode>;
  updateNode(id: number, projectId: number, data: Partial<InsertArchitectureNode>, expectedVersion?: number): Promise<ArchitectureNode | undefined>;
  deleteNodesByProject(projectId: number): Promise<void>;
  bulkCreateNodes(nodes: InsertArchitectureNode[]): Promise<ArchitectureNode[]>;

  getEdges(projectId: number, opts?: PaginationOptions): Promise<ArchitectureEdge[]>;
  createEdge(edge: InsertArchitectureEdge): Promise<ArchitectureEdge>;
  updateEdge(id: number, projectId: number, data: Partial<InsertArchitectureEdge>, expectedVersion?: number): Promise<ArchitectureEdge | undefined>;
  deleteEdgesByProject(projectId: number): Promise<void>;
  bulkCreateEdges(edges: InsertArchitectureEdge[]): Promise<ArchitectureEdge[]>;

  replaceNodes(projectId: number, nodes: InsertArchitectureNode[]): Promise<ArchitectureNode[]>;
  replaceEdges(projectId: number, edges: InsertArchitectureEdge[]): Promise<ArchitectureEdge[]>;
  replaceValidationIssues(projectId: number, issues: InsertValidationIssue[]): Promise<ValidationIssue[]>;

  getBomItems(projectId: number, opts?: PaginationOptions): Promise<BomItem[]>;
  getBomItem(id: number, projectId: number): Promise<BomItem | undefined>;
  createBomItem(item: InsertBomItem): Promise<BomItem>;
  updateBomItem(id: number, projectId: number, item: Partial<InsertBomItem>, expectedVersion?: number): Promise<BomItem | undefined>;
  deleteBomItem(id: number, projectId: number): Promise<boolean>;
  getLowStockItems(projectId: number): Promise<BomItem[]>;
  getStorageLocations(projectId: number): Promise<string[]>;

  getValidationIssues(projectId: number, opts?: PaginationOptions): Promise<ValidationIssue[]>;
  createValidationIssue(issue: InsertValidationIssue): Promise<ValidationIssue>;
  deleteValidationIssue(id: number, projectId: number): Promise<boolean>;
  deleteValidationIssuesByProject(projectId: number): Promise<void>;
  bulkCreateValidationIssues(issues: InsertValidationIssue[]): Promise<ValidationIssue[]>;

  getChatMessages(projectId: number, opts?: PaginationOptions & { branchId?: string | null }): Promise<ChatMessage[]>;
  createChatMessage(msg: InsertChatMessage): Promise<ChatMessage>;
  deleteChatMessages(projectId: number): Promise<void>;
  deleteChatMessage(id: number, projectId: number): Promise<boolean>;
  createChatBranch(projectId: number, parentMessageId: number): Promise<{ branchId: string; parentMessageId: number }>;
  getChatBranches(projectId: number): Promise<Array<{ branchId: string; parentMessageId: number | null; messageCount: number; createdAt: Date | null }>>;

  getHistoryItems(projectId: number, opts?: PaginationOptions): Promise<HistoryItem[]>;
  createHistoryItem(item: InsertHistoryItem): Promise<HistoryItem>;
  deleteHistoryItems(projectId: number): Promise<void>;
  deleteHistoryItem(id: number, projectId: number): Promise<boolean>;

  getComponentParts(projectId: number): Promise<ComponentPart[]>;
  getComponentPart(id: number, projectId: number): Promise<ComponentPart | undefined>;
  getComponentPartByNodeId(projectId: number, nodeId: string): Promise<ComponentPart | undefined>;
  createComponentPart(part: InsertComponentPart): Promise<ComponentPart>;
  updateComponentPart(id: number, projectId: number, data: Partial<InsertComponentPart>): Promise<ComponentPart | undefined>;
  deleteComponentPart(id: number, projectId: number): Promise<boolean>;

  getLibraryEntries(opts?: { search?: string; category?: string; page?: number; limit?: number }): Promise<{ entries: ComponentLibraryEntry[]; total: number }>;
  getLibraryEntry(id: number): Promise<ComponentLibraryEntry | undefined>;
  createLibraryEntry(entry: InsertComponentLibrary): Promise<ComponentLibraryEntry>;
  updateLibraryEntry(id: number, data: Partial<InsertComponentLibrary>): Promise<ComponentLibraryEntry | undefined>;
  deleteLibraryEntry(id: number): Promise<boolean>;
  incrementLibraryDownloads(id: number): Promise<void>;

  getChatSettings(userId: number): Promise<UserChatSettings | undefined>;
  upsertChatSettings(userId: number, settings: Partial<InsertUserChatSettings>): Promise<UserChatSettings>;

  // Circuit designs
  getCircuitDesigns(projectId: number): Promise<CircuitDesignRow[]>;
  getCircuitDesign(id: number): Promise<CircuitDesignRow | undefined>;
  createCircuitDesign(data: InsertCircuitDesign): Promise<CircuitDesignRow>;
  updateCircuitDesign(id: number, data: Partial<InsertCircuitDesign>, expectedVersion?: number): Promise<CircuitDesignRow | undefined>;
  deleteCircuitDesign(id: number): Promise<CircuitDesignRow | undefined>;

  // Circuit instances
  getCircuitInstances(circuitId: number): Promise<CircuitInstanceRow[]>;
  getCircuitInstance(id: number): Promise<CircuitInstanceRow | undefined>;
  createCircuitInstance(data: InsertCircuitInstance): Promise<CircuitInstanceRow>;
  updateCircuitInstance(id: number, data: Partial<InsertCircuitInstance>): Promise<CircuitInstanceRow | undefined>;
  deleteCircuitInstance(id: number): Promise<CircuitInstanceRow | undefined>;

  // Circuit nets
  getCircuitNets(circuitId: number): Promise<CircuitNetRow[]>;
  getCircuitNet(id: number): Promise<CircuitNetRow | undefined>;
  createCircuitNet(data: InsertCircuitNet): Promise<CircuitNetRow>;
  updateCircuitNet(id: number, data: Partial<InsertCircuitNet>): Promise<CircuitNetRow | undefined>;
  deleteCircuitNet(id: number): Promise<CircuitNetRow | undefined>;

  // Circuit wires
  getCircuitWires(circuitId: number): Promise<CircuitWireRow[]>;
  getCircuitWire(id: number): Promise<CircuitWireRow | undefined>;
  createCircuitWire(data: InsertCircuitWire): Promise<CircuitWireRow>;
  updateCircuitWire(id: number, data: Partial<InsertCircuitWire>): Promise<CircuitWireRow | undefined>;
  deleteCircuitWire(id: number): Promise<CircuitWireRow | undefined>;

  // Circuit vias
  getCircuitVias(circuitId: number): Promise<CircuitViaRow[]>;
  getCircuitVia(id: number): Promise<CircuitViaRow | undefined>;
  createCircuitVia(data: InsertCircuitVia): Promise<CircuitViaRow>;
  createCircuitVias(data: InsertCircuitVia[]): Promise<CircuitViaRow[]>;
  updateCircuitVia(id: number, data: Partial<InsertCircuitVia>): Promise<CircuitViaRow | undefined>;
  deleteCircuitVia(id: number): Promise<CircuitViaRow | undefined>;

  // Simulation results
  getSimulationResults(circuitId: number): Promise<SimulationResultRow[]>;
  getSimulationResult(id: number): Promise<SimulationResultRow | undefined>;
  createSimulationResult(data: InsertSimulationResult): Promise<SimulationResultRow>;
  deleteSimulationResult(id: number): Promise<SimulationResultRow | undefined>;
  cleanupSimulationResults(circuitId: number, maxResults: number): Promise<number>;

  // Simulation scenarios
  getSimulationScenarios(circuitId: number): Promise<SimulationScenario[]>;
  getSimulationScenario(id: number): Promise<SimulationScenario | undefined>;
  createSimulationScenario(data: InsertSimulationScenario): Promise<SimulationScenario>;
  updateSimulationScenario(id: number, data: Partial<InsertSimulationScenario>): Promise<SimulationScenario | undefined>;
  deleteSimulationScenario(id: number): Promise<SimulationScenario | undefined>;

  // AI actions
  getAiActions(projectId: number): Promise<AiActionRow[]>;
  getAiActionsByMessage(chatMessageId: string): Promise<AiActionRow[]>;
  createAiAction(data: InsertAiAction): Promise<AiActionRow>;

  // Hierarchical sheet navigation
  getChildDesigns(parentDesignId: number): Promise<CircuitDesignRow[]>;
  getRootDesigns(projectId: number): Promise<CircuitDesignRow[]>;
  getHierarchicalPorts(designId: number): Promise<HierarchicalPortRow[]>;
  getHierarchicalPort(id: number): Promise<HierarchicalPortRow | undefined>;
  createHierarchicalPort(data: InsertHierarchicalPort): Promise<HierarchicalPortRow>;
  updateHierarchicalPort(id: number, data: Partial<InsertHierarchicalPort>): Promise<HierarchicalPortRow | undefined>;
  deleteHierarchicalPort(id: number): Promise<HierarchicalPortRow | undefined>;

  // Design preferences
  getDesignPreferences(projectId: number): Promise<DesignPreference[]>;
  upsertDesignPreference(data: InsertDesignPreference): Promise<DesignPreference>;
  deleteDesignPreference(id: number): Promise<boolean>;

  // SPICE model library
  getSpiceModels(opts?: { category?: string; search?: string; limit?: number; offset?: number }): Promise<{ models: SpiceModelRow[]; total: number }>;
  getSpiceModel(id: number): Promise<SpiceModelRow | undefined>;
  createSpiceModel(model: InsertSpiceModel): Promise<SpiceModelRow>;

  // BOM snapshots
  createBomSnapshot(projectId: number, label: string): Promise<BomSnapshot>;
  getBomSnapshots(projectId: number): Promise<BomSnapshot[]>;
  getBomSnapshot(id: number): Promise<BomSnapshot | undefined>;
  deleteBomSnapshot(id: number): Promise<boolean>;

  // Component lifecycle
  getComponentLifecycles(projectId: number): Promise<ComponentLifecycle[]>;
  getComponentLifecycle(id: number): Promise<ComponentLifecycle | undefined>;
  upsertComponentLifecycle(data: InsertComponentLifecycle): Promise<ComponentLifecycle>;
  deleteComponentLifecycle(id: number): Promise<boolean>;

  // Design snapshots
  getDesignSnapshots(projectId: number): Promise<DesignSnapshot[]>;
  getDesignSnapshot(id: number): Promise<DesignSnapshot | undefined>;
  createDesignSnapshot(data: InsertDesignSnapshot): Promise<DesignSnapshot>;
  deleteDesignSnapshot(id: number): Promise<boolean>;

  // Design comments
  getComments(projectId: number, filters?: { targetType?: string; targetId?: string; status?: string }): Promise<DesignComment[]>;
  getComment(id: number): Promise<DesignComment | undefined>;
  createComment(data: InsertDesignComment): Promise<DesignComment>;
  updateComment(id: number, data: { content?: string }): Promise<DesignComment | undefined>;
  updateCommentStatus(id: number, status: string, updatedBy?: number): Promise<DesignComment | undefined>;
  deleteComment(id: number): Promise<boolean>;

  // Arduino Workspace
  getArduinoWorkspaces(): Promise<ArduinoWorkspace[]>;
  getArduinoWorkspace(projectId: number): Promise<ArduinoWorkspace | undefined>;
  createArduinoWorkspace(data: InsertArduinoWorkspace): Promise<ArduinoWorkspace>;
  updateArduinoWorkspace(projectId: number, data: Partial<InsertArduinoWorkspace>): Promise<ArduinoWorkspace | undefined>;

  // Arduino Build Profiles
  getArduinoBuildProfiles(projectId: number): Promise<ArduinoBuildProfile[]>;
  getArduinoBuildProfile(id: number): Promise<ArduinoBuildProfile | undefined>;
  createArduinoBuildProfile(data: InsertArduinoBuildProfile): Promise<ArduinoBuildProfile>;
  updateArduinoBuildProfile(id: number, data: Partial<InsertArduinoBuildProfile>): Promise<ArduinoBuildProfile | undefined>;
  deleteArduinoBuildProfile(id: number): Promise<boolean>;

  // Arduino Jobs
  getArduinoJobs(projectId: number, limit?: number): Promise<ArduinoJob[]>;
  getArduinoJob(id: number): Promise<ArduinoJob | undefined>;
  createArduinoJob(data: InsertArduinoJob): Promise<ArduinoJob>;
  updateArduinoJob(id: number, data: Partial<InsertArduinoJob> & { finishedAt?: Date }): Promise<ArduinoJob | undefined>;

  // Arduino Serial Sessions
  getArduinoSerialSessions(projectId: number): Promise<ArduinoSerialSession[]>;
  getArduinoSerialSession(id: number): Promise<ArduinoSerialSession | undefined>;
  createArduinoSerialSession(data: InsertArduinoSerialSession): Promise<ArduinoSerialSession>;
  updateArduinoSerialSession(id: number, data: Partial<InsertArduinoSerialSession> & { endedAt?: Date }): Promise<ArduinoSerialSession | undefined>;

  // Arduino Sketch Files (Metadata)
  getArduinoSketchFiles(workspaceId: number): Promise<ArduinoSketchFile[]>;
  getArduinoSketchFile(id: number): Promise<ArduinoSketchFile | undefined>;
  upsertArduinoSketchFile(data: InsertArduinoSketchFile): Promise<ArduinoSketchFile>;
  deleteArduinoSketchFile(id: number): Promise<boolean>;

  // PCB Orders
  getOrders(projectId: number): Promise<PcbOrder[]>;
  getOrder(id: number): Promise<PcbOrder | undefined>;
  createOrder(data: InsertPcbOrder): Promise<PcbOrder>;
  updateOrder(id: number, data: Partial<InsertPcbOrder> & { submittedAt?: Date }): Promise<PcbOrder | undefined>;
  deleteOrder(id: number): Promise<boolean>;

  // PCB Zones
  getPcbZones(projectId: number): Promise<PcbZone[]>;
  getPcbZone(id: number): Promise<PcbZone | undefined>;
  createPcbZone(data: InsertPcbZone): Promise<PcbZone>;
  updatePcbZone(id: number, data: Partial<InsertPcbZone>): Promise<PcbZone | undefined>;
  deletePcbZone(id: number): Promise<boolean>;
}
