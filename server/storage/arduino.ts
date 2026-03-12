import { eq, and, desc, asc } from 'drizzle-orm';
import {
  arduinoWorkspaces, type ArduinoWorkspace, type InsertArduinoWorkspace,
  arduinoBuildProfiles, type ArduinoBuildProfile, type InsertArduinoBuildProfile,
  arduinoJobs, type ArduinoJob, type InsertArduinoJob,
  arduinoSerialSessions, type ArduinoSerialSession, type InsertArduinoSerialSession,
  arduinoSketchFiles, type ArduinoSketchFile, type InsertArduinoSketchFile,
} from '@shared/schema';
import { StorageError } from './errors';
import type { StorageDeps } from './types';

export class ArduinoStorage {
  constructor(private deps: StorageDeps) {}

  private get db() { return this.deps.db; }

  // --- Arduino Workspace ---

  async getArduinoWorkspaces(): Promise<ArduinoWorkspace[]> {
    try {
      return await this.db.select().from(arduinoWorkspaces);
    } catch (e) {
      throw new StorageError('getArduinoWorkspaces', 'arduino-workspaces', e);
    }
  }

  async getArduinoWorkspace(projectId: number): Promise<ArduinoWorkspace | undefined> {
    try {
      const [workspace] = await this.db.select().from(arduinoWorkspaces)
        .where(eq(arduinoWorkspaces.projectId, projectId));
      return workspace;
    } catch (e) {
      throw new StorageError('getArduinoWorkspace', `projects/${projectId}/arduino/workspace`, e);
    }
  }

  async createArduinoWorkspace(data: InsertArduinoWorkspace): Promise<ArduinoWorkspace> {
    try {
      const [created] = await this.db.insert(arduinoWorkspaces).values(data).returning();
      return created;
    } catch (e) {
      throw new StorageError('createArduinoWorkspace', 'arduino-workspaces', e);
    }
  }

  async updateArduinoWorkspace(projectId: number, data: Partial<InsertArduinoWorkspace>): Promise<ArduinoWorkspace | undefined> {
    try {
      const [updated] = await this.db.update(arduinoWorkspaces)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(arduinoWorkspaces.projectId, projectId))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateArduinoWorkspace', `projects/${projectId}/arduino/workspace`, e);
    }
  }

  // --- Arduino Build Profiles ---

  async getArduinoBuildProfiles(projectId: number): Promise<ArduinoBuildProfile[]> {
    try {
      return await this.db.select().from(arduinoBuildProfiles)
        .where(eq(arduinoBuildProfiles.projectId, projectId))
        .orderBy(asc(arduinoBuildProfiles.name));
    } catch (e) {
      throw new StorageError('getArduinoBuildProfiles', `projects/${projectId}/arduino/profiles`, e);
    }
  }

  async getArduinoBuildProfile(id: number): Promise<ArduinoBuildProfile | undefined> {
    try {
      const [profile] = await this.db.select().from(arduinoBuildProfiles)
        .where(eq(arduinoBuildProfiles.id, id));
      return profile;
    } catch (e) {
      throw new StorageError('getArduinoBuildProfile', `arduino-profiles/${id}`, e);
    }
  }

  async createArduinoBuildProfile(data: InsertArduinoBuildProfile): Promise<ArduinoBuildProfile> {
    try {
      const [created] = await this.db.insert(arduinoBuildProfiles).values(data).returning();
      return created;
    } catch (e) {
      throw new StorageError('createArduinoBuildProfile', 'arduino-profiles', e);
    }
  }

  async updateArduinoBuildProfile(id: number, data: Partial<InsertArduinoBuildProfile>): Promise<ArduinoBuildProfile | undefined> {
    try {
      const [updated] = await this.db.update(arduinoBuildProfiles)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(arduinoBuildProfiles.id, id))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateArduinoBuildProfile', `arduino-profiles/${id}`, e);
    }
  }

  async deleteArduinoBuildProfile(id: number): Promise<boolean> {
    try {
      const result = await this.db.delete(arduinoBuildProfiles)
        .where(eq(arduinoBuildProfiles.id, id))
        .returning();
      return result.length > 0;
    } catch (e) {
      throw new StorageError('deleteArduinoBuildProfile', `arduino-profiles/${id}`, e);
    }
  }

  // --- Arduino Jobs ---

  async getArduinoJobs(projectId: number, limit: number = 20): Promise<ArduinoJob[]> {
    try {
      return await this.db.select().from(arduinoJobs)
        .where(eq(arduinoJobs.projectId, projectId))
        .orderBy(desc(arduinoJobs.createdAt))
        .limit(limit);
    } catch (e) {
      throw new StorageError('getArduinoJobs', `projects/${projectId}/arduino/jobs`, e);
    }
  }

  async getArduinoJob(id: number): Promise<ArduinoJob | undefined> {
    try {
      const [job] = await this.db.select().from(arduinoJobs)
        .where(eq(arduinoJobs.id, id));
      return job;
    } catch (e) {
      throw new StorageError('getArduinoJob', `arduino-jobs/${id}`, e);
    }
  }

  async createArduinoJob(data: InsertArduinoJob): Promise<ArduinoJob> {
    try {
      const [created] = await this.db.insert(arduinoJobs).values(data).returning();
      return created;
    } catch (e) {
      throw new StorageError('createArduinoJob', 'arduino-jobs', e);
    }
  }

  async updateArduinoJob(id: number, data: Partial<InsertArduinoJob> & { finishedAt?: Date }): Promise<ArduinoJob | undefined> {
    try {
      const [updated] = await this.db.update(arduinoJobs)
        .set(data)
        .where(eq(arduinoJobs.id, id))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateArduinoJob', `arduino-jobs/${id}`, e);
    }
  }

  // --- Arduino Serial Sessions ---

  async getArduinoSerialSessions(projectId: number): Promise<ArduinoSerialSession[]> {
    try {
      return await this.db.select().from(arduinoSerialSessions)
        .where(eq(arduinoSerialSessions.projectId, projectId))
        .orderBy(desc(arduinoSerialSessions.startedAt));
    } catch (e) {
      throw new StorageError('getArduinoSerialSessions', `projects/${projectId}/arduino/serial`, e);
    }
  }

  async getArduinoSerialSession(id: number): Promise<ArduinoSerialSession | undefined> {
    try {
      const [session] = await this.db.select().from(arduinoSerialSessions)
        .where(eq(arduinoSerialSessions.id, id));
      return session;
    } catch (e) {
      throw new StorageError('getArduinoSerialSession', `arduino-serial/${id}`, e);
    }
  }

  async createArduinoSerialSession(data: InsertArduinoSerialSession): Promise<ArduinoSerialSession> {
    try {
      const [created] = await this.db.insert(arduinoSerialSessions).values(data).returning();
      return created;
    } catch (e) {
      throw new StorageError('createArduinoSerialSession', 'arduino-serial', e);
    }
  }

  async updateArduinoSerialSession(id: number, data: Partial<InsertArduinoSerialSession> & { endedAt?: Date }): Promise<ArduinoSerialSession | undefined> {
    try {
      const [updated] = await this.db.update(arduinoSerialSessions)
        .set(data)
        .where(eq(arduinoSerialSessions.id, id))
        .returning();
      return updated;
    } catch (e) {
      throw new StorageError('updateArduinoSerialSession', `arduino-serial/${id}`, e);
    }
  }

  // --- Arduino Sketch Files (Metadata) ---

  async getArduinoSketchFile(id: number): Promise<ArduinoSketchFile | undefined> {
    try {
      const [file] = await this.db.select().from(arduinoSketchFiles)
        .where(eq(arduinoSketchFiles.id, id));
      return file;
    } catch (e) {
      throw new StorageError('getArduinoSketchFile', `arduino-sketch-files/${id}`, e);
    }
  }

  async getArduinoSketchFiles(workspaceId: number): Promise<ArduinoSketchFile[]> {
    try {
      return await this.db.select().from(arduinoSketchFiles)
        .where(eq(arduinoSketchFiles.workspaceId, workspaceId))
        .orderBy(asc(arduinoSketchFiles.relativePath));
    } catch (e) {
      throw new StorageError('getArduinoSketchFiles', `arduino-workspaces/${workspaceId}/files`, e);
    }
  }

  async upsertArduinoSketchFile(data: InsertArduinoSketchFile): Promise<ArduinoSketchFile> {
    try {
      const [upserted] = await this.db.insert(arduinoSketchFiles)
        .values(data)
        .onConflictDoUpdate({
          target: [arduinoSketchFiles.workspaceId, arduinoSketchFiles.relativePath],
          set: {
            language: data.language,
            sizeBytes: data.sizeBytes,
            updatedAt: new Date(),
          },
        })
        .returning();
      return upserted;
    } catch (e) {
      throw new StorageError('upsertArduinoSketchFile', 'arduino-sketch-files', e);
    }
  }

  async deleteArduinoSketchFile(id: number): Promise<boolean> {
    try {
      const result = await this.db.delete(arduinoSketchFiles)
        .where(eq(arduinoSketchFiles.id, id))
        .returning();
      return result.length > 0;
    } catch (e) {
      throw new StorageError('deleteArduinoSketchFile', `arduino-sketch-files/${id}`, e);
    }
  }
}
