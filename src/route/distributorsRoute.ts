// routes/distributorRoutes.ts
import { Router } from 'express';
import { getDistributorOrders } from '../controllers/distributor/distributorController';
import { verifyRole } from '../middleware/authMiddleware'; // Import the middleware

const distributorRoute = Router();

// Only allow users with the "DISTRIBUTOR" role to access these routes
distributorRoute.get("/get-orders", verifyRole(['DISTRIBUTOR']), getDistributorOrders);

export default distributorRoute;
