/**
 * Document Lock Service
 * 
 * Manages document locks to prevent concurrent editing conflicts.
 * Uses Supabase for persistence and provides real-time lock status.
 */

import { supabase } from "@/lib/supabaseClient";

export type LockType = "edit" | "signature" | "exclusive";

export interface DocumentLock {
  id: string;
  documentPath: string;
  baseId: string;
  lockedBy: string;
  lockedAt: Date;
  expiresAt: Date;
  lockType: LockType;
  metadata?: Record<string, unknown>;
}

export interface LockAcquisitionResult {
  success: boolean;
  lockId?: string;
  message: string;
  existingLockUser?: string;
  existingLockExpires?: Date;
}

export interface LockStatus {
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: Date;
  expiresAt?: Date;
  lockType?: LockType;
  timeRemaining?: number; // in seconds
}

/**
 * Document Lock Service
 */
export class DocumentLockService {
  private static refreshInterval: number | null = null;
  private static activeLocks: Map<string, string> = new Map(); // path -> lockId

  /**
   * Acquire a lock on a document
   */
  static async acquireLock(
    documentPath: string,
    baseId: string,
    lockType: LockType = "edit",
    durationMinutes: number = 30
  ): Promise<LockAcquisitionResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          success: false,
          message: "User not authenticated",
        };
      }

      // Call the database function
      const { data, error } = await supabase.rpc("acquire_document_lock", {
        p_document_path: documentPath,
        p_base_id: baseId,
        p_user_id: user.id,
        p_lock_type: lockType,
        p_duration_minutes: durationMinutes,
      });

      if (error) {
        console.error("Failed to acquire lock:", error);
        return {
          success: false,
          message: error.message || "Failed to acquire lock",
        };
      }

      const result = data?.[0];
      if (!result) {
        return {
          success: false,
          message: "No response from lock function",
        };
      }

      if (result.success) {
        // Track the lock locally
        this.activeLocks.set(documentPath, result.lock_id);
        
        // Start auto-refresh if not already running
        this.startAutoRefresh(documentPath, baseId, lockType, durationMinutes);
      }

      return {
        success: result.success,
        lockId: result.lock_id,
        message: result.message,
        existingLockUser: result.existing_lock_user,
        existingLockExpires: result.existing_lock_expires 
          ? new Date(result.existing_lock_expires) 
          : undefined,
      };
    } catch (e) {
      console.error("Lock acquisition error:", e);
      return {
        success: false,
        message: e instanceof Error ? e.message : "Unknown error",
      };
    }
  }

  /**
   * Release a lock on a document
   */
  static async releaseLock(
    documentPath: string,
    baseId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, message: "User not authenticated" };
      }

      const { data, error } = await supabase.rpc("release_document_lock", {
        p_document_path: documentPath,
        p_base_id: baseId,
        p_user_id: user.id,
      });

      if (error) {
        console.error("Failed to release lock:", error);
        return { success: false, message: error.message };
      }

      const result = data?.[0];
      
      // Remove from local tracking
      this.activeLocks.delete(documentPath);
      
      // Stop auto-refresh if no more locks
      if (this.activeLocks.size === 0) {
        this.stopAutoRefresh();
      }

      return {
        success: result?.success || false,
        message: result?.message || "Lock released",
      };
    } catch (e) {
      console.error("Lock release error:", e);
      return {
        success: false,
        message: e instanceof Error ? e.message : "Unknown error",
      };
    }
  }

  /**
   * Check lock status for a document
   */
  static async checkLockStatus(
    documentPath: string,
    baseId: string
  ): Promise<LockStatus> {
    try {
      const { data, error } = await supabase.rpc("check_document_lock", {
        p_document_path: documentPath,
        p_base_id: baseId,
      });

      if (error) {
        console.error("Failed to check lock:", error);
        return { isLocked: false };
      }

      const result = data?.[0];
      if (!result || !result.is_locked) {
        return { isLocked: false };
      }

      return {
        isLocked: true,
        lockedBy: result.locked_by,
        lockedAt: result.locked_at ? new Date(result.locked_at) : undefined,
        expiresAt: result.expires_at ? new Date(result.expires_at) : undefined,
        lockType: result.lock_type as LockType,
        timeRemaining: result.time_remaining 
          ? this.parseInterval(result.time_remaining) 
          : undefined,
      };
    } catch (e) {
      console.error("Lock status check error:", e);
      return { isLocked: false };
    }
  }

  /**
   * Force release a lock (admin only)
   */
  static async forceReleaseLock(
    documentPath: string,
    baseId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, message: "User not authenticated" };
      }

      const { data, error } = await supabase.rpc("force_release_document_lock", {
        p_document_path: documentPath,
        p_base_id: baseId,
        p_admin_user_id: user.id,
      });

      if (error) {
        console.error("Failed to force release lock:", error);
        return { success: false, message: error.message };
      }

      const result = data?.[0];
      return {
        success: result?.success || false,
        message: result?.message || "Lock force released",
      };
    } catch (e) {
      console.error("Force release error:", e);
      return {
        success: false,
        message: e instanceof Error ? e.message : "Unknown error",
      };
    }
  }

  /**
   * Get user info for a lock holder
   */
  static async getLockHolderInfo(userId: string): Promise<{
    name: string;
    email: string;
  } | null> {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", userId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        name: data.display_name || "Unknown User",
        email: data.email || "",
      };
    } catch (e) {
      console.error("Failed to get lock holder info:", e);
      return null;
    }
  }

  /**
   * Subscribe to lock changes for a document
   */
  static subscribeLockChanges(
    documentPath: string,
    baseId: string,
    callback: (status: LockStatus) => void
  ): () => void {
    // Initial check
    this.checkLockStatus(documentPath, baseId).then(callback);

    // Set up realtime subscription
    const channel = supabase
      .channel(`document-lock:${documentPath}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "document_locks",
          filter: `document_path=eq.${documentPath}`,
        },
        async () => {
          const status = await this.checkLockStatus(documentPath, baseId);
          callback(status);
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Start auto-refresh for active locks
   */
  private static startAutoRefresh(
    documentPath: string,
    baseId: string,
    lockType: LockType,
    durationMinutes: number
  ) {
    if (this.refreshInterval) return;

    // Refresh locks every 5 minutes (before they expire)
    const refreshMs = Math.min(durationMinutes * 60 * 1000 * 0.5, 5 * 60 * 1000);
    
    this.refreshInterval = window.setInterval(async () => {
      for (const [path, _lockId] of this.activeLocks) {
        await this.acquireLock(path, baseId, lockType, durationMinutes);
      }
    }, refreshMs);
  }

  /**
   * Stop auto-refresh
   */
  private static stopAutoRefresh() {
    if (this.refreshInterval) {
      window.clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Release all locks held by current user (call on page unload)
   */
  static async releaseAllLocks(baseId: string): Promise<void> {
    const promises = Array.from(this.activeLocks.keys()).map(path =>
      this.releaseLock(path, baseId)
    );
    await Promise.all(promises);
    this.stopAutoRefresh();
  }

  /**
   * Parse PostgreSQL interval to seconds
   */
  private static parseInterval(interval: string): number {
    // Simple parsing for intervals like "00:29:45.123456"
    const match = interval.match(/(\d+):(\d+):(\d+)/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseInt(match[3], 10);
      return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
  }
}

/**
 * React hook for document locking (use in components)
 */
export function useDocumentLock(
  documentPath: string | null,
  baseId: string | null,
  autoAcquire: boolean = false
) {
  // This would be a proper React hook implementation
  // For now, returning the service methods
  return {
    acquireLock: async (lockType?: LockType, duration?: number) => {
      if (!documentPath || !baseId) {
        return { success: false, message: "Missing path or baseId" };
      }
      return DocumentLockService.acquireLock(documentPath, baseId, lockType, duration);
    },
    releaseLock: async () => {
      if (!documentPath || !baseId) {
        return { success: false, message: "Missing path or baseId" };
      }
      return DocumentLockService.releaseLock(documentPath, baseId);
    },
    checkStatus: async () => {
      if (!documentPath || !baseId) {
        return { isLocked: false };
      }
      return DocumentLockService.checkLockStatus(documentPath, baseId);
    },
  };
}

export default DocumentLockService;

