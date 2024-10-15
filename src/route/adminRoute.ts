// routes/adminRoutes.ts
import { Router } from 'express';
import { createProduct, signup, uploadProductImage } from '../controllers/admin/adminController';
import { createDistributor, createSalesperson } from '../controllers/admin/accountController';
import { verifyRole } from '../middleware/authMiddleware'; // Import the middleware

const adminRoute = Router();

// Only allow users with the "ADMIN" role to access these routes
adminRoute.post("/signup", verifyRole(['ADMIN']), signup);
adminRoute.post("/create-salesperson", verifyRole(['ADMIN']), createSalesperson);
adminRoute.post("/create-distributor", verifyRole(['ADMIN']), createDistributor);
adminRoute.post("/create-product", verifyRole(['ADMIN']), createProduct);

export default adminRoute;
