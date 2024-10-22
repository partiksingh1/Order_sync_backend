import { z } from 'zod';

const orderItemSchema = z.object({
  productId: z.number(),
  variantId: z.number().optional(),  // variantId is optional
  quantity: z.number().min(1),
});

export const orderSchema = z.object({
  shopkeeperId: z.number(),
  distributorId: z.number(),
  salespersonId: z.number(),
  deliveryDate: z.string(),  // This will be transformed into a Date object
  deliverySlot: z.string(),
  paymentTerm: z.enum(["COD", "CREDIT"]),
  orderNote: z.string().optional(),
  items: z.array(orderItemSchema),  // Validate each item in the array
});
