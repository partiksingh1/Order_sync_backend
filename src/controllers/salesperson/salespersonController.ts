import { Request, Response } from 'express';
import { shopkeeperSchema } from '../../schema/salesperson/shopSchema';
import { prisma } from '../../config/db';
import { orderSchema } from '../../schema/salesperson/orderSchema';

// Create Shopkeeper Function with Zod Validation
export const createShopkeeper = async (req: Request, res: Response): Promise<void> => {
  // Validate request body using Zod
  const validation = shopkeeperSchema.safeParse(req.body);

  if (!validation.success) {
    // Extract error messages from Zod validation
    const errorMessages = validation.error.errors.map(e => e.message);
    res.status(400).json({ message: errorMessages });
    return;
  }

  const { name, ownerName, contactNumber, email, gpsLocation, imageUrl, videoUrl, preferredDeliverySlot, salespersonId } = validation.data; // Safe access to validated data

  try {
    const existingShopkeeper = await prisma.shopkeeper.findUnique({ where: { contactNumber } });
    if (existingShopkeeper) {
      res.status(400).json({ message: 'Shopkeeper with this contact number already exists' });
      return;
    }

    const newShopkeeper = await prisma.shopkeeper.create({
      data: {
        name,
        ownerName,
        contactNumber,
        email,
        gpsLocation,
        imageUrl,
        videoUrl,
        preferredDeliverySlot,
        salespersonId,
      },
    });

    res.status(201).json({
      message: 'Shopkeeper created successfully',
      shopkeeper: {
        id: newShopkeeper.id,
        name: newShopkeeper.name,
        ownerName: newShopkeeper.ownerName,
        contactNumber: newShopkeeper.contactNumber,
        email: newShopkeeper.email,
      },
    });
    return;
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};

export const createOrder = async (req: Request, res: Response): Promise<void> => {
    // Validate request body using Zod
    const deliveryDateObj = new Date(req.body.deliveryDate);
    const validation = orderSchema.safeParse({
      ...req.body,
      deliveryDate: deliveryDateObj, // Use Date object for validation
    });
  
    if (!validation.success) {
      // Extract error messages from Zod validation
      const errorMessages = validation.error.errors.map(e => e.message);
      res.status(400).json({ message: errorMessages });
      return;
    }
  
    const {
      shopkeeperId,
      distributorId,
      salespersonId,
      deliveryDate,
      deliverySlot,
      paymentTerm,
      orderNote,
      items,
    } = validation.data; // Safe access to validated data
  
    try {
      // Fetch product prices based on item productIds
      const products = await prisma.product.findMany({
        where: {
          id: { in: items.map(item => item.productId) },
        },
        select: {
          id: true,
          retailerPrice: true, // Assuming you're using retailerPrice for the order total
        },
      });
  
      // Map product prices for easier lookup
      const productPrices = new Map(products.map(product => [product.id, product.retailerPrice]));
  
      // Calculate total amount
      const totalAmount = items.reduce((acc, item) => {
        const price = productPrices.get(item.productId) || 0; // Fallback to 0 if product not found
        return acc + (price * item.quantity);
      }, 0);
  
      const newOrder = await prisma.order.create({
        data: {
          shopkeeperId,
          distributorId,
          salespersonId,
          deliveryDate: deliveryDateObj,
          deliverySlot,
          paymentTerm: "COD",
          orderNote,
          totalAmount,
          items: {
            create: items.map(item => ({
              productId: item.productId, // Assuming productId exists
              quantity: item.quantity,
            })),
          },
        },
      });
  
      res.status(201).json({
        message: 'Order created successfully',
        order: {
          id: newOrder.id,
          shopkeeperId: newOrder.shopkeeperId,
          distributorId: newOrder.distributorId,
          salespersonId: newOrder.salespersonId,
          deliveryDate: newOrder.deliveryDate,
          deliverySlot: newOrder.deliverySlot,
          paymentTerm: newOrder.paymentTerm,
          orderNote: newOrder.orderNote,
          totalAmount: newOrder.totalAmount,
          status: newOrder.status,
        },
      });
      return;
    } catch (error) {
      console.error(error); // Log the error for debugging
      res.status(500).json({ message: 'Internal Server Error' });
      return;
    }
  };
  