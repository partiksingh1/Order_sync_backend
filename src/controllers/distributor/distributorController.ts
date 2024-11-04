import { Request, Response } from 'express';
import { prisma } from '../../config/db';
import jwt from 'jsonwebtoken'; // Ensure you have jwt package installed

// Controller to get Distributor Orders
export const getDistributorOrders = async (req: Request, res: Response): Promise<void> => {
  // Extract the token from the Authorization header
  const token = req.headers.authorization?.split(' ')[1]; // Assuming Bearer token

  if (!token) {
    res.status(401).json({ message: 'Authorization token is required' });
    return;
  }

  try {
    // Verify and decode the token to get the distributor ID
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret'); // Use your actual secret

    const distributorId = decoded.id; // Adjust according to your token structure

    if (!distributorId) {
      res.status(400).json({ message: 'Invalid distributor ID from token' });
      return;
    }

    // Fetch orders from the database
    const orders = await prisma.order.findMany({
      where: {
        distributorId: distributorId,
      },
      include: {
        shopkeeper: {
          select: {
            name: true,
            contactNumber: true,
          },
        },
        salesperson: {
          select: {
            name: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                retailerPrice: true,
              },
            },
          },
        },
      },
    });

    // Transform orders to the desired response format
    const responseOrders = orders.map(order => ({
      id: order.id,
      deliveryDate: order.deliveryDate,
      totalAmount: order.totalAmount,
      status: order.status,
      shopkeeper: {
        name: order.shopkeeper?.name, // Use optional chaining
        contactNumber: order.shopkeeper?.contactNumber, // Use optional chaining
      },
      items: order.items.map(item => ({
        productName: item.product?.name, // Use optional chaining
        quantity: item.quantity,
        price: item.product?.retailerPrice, // Use optional chaining
      })),
    }));

    res.status(200).json({
      message: 'Orders retrieved successfully',
      orders: responseOrders, // Rename to 'orders' for clarity
    });
  } catch (error) {
    console.error('Error fetching orders:', error); // Log the error for debugging
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const updateOrderDetails = async (req: Request, res: Response): Promise<void> => {
  // Extract the token from the Authorization header
  const token = req.headers.authorization?.split(' ')[1]; // Assuming Bearer token

  if (!token) {
    res.status(401).json({ message: 'Authorization token is required' });
    return;
  }

  try {
    // Verify and decode the token to get the distributor ID
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret'); // Use your actual secret
    const distributorId = decoded.id; // Adjust according to your token structure

    if (!distributorId) {
      res.status(400).json({ message: 'Invalid distributor ID from token' });
      return;
    }

    const { orderId } = req.params;
    const { deliveryDate, deliverySlot, status } = req.body;

    // Validate input (optional, based on business logic)
    if (!deliveryDate && !deliverySlot && !status) {
      res.status(400).json({ message: 'At least one of deliveryDate, deliverySlot, or status must be provided' });
      return;
    }

    // Check if the order exists and belongs to the distributor
    const order = await prisma.order.findUnique({
      where: {
        id: parseInt(orderId),
      },
    });

    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    // Ensure the distributor is authorized to update the order
    if (order.distributorId !== distributorId) {
      res.status(403).json({ message: 'You are not authorized to update this order' });
      return;
    }

    // Update the delivery date, delivery slot, and status if provided
    const updatedData: any = {};

    if (deliveryDate) {
      updatedData.deliveryDate = new Date(deliveryDate); // Convert the date string to a Date object
    }
    if (deliverySlot) {
      updatedData.deliverySlot = deliverySlot;
    }
    if (status) {
      updatedData.status = status;
    }

    const updatedOrder = await prisma.order.update({
      where: {
        id: parseInt(orderId),
      },
      data: updatedData,
    });

    // Send success response
    res.status(200).json({
      message: 'Order details updated successfully',
      order: {
        id: updatedOrder.id,
        deliveryDate: updatedOrder.deliveryDate,
        deliverySlot: updatedOrder.deliverySlot,
        status: updatedOrder.status,
      },
    });
  } catch (error) {
    console.error('Error updating order:', error); // Log the error for debugging
    res.status(500).json({ message: 'Internal Server Error' });
  }
};