/**
 * Backend state management
 * Stores previous backend configuration to detect migrations
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { BackendConfig } from '../types/config';

interface BackendState {
  backend?: BackendConfig;
  lastUpdated?: string;
}

/**
 * Get the backend state file path
 * @param workingDir - Working directory
 * @returns Path to state file
 */
function getStateFilePath(workingDir: string): string {
  const stateDir = join(workingDir, '.terraflow');
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  return join(stateDir, 'state.json');
}

/**
 * Load previous backend state
 * @param workingDir - Working directory
 * @returns Previous backend configuration or null
 */
export function loadBackendState(workingDir: string): BackendConfig | null {
  const statePath = getStateFilePath(workingDir);
  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const stateContent = readFileSync(statePath, 'utf8');
    const state: BackendState = JSON.parse(stateContent);
    return state.backend || null;
  } catch (error) {
    // If state file is invalid, treat as no previous state
    return null;
  }
}

/**
 * Save backend state
 * @param workingDir - Working directory
 * @param backend - Backend configuration to save
 */
export function saveBackendState(workingDir: string, backend: BackendConfig): void {
  const statePath = getStateFilePath(workingDir);
  const state: BackendState = {
    backend,
    lastUpdated: new Date().toISOString(),
  };
  writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Detect if backend has changed
 * @param workingDir - Working directory
 * @param currentBackend - Current backend configuration
 * @returns Previous backend type if changed, null otherwise
 */
export function detectBackendMigration(
  workingDir: string,
  currentBackend: BackendConfig
): string | null {
  const previousBackend = loadBackendState(workingDir);
  if (!previousBackend) {
    // No previous state, this is first run
    return null;
  }

  // Compare backend types
  if (previousBackend.type !== currentBackend.type) {
    return previousBackend.type;
  }

  // Backend types are the same, but config might have changed
  // For now, we only detect type changes
  return null;
}
