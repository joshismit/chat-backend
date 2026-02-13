import { AccessToken } from 'livekit-server-sdk';

export class LiveKitService {
    private readonly apiKey: string;
    private readonly apiSecret: string;

    constructor() {
        this.apiKey = process.env.LIVEKIT_API_KEY || '';
        this.apiSecret = process.env.LIVEKIT_API_SECRET || '';

        if (!this.apiKey || !this.apiSecret) {
            console.warn('LiveKit API key or secret is missing. Token generation will fail.');
        }
    }

    /**
     * Generate an access token for a user to join a room
     * @param roomName Unique name for the room (e.g., call ID)
     * @param participantIdentity Unique identity for the user (e.g., user ID)
     * @param participantName Human-readable name for the user
     */
    async generateToken(
        roomName: string,
        participantIdentity: string,
        participantName?: string
    ): Promise<string> {
        try {
            if (!this.apiKey || !this.apiSecret) {
                throw new Error('LiveKit credentials not configured');
            }

            const at = new AccessToken(this.apiKey, this.apiSecret, {
                identity: participantIdentity,
                name: participantName,
            });

            at.addGrant({
                roomJoin: true,
                room: roomName,
                canPublish: true,
                canSubscribe: true,
            });

            return await at.toJwt();
        } catch (error) {
            console.error('Error generating LiveKit token:', error);
            throw error;
        }
    }
}

export const liveKitService = new LiveKitService();
