// src/api/sliding-sync/d1-pool.ts
import { D1Database } from '@cloudflare/workers-types';

// ============================================
// Type Definitions
// ============================================

interface Env {
  DB: D1Database;
  // Other bindings can be added as needed
}

interface QueuedRequest {
  resolve: (conn: D1Database) => void;
  reject: (err: Error) => void;
  priority: 'high' | 'low';
  timeoutId?: ReturnType<typeof setTimeout>;
}

interface PoolMetrics {
  totalRequests: number;
  queuedRequests: number;
  activeConnections: number;
  waitTime: number;
  timeoutCount: number;
}

// ============================================
// D1 Connection Pool
// ============================================

export class D1ConnectionPool {
  private static instance: D1ConnectionPool;
  private env: Env;
  private activeConnections: number = 0;
  private queue: QueuedRequest[] = [];
  
  private readonly MAX_CONNECTIONS = 10;
  private readonly HIGH_PRIORITY_RESERVE = 3;
  private readonly CONNECTION_TIMEOUT = 5000; // 5 seconds timeout
  
  // Metrics for monitoring
  private metrics: PoolMetrics = {
    totalRequests: 0,
    queuedRequests: 0,
    activeConnections: 0,
    waitTime: 0,
    timeoutCount: 0
  };
  
  private constructor(env: Env) {
    this.env = env;
  }
  
  /**
   * Get singleton instance of the connection pool
   */
  static getInstance(env: Env): D1ConnectionPool {
    if (!D1ConnectionPool.instance) {
      D1ConnectionPool.instance = new D1ConnectionPool(env);
    }
    return D1ConnectionPool.instance;
  }
  
  /**
   * Get a connection from the pool with priority
   */
  async getConnection(priority: 'high' | 'low' = 'low'): Promise<D1Database> {
    this.metrics.totalRequests++;
    
    const maxForPriority = priority === 'high' 
      ? this.MAX_CONNECTIONS 
      : this.MAX_CONNECTIONS - this.HIGH_PRIORITY_RESERVE;
    
    // If we have capacity for this priority level, grant immediately
    if (this.activeConnections < maxForPriority) {
      this.activeConnections++;
      this.metrics.activeConnections = this.activeConnections;
      return this.env.DB;
    }
    
    // Queue the request with timeout
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const timeoutId = setTimeout(() => {
        // Remove this request from queue
        const index = this.queue.findIndex(req => req.timeoutId === timeoutId);
        if (index !== -1) {
          this.queue.splice(index, 1);
          this.metrics.queuedRequests = this.queue.length;
        }
        
        this.metrics.timeoutCount++;
        reject(new Error('Connection timeout: No database connection available'));
      }, this.CONNECTION_TIMEOUT);
      
      this.queue.push({ 
        resolve, 
        reject, 
        priority,
        timeoutId 
      });
      
      this.metrics.queuedRequests = this.queue.length;
    });
  }
  
  /**
   * Release a connection back to the pool
   */
  releaseConnection(): void {
    if (this.activeConnections > 0) {
      this.activeConnections--;
      this.metrics.activeConnections = this.activeConnections;
      this.processQueue();
    }
  }
  
  /**
   * Process queued requests in priority order
   */
  private processQueue(): void {
    if (this.queue.length === 0) return;
    
    // Sort queue: high priority first, then FIFO
    this.queue.sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (a.priority !== 'high' && b.priority === 'high') return 1;
      return 0; // Preserve order for same priority
    });
    
    // Process as many as we can
    while (this.queue.length > 0 && this.activeConnections < this.MAX_CONNECTIONS) {
      const next = this.queue.shift()!;
      
      // Clear the timeout
      if (next.timeoutId) {
        clearTimeout(next.timeoutId);
      }
      
      this.activeConnections++;
      this.metrics.activeConnections = this.activeConnections;
      this.metrics.queuedRequests = this.queue.length;
      
      // Grant the connection
      next.resolve(this.env.DB);
    }
  }
  
  /**
   * Execute a query with automatic connection management
   */
  async executeQuery<T = any>(
    query: string,
    params: any[] = [],
    priority: 'high' | 'low' = 'low'
  ): Promise<T[]> {
    const startTime = Date.now();
    const conn = await this.getConnection(priority);
    
    try {
      const stmt = conn.prepare(query);
      const boundStmt = stmt.bind(...params);
      const result = await boundStmt.all<T>();
      
      // Track wait time for metrics
      const waitTime = Date.now() - startTime;
      this.metrics.waitTime = (this.metrics.waitTime + waitTime) / 2; // Exponential moving average
      
      return result.results || [];
    } catch (error) {
      console.error('Query execution failed:', {
        query: query.substring(0, 100), // Log first 100 chars
        params,
        error: error.message
      });
      throw new Error(`Database query failed: ${error.message}`);
    } finally {
      this.releaseConnection();
    }
  }
  
  /**
   * Execute a transaction (multiple queries as a batch)
   */
  async executeTransaction<T = any>(
    queries: Array<{ sql: string; params: any[] }>,
    priority: 'high' | 'low' = 'high' // Transactions are high priority by default
  ): Promise<T[][]> {
    const conn = await this.getConnection(priority);
    
    try {
      const results: T[][] = [];
      
      // D1 doesn't support actual transactions, but we can execute sequentially
      for (const { sql, params } of queries) {
        const stmt = conn.prepare(sql);
        const boundStmt = stmt.bind(...params);
        const result = await boundStmt.all<T>();
        results.push(result.results || []);
      }
      
      return results;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    } finally {
      this.releaseConnection();
    }
  }
  
  /**
   * Execute a query and return the first row
   */
  async executeQueryFirst<T = any>(
    query: string,
    params: any[] = [],
    priority: 'high' | 'low' = 'low'
  ): Promise<T | null> {
    const results = await this.executeQuery<T>(query, params, priority);
    return results.length > 0 ? results[0] : null;
  }
  
  /**
   * Get current pool metrics for monitoring
   */
  getMetrics(): Readonly<PoolMetrics> {
    return { ...this.metrics };
  }
  
  /**
   * Reset the pool (useful for testing)
   */
  reset(): void {
    this.activeConnections = 0;
    this.queue = [];
    this.metrics = {
      totalRequests: 0,
      queuedRequests: 0,
      activeConnections: 0,
      waitTime: 0,
      timeoutCount: 0
    };
  }
  
  /**
   * Get queue status
   */
  getQueueStatus(): { length: number; highPriority: number; lowPriority: number } {
    const highPriority = this.queue.filter(req => req.priority === 'high').length;
    const lowPriority = this.queue.filter(req => req.priority === 'low').length;
    
    return {
      length: this.queue.length,
      highPriority,
      lowPriority
    };
  }
}

// ============================================
// Factory function for easy instantiation
// ============================================

export function createConnectionPool(env: Env): D1ConnectionPool {
  return D1ConnectionPool.getInstance(env);
}