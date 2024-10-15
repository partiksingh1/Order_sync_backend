import { z } from 'zod';

export const orderSchema = z.object({
  shopkeeperId: z.number().int().positive(),
  distributorId: z.number().int().positive(),
  salespersonId: z.number().int().positive(),
  deliveryDate: z.date(),
  deliverySlot: z.string().min(1, 'Delivery slot is required'),
  paymentTerm: z.enum(['CASH', 'CREDIT']), // Adjust as per your PaymentTerm options
  orderNote: z.string().optional(), // Optional field
//   totalAmount: z.number().positive('Total amount must be greater than zero'),
  items: z.array(z.object({
    productId: z.number().int().positive(), // Assuming you have a productId for items
    quantity: z.number().int().positive(),
  })).nonempty('Order items are required'), // At least one item should be present
});
