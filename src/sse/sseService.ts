import { Request, Response } from 'express';

interface SSEClient {
  id: string;
  response: Response;
}

class SSEService {
  private clients: Map<string, SSEClient> = new Map();

  handleSSE = (req: Request, res: Response): void => {
    const clientId = req.query.clientId as string || `client-${Date.now()}-${Math.random()}`;

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

    // Store client
    this.clients.set(clientId, { id: clientId, response: res });

    // Handle client disconnect
    req.on('close', () => {
      this.clients.delete(clientId);
      console.log(`Client ${clientId} disconnected`);
    });

    console.log(`Client ${clientId} connected. Total clients: ${this.clients.size}`);
  };

  sendToClient(clientId: string, data: any): boolean {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.response.write(`data: ${JSON.stringify(data)}\n\n`);
        return true;
      } catch (error) {
        console.error(`Error sending to client ${clientId}:`, error);
        this.clients.delete(clientId);
        return false;
      }
    }
    return false;
  }

  broadcast(data: any): number {
    let sentCount = 0;
    const disconnectedClients: string[] = [];

    this.clients.forEach((client, clientId) => {
      try {
        client.response.write(`data: ${JSON.stringify(data)}\n\n`);
        sentCount++;
      } catch (error) {
        console.error(`Error broadcasting to client ${clientId}:`, error);
        disconnectedClients.push(clientId);
      }
    });

    // Clean up disconnected clients
    disconnectedClients.forEach((id) => this.clients.delete(id));

    return sentCount;
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  disconnectClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.response.end();
      } catch (error) {
        console.error(`Error disconnecting client ${clientId}:`, error);
      }
      this.clients.delete(clientId);
      return true;
    }
    return false;
  }
}

export const sseService = new SSEService();

