// src/sliding-sync/streaming-response.ts
export class StreamingSlidingSyncHandler {
  async handleSlidingSyncStreaming(
    request: Request,
    userId: string
  ): Promise<Response> {
    const { lists, extensions } = this.parseRequest(request);
    const since = request.query.get('since');
    
    // Set up streaming response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    
    // Start processing in background
    this.processSyncStreaming(userId, lists, extensions, since, writer).catch(console.error);
    
    return new Response(readable, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache'
      }
    });
  }
  
  private async processSyncStreaming(
    userId: string,
    lists: Record<string, ListConfig>,
    extensions: any,
    since: string | null,
    writer: WritableStreamDefaultWriter
  ): Promise<void> {
    try {
      // Send initial response immediately
      await writer.write(encoder.encode(JSON.stringify({
        type: 'initial',
        next_batch: this.generateInitialBatch()
      }) + '\n'));
      
      // Process and send lists progressively
      for (const [listId, config] of Object.entries(lists)) {
        const listResult = await this.processListWithProgress(userId, config, since);
        
        await writer.write(encoder.encode(JSON.stringify({
          type: 'list_update',
          list_id: listId,
          data: listResult
        }) + '\n'));
      }
      
      // Process extensions
      for (const [extName, extConfig] of Object.entries(extensions)) {
        const extResult = await this.processExtension(extName, extConfig, userId);
        
        await writer.write(encoder.encode(JSON.stringify({
          type: 'extension',
          extension: extName,
          data: extResult
        }) + '\n'));
      }
      
      // Send completion marker
      await writer.write(encoder.encode(JSON.stringify({
        type: 'complete',
        next_batch: this.generateNextBatch(userId)
      }) + '\n'));
      
    } finally {
      await writer.close();
    }
  }
}