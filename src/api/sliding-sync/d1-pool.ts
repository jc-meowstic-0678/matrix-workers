// src/api/sliding-sync/d1-pool.ts
export class D1ConnectionPool {
  private static instance: D1ConnectionPool;
  private env: Env;
  private activeConnections: number = 0;
  private queue: Array<{
    resolve: (conn: D1Database) => void;
    reject: (err: Error) => void;
    priority: 'high' | 'low';
  }> = [];
  
  private readonly MAX_CONNECTIONS = 10;
  private readonly HIGH_PRIORITY_RESERVE = 3; // Reserve connections for high-priority
  
  private constructor(env: Env) {
    this.env = env;
  }
  
  static getInstance(env: Env): D1ConnectionPool {
    if (!D1ConnectionPool.instance) {
      D1ConnectionPool.instance = new D1ConnectionPool(env);
    }
    return D1ConnectionPool.instance;
  }
  
  async getConnection(priority: 'high' | 'low' = 'low'): Promise<D1Database> {
    const maxForPriority = priority === 'high' 
      ? this.MAX_CONNECTIONS 
      : this.MAX_CONNECTIONS - this.HIGH_PRIORITY_RESERVE;
    
    if (this.activeConnections < maxForPriority) {
      this.activeConnections++;
      return this.env.DB; // Return the actual D1 binding
    }
    
    // Queue the request
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, priority });
    });
  }
  
  releaseConnection(): void {
    this.activeConnections--;
    this.processQueue();
  }
  
  private processQueue(): void {
    if (this.queue.length === 0) return;
    
    // Process high priority first
    const highPriorityIndex = this.queue.findIndex(item => item.priority === 'high');
    const next = highPriorityIndex >= 0 
      ? this.queue.splice(highPriorityIndex, 1)[0]
      : this.queue.shift()!;
    
    if (this.activeConnections < this.MAX_CONNECTIONS) {
      this.activeConnections++;
      next.resolve(this.env.DB);
    } else {
      // Put back in queue if no connections available
      this.queue.unshift(next);
    }
  }
  
  async executeQuery<T>(
    query: string,
    params: any[],
    priority: 'high' | 'low' = 'low'
  ): Promise<T[]> {
    const conn = await this.getConnection(priority);
    
    try {
      const result = await conn.prepare(query).bind(...params).all();
      return result.results as T[];
    } finally {
      this.releaseConnection();
    }
  }
}