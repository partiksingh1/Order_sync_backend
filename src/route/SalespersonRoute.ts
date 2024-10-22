// routes/salespersonRoutes.ts
import { Router } from 'express';
import { createOrder, createShopkeeper, getAllProducts, getSalespersonOrders,getShopkeepersBySalesperson } from '../controllers/salesperson/salespersonController';
import { verifyRole } from '../middleware/authMiddleware'; // Import the middleware

const salespersonRoute = Router();

//Only allow users with the "SALESPERSON" role to access these routes
salespersonRoute.post("/create-shop", verifyRole(['SALESPERSON']), createShopkeeper);
salespersonRoute.post("/create-order", verifyRole(['SALESPERSON']), createOrder);
salespersonRoute.get("/orders/:salespersonId", verifyRole(['SALESPERSON']), getSalespersonOrders);
salespersonRoute.get("/get-products", verifyRole(['SALESPERSON']), getAllProducts);
salespersonRoute.get("/:salespersonId/shops", verifyRole(['SALESPERSON']), getAllProducts);

export default salespersonRoute;
