import { Router, Request, Response } from 'express';

const router = Router();

// Health check route
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// TODO: Add your routes here
// router.use('/auth', authRoutes);
// router.use('/chat', chatRoutes);

export default router;

