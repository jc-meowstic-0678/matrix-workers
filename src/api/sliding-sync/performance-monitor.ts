// src/api/sliding-sync/performance-monitor.ts
import { KVNamespace, D1Database } from '@cloudflare/workers-types';

// ============================================
// Type Definitions
// ============================================

interface Env {
  CACHE: KVNamespace;
  DB?: D1Database; // Optional for persistent storage
}

interface MetricData {
  count: number;
  totalDuration: number;
  maxDuration: number;
  listCounts: number[];
  slowCount: number;
  lastUpdated: number;
}

interface UserMetricData extends MetricData {
  userId: string;
  lastSync: number;
  averageDuration: number;
  p95Duration: number;
}

interface AggregatedMetrics {
  timestamp: string;
  totalRequests: number;
  averageDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  maxDuration: number;
  slowRequestCount: number;
  byUser?: Record<string, UserMetricData>;
  byListSize?: Record<number, { count: number; avgDuration: number }>;
}

interface PerformanceAlert {
  type: 'slow_sync' | 'high_error_rate' | 'connection_pool_exhausted';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  metadata: Record<string, any>;
}

// ============================================
// Main Performance Monitor Class
// ============================================

export class SlidingSyncMonitor {
  private metrics: Map<string, MetricData> = new Map();
  private alerts: PerformanceAlert[] = [];
  private readonly SLOW_THRESHOLD = 1000; // 1 second
  private readonly CRITICAL_THRESHOLD = 5000; // 5 seconds
  private readonly MAX_METRICS_HISTORY = 10000;
  private readonly ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes
  private lastAlertTime: Map<string, number> = new Map();
  
  private cache: KVNamespace;
  private db?: D1Database;
  private instanceId: string;

  constructor(env: Env) {
    this.cache = env.CACHE;
    this.db = env.DB;
    this.instanceId = this.generateInstanceId();
    
    // Load persisted metrics on startup
    this.loadPersistedMetrics().catch(err => 
      console.error('Failed to load persisted metrics:', err)
    );
  }

  /**
   * Generate a unique instance ID for this worker
   */
  private generateInstanceId(): string {
    return `worker-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Track a sync operation duration
   */
  trackSyncDuration(userId: string, duration: number, listCount: number): void {
    const key = this.getUserKey(userId);
    
    // Get or create metric for this user
    let metric = this.metrics.get(key);
    if (!metric) {
      metric = {
        count: 0,
        totalDuration: 0,
        maxDuration: 0,
        listCounts: [],
        slowCount: 0,
        lastUpdated: Date.now()
      };
      this.metrics.set(key, metric);
    }
    
    // Update metrics
    metric.count++;
    metric.totalDuration += duration;
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    metric.listCounts.push(listCount);
    metric.lastUpdated = Date.now();
    
    // Check if slow
    if (duration > this.SLOW_THRESHOLD) {
      metric.slowCount++;
      this.handleSlowSync(userId, duration, listCount);
    }
    
    // Log slow requests
    if (duration > this.SLOW_THRESHOLD) {
      const level = duration > this.CRITICAL_THRESHOLD ? 'error' : 'warn';
      console[level](`Slow sync for ${userId}: ${duration}ms with ${listCount} lists`);
    }
    
    // Prune old metrics if needed
    if (this.metrics.size > this.MAX_METRICS_HISTORY) {
      this.pruneOldMetrics();
    }
    
    // Periodically persist to KV
    if (metric.count % 10 === 0) {
      this.persistMetrics(key, metric).catch(err =>
        console.error('Failed to persist metrics:', err)
      );
    }
  }

  /**
   * Track a list processing operation
   */
  trackListProcessing(userId: string, listId: string, duration: number, roomCount: number): void {
    const key = `list:${userId.substring(0, 10)}:${listId}`;
    
    let metric = this.metrics.get(key);
    if (!metric) {
      metric = {
        count: 0,
        totalDuration: 0,
        maxDuration: 0,
        listCounts: [roomCount],
        slowCount: 0,
        lastUpdated: Date.now()
      };
      this.metrics.set(key, metric);
    }
    
    metric.count++;
    metric.totalDuration += duration;
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    metric.lastUpdated = Date.now();
    
    if (duration > this.SLOW_THRESHOLD / 2) { // Lists should be faster than full syncs
      console.warn(`Slow list processing for ${userId}/${listId}: ${duration}ms`);
    }
  }

  /**
   * Track connection pool metrics
   */
  trackPoolMetrics(waitTime: number, queueLength: number, activeConnections: number): void {
    const key = 'pool:metrics';
    
    let metric = this.metrics.get(key);
    if (!metric) {
      metric = {
        count: 0,
        totalDuration: waitTime,
        maxDuration: waitTime,
        listCounts: [queueLength],
        slowCount: 0,
        lastUpdated: Date.now()
      };
      this.metrics.set(key, metric);
    }
    
    metric.count++;
    metric.totalDuration += waitTime;
    metric.maxDuration = Math.max(metric.maxDuration, waitTime);
    metric.listCounts.push(queueLength);
    metric.lastUpdated = Date.now();
    
    // Alert if pool is backing up
    if (queueLength > 10) {
      this.createAlert({
        type: 'connection_pool_exhausted',
        severity: queueLength > 20 ? 'critical' : 'warning',
        message: `Connection pool queue length: ${queueLength}`,
        timestamp: Date.now(),
        metadata: { queueLength, activeConnections, waitTime }
      });
    }
  }

  /**
   * Handle slow sync detection with alerting
   */
  private handleSlowSync(userId: string, duration: number, listCount: number): void {
    const alertKey = `slow:${userId}`;
    const lastAlert = this.lastAlertTime.get(alertKey) || 0;
    
    // Rate limit alerts
    if (Date.now() - lastAlert > this.ALERT_COOLDOWN) {
      this.lastAlertTime.set(alertKey, Date.now());
      
      this.createAlert({
        type: 'slow_sync',
        severity: duration > this.CRITICAL_THRESHOLD ? 'critical' : 'warning',
        message: `Slow sync detected for ${userId}`,
        timestamp: Date.now(),
        metadata: { duration, listCount }
      });
    }
  }

  /**
   * Create and store an alert
   */
  private createAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);
    
    // Log to console
    const logLevel = alert.severity === 'critical' ? 'error' : 
                     alert.severity === 'warning' ? 'warn' : 'info';
    console[logLevel](`[PERF ALERT] ${alert.message}`, alert.metadata);
    
    // Store in KV for dashboard
    this.cache.put(
      `alert:${alert.timestamp}`,
      JSON.stringify(alert),
      { expirationTtl: 86400 } // 24 hours
    ).catch(err => console.error('Failed to store alert:', err));
    
    // Keep only recent alerts in memory
    const oneDayAgo = Date.now() - 86400000;
    this.alerts = this.alerts.filter(a => a.timestamp > oneDayAgo);
  }

  /**
   * Get user key for metrics map
   */
  private getUserKey(userId: string): string {
    return `user:${userId.substring(0, 10)}`;
  }

  /**
   * Prune oldest metrics when map gets too large
   */
  private pruneOldMetrics(): void {
    const entries = Array.from(this.metrics.entries());
    entries.sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);
    
    const toRemove = entries.slice(0, Math.floor(this.MAX_METRICS_HISTORY * 0.1));
    for (const [key] of toRemove) {
      this.metrics.delete(key);
    }
  }

  /**
   * Calculate percentile from array of values
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Calculate p95 from duration array
   */
  private calculateP95(durations: number[]): number {
    return this.calculatePercentile(durations, 95);
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport(includeUserDetails: boolean = false): Promise<AggregatedMetrics> {
    const userMetrics: Record<string, UserMetricData> = {};
    const listSizeMetrics: Map<number, { total: number; count: number }> = new Map();
    
    let totalRequests = 0;
    let totalDuration = 0;
    let maxDuration = 0;
    let slowCount = 0;
    
    for (const [key, data] of this.metrics.entries()) {
      if (key.startsWith('user:')) {
        const userId = key.substring(5);
        const avgDuration = data.totalDuration / data.count;
        const p95 = this.calculateP95(data.listCounts.map(() => data.totalDuration / data.count));
        
        userMetrics[userId] = {
          ...data,
          userId,
          lastSync: data.lastUpdated,
          averageDuration: avgDuration,
          p95Duration: p95
        };
        
        totalRequests += data.count;
        totalDuration += data.totalDuration;
        maxDuration = Math.max(maxDuration, data.maxDuration);
        slowCount += data.slowCount;
        
        // Track by list size
        for (const listCount of data.listCounts) {
          const bucket = Math.floor(listCount / 10) * 10; // Group by 10s
          const current = listSizeMetrics.get(bucket) || { total: 0, count: 0 };
          current.total += data.totalDuration / data.count; // Approximate
          current.count++;
          listSizeMetrics.set(bucket, current);
        }
      }
    }
    
    // Calculate overall metrics
    const allDurationsArray = Array.from(this.metrics.values())
      .flatMap(m => Array(m.count).fill(m.totalDuration / m.count));
    
    const report: AggregatedMetrics = {
      timestamp: new Date().toISOString(),
      totalRequests,
      averageDuration: totalRequests > 0 ? totalDuration / totalRequests : 0,
      p50Duration: this.calculatePercentile(allDurationsArray, 50),
      p95Duration: this.calculatePercentile(allDurationsArray, 95),
      p99Duration: this.calculatePercentile(allDurationsArray, 99),
      maxDuration,
      slowRequestCount: slowCount,
      byListSize: Object.fromEntries(
        Array.from(listSizeMetrics.entries()).map(([bucket, data]) => [
          bucket,
          { count: data.count, avgDuration: data.total / data.count }
        ])
      )
    };
    
    if (includeUserDetails) {
      report.byUser = userMetrics;
    }
    
    return report;
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(minSeverity: 'info' | 'warning' | 'critical' = 'info'): PerformanceAlert[] {
    const severityLevel = { info: 0, warning: 1, critical: 2 };
    const minLevel = severityLevel[minSeverity];
    
    return this.alerts.filter(a => severityLevel[a.severity] >= minLevel);
  }

  /**
   * Persist metrics to KV for historical tracking
   */
  private async persistMetrics(key: string, metric: MetricData): Promise<void> {
    const cacheKey = `perf:${key}:${Date.now()}`;
    await this.cache.put(cacheKey, JSON.stringify(metric), {
      expirationTtl: 86400 * 7 // 7 days
    });
  }

  /**
   * Load persisted metrics from KV
   */
  private async loadPersistedMetrics(): Promise<void> {
    // This would list and load recent metrics
    // Implementation depends on how you want to aggregate historical data
  }

  /**
   * Store report in database for historical analysis
   */
  async storeReport(report: AggregatedMetrics): Promise<void> {
    if (!this.db) return;
    
    try {
      await this.db.prepare(`
        INSERT INTO performance_reports (
          timestamp, total_requests, avg_duration, p95_duration, 
          max_duration, slow_count, report_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        report.timestamp,
        report.totalRequests,
        report.averageDuration,
        report.p95Duration,
        report.maxDuration,
        report.slowRequestCount,
        JSON.stringify(report)
      ).run();
    } catch (error) {
      console.error('Failed to store performance report:', error);
    }
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.metrics.clear();
    this.alerts = [];
    this.lastAlertTime.clear();
  }

  /**
   * Get current health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'critical';
    metrics: {
      p95Latency: number;
      errorRate: number;
      queueLength: number;
    };
  } {
    // Calculate recent error rate
    const recentErrors = this.alerts.filter(a => 
      a.timestamp > Date.now() - 300000 && // Last 5 minutes
      a.severity === 'critical'
    ).length;
    
    const poolMetric = this.metrics.get('pool:metrics');
    const p95 = poolMetric ? this.calculateP95(poolMetric.listCounts) : 0;
    
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    
    if (recentErrors > 10) {
      status = 'critical';
    } else if (p95 > 10 || recentErrors > 5) {
      status = 'degraded';
    }
    
    return {
      status,
      metrics: {
        p95Latency: p95,
        errorRate: recentErrors / 5, // Errors per minute
        queueLength: poolMetric?.listCounts[poolMetric.listCounts.length - 1] || 0
      }
    };
  }

  /**
   * Get instance ID for this monitor
   */
  getInstanceId(): string {
    return this.instanceId;
  }
}

// ============================================
// Factory function for easy instantiation
// ============================================

export function createSlidingSyncMonitor(env: Env): SlidingSyncMonitor {
  return new SlidingSyncMonitor(env);
}

// ============================================
// Database migration for performance reports
// ============================================

export const PERFORMANCE_MONITOR_MIGRATION = `
-- Table for storing performance reports
CREATE TABLE IF NOT EXISTS performance_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    total_requests INTEGER NOT NULL,
    avg_duration REAL NOT NULL,
    p95_duration REAL NOT NULL,
    max_duration REAL NOT NULL,
    slow_count INTEGER NOT NULL,
    report_data TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_perf_reports_timestamp ON performance_reports(timestamp);
`;