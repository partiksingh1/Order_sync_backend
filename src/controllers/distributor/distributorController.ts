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
    const responseOrders = orders.map(order => ({
        id: order.id,
        deliveryDate: order.deliveryDate,
        totalAmount: order.totalAmount,
        status: order.status,
        shopkeeper: {
          name: order.shopkeeper.name,
          contactNumber: order.shopkeeper.contactNumber,
        },
        items: order.items.map(item => ({
          productName: item.product.name,
          quantity: item.quantity,
          price: item.product.retailerPrice,
        })),
      }));

    res.status(200).json({
      message: 'Orders retrieved successfully',
      responseOrders,
    });
  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
