import { db } from './db';
import { cache } from './cache';
import { ProjectStorage } from './storage/projects';
import { ArchitectureStorage } from './storage/architecture';
import { BomStorage } from './storage/bom';
import { ValidationStorage } from './storage/validation';
import { ChatStorage } from './storage/chat';
import { ComponentStorage } from './storage/components';
import { CircuitStorage } from './storage/circuit';
import { ArduinoStorage } from './storage/arduino';
import { MiscStorage } from './storage/misc';
import { OrderingStorage } from './storage/ordering';
import { PartsStorage } from './storage/parts';
import type { StorageDeps } from './storage/types';

// Re-export public API — callers continue importing from './storage'
export { StorageError, VersionConflictError } from './storage/errors';
export type { PaginationOptions, IStorage } from './storage/interfaces';

const deps: StorageDeps = { db, cache };

export class DatabaseStorage {
  private _projects = new ProjectStorage(deps);
  private _architecture = new ArchitectureStorage(deps);
  private _bom = new BomStorage(deps);
  private _validation = new ValidationStorage(deps);
  private _chat = new ChatStorage(deps);
  private _components = new ComponentStorage(deps);
  private _circuit = new CircuitStorage(deps);
  private _arduino = new ArduinoStorage(deps);
  private _misc = new MiscStorage(deps);
  private _ordering = new OrderingStorage(deps);

  // --- Projects ---
  getProjects = this._projects.getProjects.bind(this._projects);
  getProject = this._projects.getProject.bind(this._projects);
  getProjectsByOwner = this._projects.getProjectsByOwner.bind(this._projects);
  isProjectOwner = this._projects.isProjectOwner.bind(this._projects);
  getProjectMembers = this._projects.getProjectMembers.bind(this._projects);
  addProjectMember = this._projects.addProjectMember.bind(this._projects);
  updateProjectMember = this._projects.updateProjectMember.bind(this._projects);
  removeProjectMember = this._projects.removeProjectMember.bind(this._projects);
  createProject = this._projects.createProject.bind(this._projects);
  updateProject = this._projects.updateProject.bind(this._projects);
  deleteProject = this._projects.deleteProject.bind(this._projects);

  // --- Architecture (Nodes + Edges) ---
  getNodes = this._architecture.getNodes.bind(this._architecture);
  createNode = this._architecture.createNode.bind(this._architecture);
  updateNode = this._architecture.updateNode.bind(this._architecture);
  deleteNodesByProject = this._architecture.deleteNodesByProject.bind(this._architecture);
  bulkCreateNodes = this._architecture.bulkCreateNodes.bind(this._architecture);
  getEdges = this._architecture.getEdges.bind(this._architecture);
  createEdge = this._architecture.createEdge.bind(this._architecture);
  updateEdge = this._architecture.updateEdge.bind(this._architecture);
  deleteEdgesByProject = this._architecture.deleteEdgesByProject.bind(this._architecture);
  bulkCreateEdges = this._architecture.bulkCreateEdges.bind(this._architecture);
  replaceNodes = this._architecture.replaceNodes.bind(this._architecture);
  replaceEdges = this._architecture.replaceEdges.bind(this._architecture);

  // --- BOM ---
  getBomItems = this._bom.getBomItems.bind(this._bom);
  getBomItem = this._bom.getBomItem.bind(this._bom);
  createBomItem = this._bom.createBomItem.bind(this._bom);
  updateBomItem = this._bom.updateBomItem.bind(this._bom);
  deleteBomItem = this._bom.deleteBomItem.bind(this._bom);
  getLowStockItems = this._bom.getLowStockItems.bind(this._bom);
  getStorageLocations = this._bom.getStorageLocations.bind(this._bom);
  createBomSnapshot = this._bom.createBomSnapshot.bind(this._bom);
  getBomSnapshots = this._bom.getBomSnapshots.bind(this._bom);
  getBomSnapshot = this._bom.getBomSnapshot.bind(this._bom);
  deleteBomSnapshot = this._bom.deleteBomSnapshot.bind(this._bom);

  // --- Validation ---
  getValidationIssues = this._validation.getValidationIssues.bind(this._validation);
  createValidationIssue = this._validation.createValidationIssue.bind(this._validation);
  deleteValidationIssue = this._validation.deleteValidationIssue.bind(this._validation);
  deleteValidationIssuesByProject = this._validation.deleteValidationIssuesByProject.bind(this._validation);
  bulkCreateValidationIssues = this._validation.bulkCreateValidationIssues.bind(this._validation);
  replaceValidationIssues = this._validation.replaceValidationIssues.bind(this._validation);

  // --- Chat ---
  getChatMessages = this._chat.getChatMessages.bind(this._chat);
  createChatMessage = this._chat.createChatMessage.bind(this._chat);
  deleteChatMessages = this._chat.deleteChatMessages.bind(this._chat);
  deleteChatMessage = this._chat.deleteChatMessage.bind(this._chat);
  createChatBranch = this._chat.createChatBranch.bind(this._chat);
  getChatBranches = this._chat.getChatBranches.bind(this._chat);

  // --- Components + Library + Chat Settings ---
  getComponentParts = this._components.getComponentParts.bind(this._components);
  getComponentPart = this._components.getComponentPart.bind(this._components);
  getComponentPartByNodeId = this._components.getComponentPartByNodeId.bind(this._components);
  createComponentPart = this._components.createComponentPart.bind(this._components);
  updateComponentPart = this._components.updateComponentPart.bind(this._components);
  deleteComponentPart = this._components.deleteComponentPart.bind(this._components);
  getLibraryEntries = this._components.getLibraryEntries.bind(this._components);
  getLibraryEntry = this._components.getLibraryEntry.bind(this._components);
  createLibraryEntry = this._components.createLibraryEntry.bind(this._components);
  updateLibraryEntry = this._components.updateLibraryEntry.bind(this._components);
  deleteLibraryEntry = this._components.deleteLibraryEntry.bind(this._components);
  incrementLibraryDownloads = this._components.incrementLibraryDownloads.bind(this._components);
  getChatSettings = this._components.getChatSettings.bind(this._components);
  upsertChatSettings = this._components.upsertChatSettings.bind(this._components);

  // --- Circuit ---
  getCircuitDesigns = this._circuit.getCircuitDesigns.bind(this._circuit);
  getCircuitDesign = this._circuit.getCircuitDesign.bind(this._circuit);
  createCircuitDesign = this._circuit.createCircuitDesign.bind(this._circuit);
  updateCircuitDesign = this._circuit.updateCircuitDesign.bind(this._circuit);
  deleteCircuitDesign = this._circuit.deleteCircuitDesign.bind(this._circuit);
  getCircuitInstances = this._circuit.getCircuitInstances.bind(this._circuit);
  getCircuitInstance = this._circuit.getCircuitInstance.bind(this._circuit);
  createCircuitInstance = this._circuit.createCircuitInstance.bind(this._circuit);
  updateCircuitInstance = this._circuit.updateCircuitInstance.bind(this._circuit);
  deleteCircuitInstance = this._circuit.deleteCircuitInstance.bind(this._circuit);
  getCircuitNets = this._circuit.getCircuitNets.bind(this._circuit);
  getCircuitNet = this._circuit.getCircuitNet.bind(this._circuit);
  createCircuitNet = this._circuit.createCircuitNet.bind(this._circuit);
  updateCircuitNet = this._circuit.updateCircuitNet.bind(this._circuit);
  deleteCircuitNet = this._circuit.deleteCircuitNet.bind(this._circuit);
  getCircuitWires = this._circuit.getCircuitWires.bind(this._circuit);
  getCircuitWire = this._circuit.getCircuitWire.bind(this._circuit);
  createCircuitWire = this._circuit.createCircuitWire.bind(this._circuit);
  updateCircuitWire = this._circuit.updateCircuitWire.bind(this._circuit);
  deleteCircuitWire = this._circuit.deleteCircuitWire.bind(this._circuit);
  getCircuitVias = this._circuit.getCircuitVias.bind(this._circuit);
  getCircuitVia = this._circuit.getCircuitVia.bind(this._circuit);
  createCircuitVia = this._circuit.createCircuitVia.bind(this._circuit);
  createCircuitVias = this._circuit.createCircuitVias.bind(this._circuit);
  updateCircuitVia = this._circuit.updateCircuitVia.bind(this._circuit);
  deleteCircuitVia = this._circuit.deleteCircuitVia.bind(this._circuit);
  getSimulationResults = this._circuit.getSimulationResults.bind(this._circuit);
  getSimulationResult = this._circuit.getSimulationResult.bind(this._circuit);
  createSimulationResult = this._circuit.createSimulationResult.bind(this._circuit);
  deleteSimulationResult = this._circuit.deleteSimulationResult.bind(this._circuit);
  cleanupSimulationResults = this._circuit.cleanupSimulationResults.bind(this._circuit);
  getSimulationScenarios = this._circuit.getSimulationScenarios.bind(this._circuit);
  getSimulationScenario = this._circuit.getSimulationScenario.bind(this._circuit);
  createSimulationScenario = this._circuit.createSimulationScenario.bind(this._circuit);
  updateSimulationScenario = this._circuit.updateSimulationScenario.bind(this._circuit);
  deleteSimulationScenario = this._circuit.deleteSimulationScenario.bind(this._circuit);
  getRootDesigns = this._circuit.getRootDesigns.bind(this._circuit);
  getChildDesigns = this._circuit.getChildDesigns.bind(this._circuit);
  getHierarchicalPorts = this._circuit.getHierarchicalPorts.bind(this._circuit);
  getHierarchicalPort = this._circuit.getHierarchicalPort.bind(this._circuit);
  createHierarchicalPort = this._circuit.createHierarchicalPort.bind(this._circuit);
  updateHierarchicalPort = this._circuit.updateHierarchicalPort.bind(this._circuit);
  deleteHierarchicalPort = this._circuit.deleteHierarchicalPort.bind(this._circuit);

  // --- Misc (History, AI Actions, Preferences, SPICE, Lifecycle, Snapshots, Comments) ---
  getHistoryItems = this._misc.getHistoryItems.bind(this._misc);
  createHistoryItem = this._misc.createHistoryItem.bind(this._misc);
  deleteHistoryItems = this._misc.deleteHistoryItems.bind(this._misc);
  deleteHistoryItem = this._misc.deleteHistoryItem.bind(this._misc);
  getAiActions = this._misc.getAiActions.bind(this._misc);
  getAiActionsByMessage = this._misc.getAiActionsByMessage.bind(this._misc);
  createAiAction = this._misc.createAiAction.bind(this._misc);
  getDesignPreferences = this._misc.getDesignPreferences.bind(this._misc);
  upsertDesignPreference = this._misc.upsertDesignPreference.bind(this._misc);
  deleteDesignPreference = this._misc.deleteDesignPreference.bind(this._misc);
  getSpiceModels = this._misc.getSpiceModels.bind(this._misc);
  getSpiceModel = this._misc.getSpiceModel.bind(this._misc);
  createSpiceModel = this._misc.createSpiceModel.bind(this._misc);
  getComponentLifecycles = this._misc.getComponentLifecycles.bind(this._misc);
  getComponentLifecycle = this._misc.getComponentLifecycle.bind(this._misc);
  upsertComponentLifecycle = this._misc.upsertComponentLifecycle.bind(this._misc);
  deleteComponentLifecycle = this._misc.deleteComponentLifecycle.bind(this._misc);
  getDesignSnapshots = this._misc.getDesignSnapshots.bind(this._misc);
  getDesignSnapshot = this._misc.getDesignSnapshot.bind(this._misc);
  createDesignSnapshot = this._misc.createDesignSnapshot.bind(this._misc);
  deleteDesignSnapshot = this._misc.deleteDesignSnapshot.bind(this._misc);
  getComments = this._misc.getComments.bind(this._misc);
  getComment = this._misc.getComment.bind(this._misc);
  createComment = this._misc.createComment.bind(this._misc);
  updateComment = this._misc.updateComment.bind(this._misc);
  updateCommentStatus = this._misc.updateCommentStatus.bind(this._misc);
  deleteComment = this._misc.deleteComment.bind(this._misc);

  // --- PCB Orders ---
  getOrders = this._ordering.getOrders.bind(this._ordering);
  getOrder = this._ordering.getOrder.bind(this._ordering);
  createOrder = this._ordering.createOrder.bind(this._ordering);
  updateOrder = this._ordering.updateOrder.bind(this._ordering);
  deleteOrder = this._ordering.deleteOrder.bind(this._ordering);

  // PCB Zones
  getPcbZones = this._circuit.getPcbZones.bind(this._circuit);
  getPcbZone = this._circuit.getPcbZone.bind(this._circuit);
  createPcbZone = this._circuit.createPcbZone.bind(this._circuit);
  updatePcbZone = this._circuit.updatePcbZone.bind(this._circuit);
  deletePcbZone = this._circuit.deletePcbZone.bind(this._circuit);

  // --- Arduino Workbench ---
  getArduinoWorkspaces = this._arduino.getArduinoWorkspaces.bind(this._arduino);
  getArduinoWorkspace = this._arduino.getArduinoWorkspace.bind(this._arduino);
  createArduinoWorkspace = this._arduino.createArduinoWorkspace.bind(this._arduino);
  updateArduinoWorkspace = this._arduino.updateArduinoWorkspace.bind(this._arduino);
  getArduinoBuildProfiles = this._arduino.getArduinoBuildProfiles.bind(this._arduino);
  getArduinoBuildProfile = this._arduino.getArduinoBuildProfile.bind(this._arduino);
  createArduinoBuildProfile = this._arduino.createArduinoBuildProfile.bind(this._arduino);
  updateArduinoBuildProfile = this._arduino.updateArduinoBuildProfile.bind(this._arduino);
  deleteArduinoBuildProfile = this._arduino.deleteArduinoBuildProfile.bind(this._arduino);
  getArduinoJobs = this._arduino.getArduinoJobs.bind(this._arduino);
  getArduinoJob = this._arduino.getArduinoJob.bind(this._arduino);
  createArduinoJob = this._arduino.createArduinoJob.bind(this._arduino);
  updateArduinoJob = this._arduino.updateArduinoJob.bind(this._arduino);
  getArduinoSerialSessions = this._arduino.getArduinoSerialSessions.bind(this._arduino);
  getArduinoSerialSession = this._arduino.getArduinoSerialSession.bind(this._arduino);
  createArduinoSerialSession = this._arduino.createArduinoSerialSession.bind(this._arduino);
  updateArduinoSerialSession = this._arduino.updateArduinoSerialSession.bind(this._arduino);
  getArduinoSketchFiles = this._arduino.getArduinoSketchFiles.bind(this._arduino);
  getArduinoSketchFile = this._arduino.getArduinoSketchFile.bind(this._arduino);
  upsertArduinoSketchFile = this._arduino.upsertArduinoSketchFile.bind(this._arduino);
  deleteArduinoSketchFile = this._arduino.deleteArduinoSketchFile.bind(this._arduino);
}

export const storage = new DatabaseStorage();

// Standalone parts catalog singleton — exposed alongside `storage` for callers
// that work directly with the canonical Phase 3 read/write surface without
// going through DatabaseStorage's bound-method layer. See ADR 0010 and
// docs/plans/2026-04-10-parts-catalog-consolidation.md Phase 3.
export const partsStorage = new PartsStorage({ db, cache });
