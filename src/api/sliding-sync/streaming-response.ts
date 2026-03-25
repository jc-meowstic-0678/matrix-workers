// src/api/sliding-sync/streaming-response.ts
import { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { OptimizedSlidingSyncHandler } from './optimized-sync';
import { SlidingSyncMonitor } from './performance-monitor';

// ============================================
// Type Definitions
// ============================================

interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
}

interface StreamingRequest {
  lists?: Record<string, ListConfig>;
  extensions?: ExtensionsConfig;
  pos?: string;
  timeout?: number;
}

interface ListConfig {
  ranges?: [number, number][];
  sort?: string[];
  required_state?: [string, string][];
  timeline_limit?: number;
  filters?: any;
  room_subscription?: any;
}

interface ExtensionsConfig {
  to_device?: { enabled?: boolean; since?: string; limit?: number };
  e2ee?: { enabled?: boolean };
  account_data?: { enabled?: boolean; rooms?: string[] };
  typing?: { enabled?: boolean; rooms?: string[] };
  receipts?: { enabled?: boolean; rooms?: string[] };
  presence?: { enabled?: boolean };
}

interface ListResult {
  count: number;
  ops?: any[];
  rooms?: Record<string, any>;
}

interface StreamingChunk {
  type: 'initial' | 'list_update' | 'extension' | 'complete' | 'error' | 'heartbeat';
  [key: string]: any;
}

// ============================================
// Main Streaming Handler
// ============================================

export class StreamingSlidingSyncHandler {
  private syncHandler: OptimizedSlidingSyncHandler;
  private monitor: SlidingSyncMonitor;
  private readonly HEARTBEAT_INTERVAL = 5000; // 5 seconds
  private readonly MAX_CHUNK_SIZE = 100 * 1024; // 100KB max per chunk
  private readonly STREAM_TIMEOUT = 60000; // 60 seconds

constructor(env: Env, syncHandler?: OptimizedSlidingSyncHandler) {
    this.syncHandler = syncHandler ?? new OptimizedSlidingSyncHandler(env);
    this.monitor = new SlidingSyncMonitor(env);
  }

  /**
   * Main entry point for streaming sliding sync requests
   */
  async handleSlidingSyncStreaming(
    request: Request,
    _userId: string,
    _deviceId: string,
  ): Promise<Response> {
    try {
      // Parse request
      const body = await this.parseRequest(request);
      const { lists = {}, extensions = {}, pos: _since } = body;
      const since = _since ?? null;
      
      // Validate request
      this.validateRequest(body);

      // Set up streaming response with proper headers
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Start processing in background (don't await)
      this.processSyncStreaming(_userId, lists, extensions, since, writer, encoder)
        .catch(error => {
          console.error('Streaming error:', error);
          this.sendErrorChunk(writer, encoder, error).catch(console.error);
        });

      // Return stream response
      return new Response(readable, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no', // Disable proxy buffering
        }
      });

    } catch (error) {
      console.error('Failed to initialize streaming:', error);
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      return Response.json({
        errcode: 'M_UNKNOWN',
        error: errMsg
      }, { status: 500 });
    }
  }

  /**
   * Parse request body, handling empty or invalid requests
   */
  private async parseRequest(request: Request): Promise<StreamingRequest> {
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      try {
        return await request.json();
      } catch (error) {
        throw new Error('Invalid JSON in request body');
      }
    }
    
    // Empty body is allowed (initial sync)
    return {};
  }

  /**
   * Validate request parameters
   */
  private validateRequest(body: StreamingRequest): void {
    const { timeout } = body;
    
    if (timeout && (timeout < 0 || timeout > this.STREAM_TIMEOUT)) {
      throw new Error(`Timeout must be between 0 and ${this.STREAM_TIMEOUT} ms`);
    }
  }

  /**
   * Main streaming processing logic
   */
  private async processSyncStreaming(
    userId: string,
    lists: Record<string, ListConfig>,
    extensions: ExtensionsConfig,
    since: string | null,
    writer: WritableStreamDefaultWriter,
    encoder: TextEncoder
  ): Promise<void> {
    const startTime = Date.now();
    let chunksSent = 0;
    let totalBytes = 0;

    try {
      // Send initial response immediately
      await this.sendInitialChunk(writer, encoder, since);
      chunksSent++;

      // Send heartbeat to keep connection alive
      const heartbeatInterval = setInterval(async () => {
        try {
          await this.sendHeartbeat(writer, encoder);
        } catch (error) {
          clearInterval(heartbeatInterval);
        }
      }, this.HEARTBEAT_INTERVAL);

      // Process and send lists progressively
      const listEntries = Object.entries(lists);
      for (const [listId, config] of listEntries) {
        // Process list with progress tracking
        const listResult = await this.processListWithProgress(userId, listId, config, since);
        
        // Send list update chunk
        const chunk: StreamingChunk = {
          type: 'list_update',
          list_id: listId,
          data: listResult
        };
        
        await this.sendChunk(writer, encoder, chunk);
        chunksSent++;
        
        // Small delay between lists to prevent overwhelming the client
        if (listEntries.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Process extensions if requested
      if (Object.keys(extensions).length > 0) {
        const extensionResults = await this.processExtensions(userId, extensions, since);
        
        for (const [extName, extData] of Object.entries(extensionResults)) {
          const chunk: StreamingChunk = {
            type: 'extension',
            extension: extName,
            data: extData
          };
          
          await this.sendChunk(writer, encoder, chunk);
          chunksSent++;
        }
      }

      // Clear heartbeat interval
      clearInterval(heartbeatInterval);

      // Send completion marker with next batch token
      await this.sendCompleteChunk(writer, encoder, userId);
      chunksSent++;

      // Track metrics
      const duration = Date.now() - startTime;
      await this.monitor.trackSyncDuration(userId, duration, Object.keys(lists).length);
      
      console.log(`Streaming sync completed for ${userId}:`, {
        chunks: chunksSent,
        bytes: totalBytes,
        duration: `${duration}ms`
      });

    } catch (error) {
      console.error('Stream processing failed:', error);
      await this.sendErrorChunk(writer, encoder, error);
    } finally {
      try {
        await writer.close();
      } catch (error) {
        console.error('Error closing writer:', error);
      }
    }
  }

  /**
   * Send initial response chunk
   */

  private async getCurrentStreamPosition(): Promise<number> {
    // Default to 0 if we can't get the position - streaming will still work
    return 0;
  }

  private async sendInitialChunk(
    writer: WritableStreamDefaultWriter,
    encoder: TextEncoder,
    _since: string | null
  ): Promise<void> {
    const currentPos = await this.getCurrentStreamPosition();
    const chunk: StreamingChunk = {
      type: 'initial',
      next_batch: `s${currentPos}`,
      timestamp: Date.now()
    };
    await this.sendChunk(writer, encoder, chunk);
  }

  /**
   * Send heartbeat to keep connection alive
   */
  private async sendHeartbeat(
    writer: WritableStreamDefaultWriter,
    encoder: TextEncoder
  ): Promise<void> {
    const chunk: StreamingChunk = {
      type: 'heartbeat',
      timestamp: Date.now()
    };
    
    await this.sendChunk(writer, encoder, chunk);
  }

  /**
   * Send completion chunk with next batch token
   */
  private async sendCompleteChunk(
    writer: WritableStreamDefaultWriter,
    encoder: TextEncoder,
    _userId: string
  ): Promise<void> {
    const currentPos = await this.getCurrentStreamPosition();   // ADD THIS
    const chunk: StreamingChunk = {
      type: 'complete',
      next_batch: `s${currentPos}`,
      timestamp: Date.now()
    };
    
    await this.sendChunk(writer, encoder, chunk);
  }

  /**
   * Send error chunk
   */
  private async sendErrorChunk(
    writer: WritableStreamDefaultWriter,
    encoder: TextEncoder,
    error: unknown
  ): Promise<void> {
    try {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      const chunk: StreamingChunk = {
        type: 'error',
        errcode: 'M_UNKNOWN',
        error: errMsg,
        timestamp: Date.now()
      };
      
      await this.sendChunk(writer, encoder, chunk);
    } catch (e) {
      console.error('Failed to send error chunk:', e);
    }
  }

  /**
   * Send a chunk with size validation
   */
  private async sendChunk(
    writer: WritableStreamDefaultWriter,
    encoder: TextEncoder,
    chunk: StreamingChunk
  ): Promise<void> {
    const jsonString = JSON.stringify(chunk) + '\n';
    const encoded = encoder.encode(jsonString);
    
    // Validate chunk size
    if (encoded.length > this.MAX_CHUNK_SIZE) {
      console.warn('Chunk too large, truncating:', {
        type: chunk.type,
        size: encoded.length,
        max: this.MAX_CHUNK_SIZE
      });
      
      // Send truncated version
      const truncatedChunk = {
        type: chunk.type,
        error: 'Response chunk too large',
        truncated: true
      };
      await writer.write(encoder.encode(JSON.stringify(truncatedChunk) + '\n'));
      return;
    }
    
    await writer.write(encoded);
  }

  /**
   * Process a single list with progress tracking
   */
  private async processListWithProgress(
    userId: string,
    listId: string,
    config: ListConfig,
    since: string | null
  ): Promise<ListResult> {
    const startTime = Date.now();
    
    try {
      // Use the optimized sync handler to process the list
      const result = await this.syncHandler.processList(userId, config, since);
      
      // Track performance
      const duration = Date.now() - startTime;
      await this.monitor.trackListProcessing(userId, listId, duration, result.count || 0);
      
      return result;
    } catch (error) {
      console.error(`Failed to process list ${listId}:`, error);
      return {
        count: 0,
        ops: [{ op: 'INVALIDATE', range: [0, 0] }]
      };
    }
  }

  /**
   * Process all requested extensions
   */
  private async processExtensions(
    userId: string,
    extensions: ExtensionsConfig,
    since: string | null
  ): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const promises: Promise<void>[] = [];

    if (extensions.to_device?.enabled) {
      promises.push(
        this.processToDeviceExtension(userId, extensions.to_device)
          .then(r => results.to_device = r)
      );
    }

    if (extensions.e2ee?.enabled) {
      promises.push(
        this.processE2EEExtension(userId, since)
          .then(r => results.e2ee = r)
      );
    }

    if (extensions.typing?.enabled) {
      promises.push(
        this.processTypingExtension(userId, extensions.typing.rooms || [])
          .then(r => results.typing = r)
      );
    }

    if (extensions.receipts?.enabled) {
      promises.push(
        this.processReceiptsExtension(userId, extensions.receipts.rooms || [])
          .then(r => results.receipts = r)
      );
    }

    if (extensions.account_data?.enabled) {
      promises.push(
        this.processAccountDataExtension(userId, extensions.account_data.rooms || [])
          .then(r => results.account_data = r)
      );
    }

    if (extensions.presence?.enabled) {
      promises.push(
        this.processPresenceExtension(userId)
          .then(r => results.presence = r)
      );
    }

    await Promise.all(promises);
    return results;
  }

  /**
   * Process to-device messages extension
   */
  private async processToDeviceExtension(
    userId: string,
    config: { since?: string; limit?: number }
  ): Promise<any> {
    // This would query the to_device_messages table
    return {
      next_batch: Date.now().toString(),
      events: [] // Would be populated from database
    };
  }

  /**
   * Process E2EE extension
   */
  private async processE2EEExtension(
    userId: string,
    since: string | null
  ): Promise<any> {
    // This would check for device list changes
    return {
      device_lists: {
        changed: [],
        left: []
      }
    };
  }

  /**
   * Process typing notifications extension
   */
  private async processTypingExtension(
    userId: string,
    roomIds: string[]
  ): Promise<any> {
    if (roomIds.length === 0) return {};
    
    // This would query typing status from Durable Objects or database
    return {
      rooms: {} // Would be populated with typing users
    };
  }

  /**
   * Process receipts extension
   */
  private async processReceiptsExtension(
    userId: string,
    roomIds: string[]
  ): Promise<any> {
    if (roomIds.length === 0) return {};
    
    // This would query read receipts
    return {
      rooms: {} // Would be populated with receipt data
    };
  }

  /**
   * Process account data extension
   */
  private async processAccountDataExtension(
    userId: string,
    roomIds: string[]
  ): Promise<any> {
    // This would query account data changes
    return {
      rooms: {} // Would be populated with account data
    };
  }

  /**
   * Process presence extension
   */
  private async processPresenceExtension(
    userId: string
  ): Promise<any> {
    // This would query presence updates
    return {
      events: [] // Would be populated with presence events
    };
  }

  /**
   * Generate a next batch token
   */
  private generateNextBatch(since: string | null): string {
    // Simple implementation - increment a counter or use timestamp
    // In production, this should be a database stream position
    const base = since ? parseInt(since) || 0 : 0;
    return (base + 1).toString();
  }

  /**
   * Generate next batch token with database position
   */
  private async generateNextBatchWithPosition(userId: string): Promise<string> {
    // This would query the current stream position from the database
    // For now, return timestamp-based token
    return Date.now().toString();
  }
}

// ============================================
// Factory function for easy instantiation
// ============================================

export function createStreamingSlidingSyncHandler(
  env: Env,
  syncHandler?: OptimizedSlidingSyncHandler
): StreamingSlidingSyncHandler {
  return new StreamingSlidingSyncHandler(env, syncHandler);
}

// ============================================
// Client-side helper (for documentation)
// ============================================

/**
 * Example client code for consuming the streaming response:
 * 
 * ```typescript
 * async function consumeStream(url: string, token: string) {
 *   const response = await fetch(url, {
 *     headers: { 'Authorization': `Bearer ${token}` }
 *   });
 *   
 *   const reader = response.body.getReader();
 *   const decoder = new TextDecoder();
 *   let buffer = '';
 *   
 *   while (true) {
 *     const { done, value } = await reader.read();
 *     if (done) break;
 *     
 *     buffer += decoder.decode(value, { stream: true });
 *     
 *     // Split by newlines and process each JSON object
 *     const lines = buffer.split('\n');
 *     buffer = lines.pop() || '';
 *     
 *     for (const line of lines) {
 *       if (line.trim()) {
 *         const chunk = JSON.parse(line);
 *         switch (chunk.type) {
 *           case 'initial':
 *             console.log('Sync started', chunk.next_batch);
 *             break;
 *           case 'list_update':
 *             console.log('List updated', chunk.list_id, chunk.data);
 *             break;
 *           case 'extension':
 *             console.log('Extension data', chunk.extension, chunk.data);
 *             break;
 *           case 'complete':
 *             console.log('Sync complete', chunk.next_batch);
 *             return;
 *           case 'heartbeat':
 *             // Keep connection alive, ignore
 *             break;
 *           case 'error':
 *             console.error('Sync error', chunk.error);
 *             return;
 *         }
 *       }
 *     }
 *   }
 * }
 * ```
 */