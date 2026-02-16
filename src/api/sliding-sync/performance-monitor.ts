// src/sliding-sync/performance-monitor.ts
export class SlidingSyncMonitor {
  private metrics: Map<string, MetricData> = new Map();
  
  trackSyncDuration(userId: string, duration: number, listCount: number): void {
    const key = `sync:${userId.substring(0, 10)}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        count: 0,
        totalDuration: 0,
        maxDuration: 0,
        listCounts: []
      });
    }
    
    const metric = this.metrics.get(key)!;
    metric.count++;
    metric.totalDuration += duration;
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    metric.listCounts.push(listCount);
    
    // Log if slow
    if (duration > 1000) {
      console.warn(`Slow sync for ${userId}: ${duration}ms with ${listCount} lists`);
    }
  }
  
  async reportMetrics(): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      averages: {},
      p95: {}
    };
    
    for (const [key, data] of this.metrics) {
      report.averages[key] = data.totalDuration / data.count;
      report.p95[key] = this.calculatePercentile(data.listCounts, 95);
    }
    
    await this.storeMetrics(report);
  }
}