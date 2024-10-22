// routes/adminRoutes.ts
import { Router } from 'express';
import {  addVariantToProduct, createCategory, createProduct, deleteDistributor, deleteProduct, editDistributor, editProduct, getAllDistributors, getAllOrders, getAllProducts, getAllSalesperson, getCategory, getShops, signup } from '../controllers/admin/adminController';
import { createDistributor, createSalesperson } from '../controllers/admin/accountController';
import { verifyRole } from '../middleware/authMiddleware'; // Import the middleware

const adminRoute = Router();

// Only allow users with the "ADMIN" role to access these routes
// adminRoute.post("/signup", verifyRole(['ADMIN']), signup);
// adminRoute.post("/create-salesperson", verifyRole(['ADMIN']), createSalesperson);
// adminRoute.post("/create-distributor", verifyRole(['ADMIN']), createDistributor);
// adminRoute.post("/create-product", verifyRole(['ADMIN']), createProduct);
adminRoute.post("/signup", signup);
adminRoute.post("/create-salesperson", verifyRole(['ADMIN']),createSalesperson);
adminRoute.post("/create-distributor", verifyRole(['ADMIN']), createDistributor);
adminRoute.post("/create-product", verifyRole(['ADMIN']),createProduct);
adminRoute.post("/create-category", verifyRole(['ADMIN']),createCategory);
adminRoute.get("/get-categories", verifyRole(['ADMIN']),getCategory);
adminRoute.get("/get-products", verifyRole(['ADMIN']),getAllProducts);
adminRoute.put('/product/:id', verifyRole(['ADMIN']), editProduct);
adminRoute.post('/products/:productId/variants',  verifyRole(['ADMIN']),addVariantToProduct);
adminRoute.delete('/product/:id',  verifyRole(['ADMIN']),deleteProduct);
adminRoute.get("/get-distributors", verifyRole(['ADMIN']),getAllDistributors);
adminRoute.get("/get-salesperson", verifyRole(['ADMIN']),getAllSalesperson);
adminRoute.delete('/distributor/:id',  verifyRole(['ADMIN']),deleteDistributor);
adminRoute.put('/distributor/:id',  verifyRole(['ADMIN']),editDistributor);
adminRoute.get("/get-orders", verifyRole(['ADMIN']),getAllOrders);
adminRoute.get("/get-shops", verifyRole(['ADMIN']),getShops);
// adminRoute.get('/export/products', verifyRole(['ADMIN']), exportProductsToExcel);

export default adminRoute;
