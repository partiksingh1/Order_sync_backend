import { prisma } from "../config/db";

// Helper function to generate SKU with 'sku' prefix and auto-increment logic
export const generateSkuId = async (): Promise<string> => {
    const lastProduct = await prisma.product.findFirst({
      orderBy: { id: 'desc' }, // Get the product with the highest ID
      select: { id: true }
    });
  
    const nextId = lastProduct ? lastProduct.id + 1 : 1; // Increment from the last ID or start from 1
    return `sku${nextId}`; // Concatenate the prefix with the incremented value
  };
  