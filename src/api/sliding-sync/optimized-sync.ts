// src/sliding-sync/optimized-sync.ts
export class OptimizedSlidingSyncHandler {
  private readonly MAX_CONCURRENT_LISTS = 5; // Tune based on D1 limits
  
  async handleSlidingSync(request: Request, userId: string): Promise<Response> {
    const startTime = Date.now();
    const { lists, extensions } = this.parseRequest(request);
    const since = request.query.get('since');
    
    // Process lists in parallel with concurrency limit
    const results = await this.processListsConcurrently(
      userId, 
      lists, 
      since,
      this.MAX_CONCURRENT_LISTS
    );
    
    // Track performance for monitoring
    const processingTime = Date.now() - startTime;
    await this.trackPerformance(userId, processingTime);
    
    return Response.json({
      lists: results,
      next_batch: this.generateNextBatch(userId, lists),
      extensions: await this.processExtensions(extensions, userId, since)
    });
  }
  
  private async processListsConcurrently(
    userId: string,
    lists: Record<string, ListConfig>,
    since: string | null,
    concurrency: number
  ): Promise<Record<string, ListResult>> {
    const listEntries = Object.entries(lists);
    const results: Record<string, ListResult> = {};
    
    // Process in chunks to avoid overwhelming D1
    for (let i = 0; i < listEntries.length; i += concurrency) {
      const chunk = listEntries.slice(i, i + concurrency);
      const chunkPromises = chunk.map(async ([listId, config]) => {
        try {
          results[listId] = await this.processList(userId, config, since);
        } catch (error) {
          console.error(`Failed to process list ${listId}:`, error);
          results[listId] = this.createErrorResult(error);
        }
      });
      
      await Promise.all(chunkPromises);
      
      // Small delay between chunks to prevent D1 throttling
      if (i + concurrency < listEntries.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return results;
  }
}