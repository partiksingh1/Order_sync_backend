// routes/salespersonRoutes.ts
import { Router } from 'express';
import { createOrder, createShopkeeper } from '../controllers/salesperson/salespersonController';
import { verifyRole } from '../middleware/authMiddleware'; // Import the middleware

const salespersonRoute = Router();

// Only allow users with the "SALESPERSON" role to access these routes
salespersonRoute.post("/create-shop", verifyRole(['SALESPERSON']), createShopkeeper);
salespersonRoute.post("/create-order", verifyRole(['SALESPERSON']), createOrder);

export default salespersonRoute;
