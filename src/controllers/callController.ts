import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { liveKitService } from '../services/livekitService';
import { sseManager } from '../sse';
import { CallStatus, CallType } from '@prisma/client';

export class CallController {
    /**
     * Initiate a call
     * POST /calls/initiate
     */
    async initiateCall(req: Request, res: Response): Promise<void> {
        try {
            const { receiverId, type, conversationId } = req.body;
            const callerId = (req as any).user.userId;

            if (!receiverId || !type) {
                res.status(400).json({ error: 'Receiver and call type are required' });
                return;
            }

            // 1. Create unique room name for LiveKit
            const roomId = `room-${callerId.substring(0, 8)}-${Date.now()}`;

            // 2. Create call record in database
            const call = await prisma.call.create({
                data: {
                    callerId,
                    receiverId,
                    type: type as CallType,
                    conversationId,
                    roomId,
                    status: CallStatus.INITIATED,
                },
            });

            // 3. Generate LiveKit token for the caller
            const caller = await prisma.user.findUnique({ where: { id: callerId } });
            const token = await liveKitService.generateToken(roomId, callerId, caller?.name);

            // 4. Notify the receiver via SSE
            sseManager.sendEventToUser(receiverId, 'call:incoming', {
                callId: call.id,
                caller: {
                    id: caller?.id,
                    name: caller?.name,
                    avatarUrl: caller?.avatarUrl,
                },
                type,
                roomId,
                conversationId,
                timestamp: new Date().toISOString(),
            });

            res.status(201).json({
                success: true,
                call,
                token,
            });
        } catch (error) {
            console.error('Initiate call error:', error);
            res.status(500).json({ error: 'Failed to initiate call' });
        }
    }

    /**
     * Accept a call
     * POST /calls/accept
     */
    async acceptCall(req: Request, res: Response): Promise<void> {
        try {
            const { callId } = req.body;
            const userId = (req as any).user.userId;

            const call = await prisma.call.findUnique({
                where: { id: callId },
            });

            if (!call || call.receiverId !== userId) {
                res.status(404).json({ error: 'Call not found or unauthorized' });
                return;
            }

            // Update call status
            await prisma.call.update({
                where: { id: callId },
                data: {
                    status: CallStatus.ACCEPTED,
                    startTime: new Date(),
                },
            });

            // Generate LiveKit token for the receiver
            const receiver = await prisma.user.findUnique({ where: { id: userId } });
            const token = await liveKitService.generateToken(call.roomId, userId, receiver?.name);

            // Notify the caller via SSE
            sseManager.sendEventToUser(call.callerId, 'call:accepted', {
                callId: call.id,
                receiverId: userId,
                timestamp: new Date().toISOString(),
            });

            res.status(200).json({
                success: true,
                token,
            });
        } catch (error) {
            console.error('Accept call error:', error);
            res.status(500).json({ error: 'Failed to accept call' });
        }
    }

    /**
     * Decline or end a call
     * POST /calls/end
     */
    async endCall(req: Request, res: Response): Promise<void> {
        try {
            const { callId, status } = req.body; // status can be REJECTED, ENDED, MISSED, BUSY
            const userId = (req as any).user.userId;

            const call = await prisma.call.findUnique({
                where: { id: callId },
            });

            if (!call) {
                res.status(404).json({ error: 'Call not found' });
                return;
            }

            const isCaller = call.callerId === userId;
            const isReceiver = call.receiverId === userId;

            if (!isCaller && !isReceiver) {
                res.status(403).json({ error: 'Unauthorized' });
                return;
            }

            const endTime = new Date();
            let duration = 0;
            if (call.startTime) {
                duration = Math.floor((endTime.getTime() - call.startTime.getTime()) / 1000);
            }

            const finalStatus = status || CallStatus.ENDED;

            await prisma.call.update({
                where: { id: callId },
                data: {
                    status: finalStatus as CallStatus,
                    endTime,
                    duration: call.startTime ? duration : null,
                },
            });

            // Notify the other party
            const targetId = isCaller ? call.receiverId : call.callerId;
            sseManager.sendEventToUser(targetId, 'call:ended', {
                callId: call.id,
                status: finalStatus,
                duration,
                timestamp: endTime.toISOString(),
            });

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('End call error:', error);
            res.status(500).json({ error: 'Failed to end call' });
        }
    }

    /**
     * Heartbeat to confirm the receiver is ringing
     * POST /calls/ringing
     */
    async reportRinging(req: Request, res: Response): Promise<void> {
        try {
            const { callId } = req.body;
            const userId = (req as any).user.userId;

            const call = await prisma.call.findUnique({
                where: { id: callId },
            });

            if (!call || call.receiverId !== userId) {
                res.status(404).json({ error: 'Call not found' });
                return;
            }

            await prisma.call.update({
                where: { id: callId },
                data: { status: CallStatus.RINGING },
            });

            // Notify caller
            sseManager.sendEventToUser(call.callerId, 'call:ringing', {
                callId: call.id,
                timestamp: new Date().toISOString(),
            });

            res.status(200).json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to report ringing' });
        }
    }
}

export const callController = new CallController();
