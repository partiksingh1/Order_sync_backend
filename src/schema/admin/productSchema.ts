import { z } from 'zod';

// Product Validation Schema
export const productSchema = z.object({
  name: z.string().min(1, { message: "Product name is required" }), // Name is required and must be a non-empty string
  distributorPrice: z.number().positive({ message: "Distributor price must be a positive number" }), // Must be a positive number
  retailerPrice: z.number().positive({ message: "Retailer price must be a positive number" }), // Must be a positive number
  mrp: z.number().positive({ message: "MRP must be a positive number" }), // Must be a positive number
  category: z.string().min(1, { message: "Category is required" }), // Category is required and must be a non-empty string
  skuId: z.string().min(1, { message: "SKU ID is required" }).optional(),
  inventoryCount: z.number().int().nonnegative({ message: "Inventory count must be a non-negative integer" }), // Must be a non-negative integer
  imageUrl: z.string().url({ message: "Invalid image URL" }).optional(), // Image URL must be a valid URL (optional)
});


