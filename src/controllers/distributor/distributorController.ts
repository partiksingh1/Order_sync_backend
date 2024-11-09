import { Request, Response } from 'express';
import { prisma } from '../../config/db';
import jwt from 'jsonwebtoken'; // Ensure you have jwt package installed

// Controller to get Distributor Orders
export const getDistributorOrders = async (req: Request, res: Response): Promise<void> => {
  const token = req.headers.authorization?.split(' ')[1]; // Assuming Bearer token

  if (!token) {
    res.status(401).json({ message: 'Authorization token is required' });
    return;
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    const distributorId = decoded.id;

    if (!distributorId) {
      res.status(400).json({ message: 'Invalid distributor ID from token' });
      return;
    }

    const orders = await prisma.order.findMany({
      where: { distributorId },
      select: {
        id: true,
        deliveryDate: true,
        totalAmount: true,
        status: true,
        paymentTerm: true, // Include paymentTerm directly
        shopkeeper: {
          select: { name: true, contactNumber: true },
        },
        items: {
          select: {
            quantity: true,
            product: {
              select: {
                name: true, // Product name
                retailerPrice: true, // Retailer price
              },
            },
          },
        },
        partialPayment: {
          select: {
            initialAmount: true,
            remainingAmount: true,
            dueDate: true,
            paymentStatus: true,
          },
        },
      },
    });
    
    // Transform the items to match the expected output format
    const transformedOrders = orders.map(order => ({
      id: order.id,
      deliveryDate: order.deliveryDate,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentTerm: order.paymentTerm, // Include paymentTerm in the output
      shopkeeper: order.shopkeeper,
      items: order.items.map(item => ({
        productName: item.product.name, // Get the product name
        quantity: item.quantity,
        price: item.product.retailerPrice, // Get the retailer price
      })),
      partialPayment: order.partialPayment,
    }));
    
    console.log(transformedOrders);

    const responseOrders = orders.map(order => ({
      id: order.id,
      deliveryDate: order.deliveryDate,
      totalAmount: order.totalAmount,
      paymentTerm:order.paymentTerm,
      status: order.status,
      shopkeeper: {
        name: order.shopkeeper?.name,
        contactNumber: order.shopkeeper?.contactNumber,
      },
      items: order.items.map(item => ({
        productName: item.product?.name,
        quantity: item.quantity,
        price: item.product?.retailerPrice,
      })),
      partialPayment: order.partialPayment
        ? {
            initialAmount: order.partialPayment.initialAmount,
            remainingAmount: order.partialPayment.remainingAmount,
            dueDate: order.partialPayment.dueDate,
            paymentStatus: order.partialPayment.paymentStatus,
          }
        : null,
    }));

    res.status(200).json({
      message: 'Orders retrieved successfully',
      orders: responseOrders,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const updateOrderDetails = async (req: Request, res: Response): Promise<void> => {
  const token = req.headers.authorization?.split(' ')[1]; // Assuming Bearer token

  if (!token) {
    res.status(401).json({ message: 'Authorization token is required' });
    return;
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    const distributorId = decoded.id;

    if (!distributorId) {
      res.status(400).json({ message: 'Invalid distributor ID from token' });
      return;
    }

    const { orderId } = req.params;
    const { deliveryDate, deliverySlot, status, partialPayment } = req.body;

    if (!deliveryDate && !deliverySlot && !status && !partialPayment) {
      res.status(400).json({ message: 'At least one of deliveryDate, deliverySlot, status, or partialPayment must be provided' });
      return;
    }

    const order = await prisma.order.findUnique({ where: { id: parseInt(orderId) } });

    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    if (order.distributorId !== distributorId) {
      res.status(403).json({ message: 'You are not authorized to update this order' });
      return;
    }

    const updatedData: any = {};

    if (deliveryDate) updatedData.deliveryDate = new Date(deliveryDate);
    if (deliverySlot) updatedData.deliverySlot = deliverySlot;
    if (status) updatedData.status = status;

    if (partialPayment) {
      const { initialAmount, remainingAmount, dueDate, paymentStatus } = partialPayment;

      await prisma.partialPayment.upsert({
        where: { orderId: parseInt(orderId) },
        update: {
          initialAmount: initialAmount || undefined,
          remainingAmount: remainingAmount || undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          paymentStatus: paymentStatus || undefined,
        },
        create: {
          orderId: parseInt(orderId),
          initialAmount,
          remainingAmount,
          dueDate: new Date(dueDate),
          paymentStatus,
        },
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(orderId) },
      data: updatedData,
    });

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
    console.error('Error updating order:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
// Controller to update partial payment by order ID
export const updatePartialPayment = async (req: Request, res: Response): Promise<void> => {
  const token = req.headers.authorization?.split(' ')[1]; // Assuming Bearer token

  if (!token) {
    res.status(401).json({ message: 'Authorization token is required' });
    return;
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    const distributorId = decoded.id;

    if (!distributorId) {
      res.status(400).json({ message: 'Invalid distributor ID from token' });
      return;
    }

    const { orderId } = req.params;
    const { initialAmount, remainingAmount, dueDate, paymentStatus } = req.body;

    if (!initialAmount && !remainingAmount && !dueDate && !paymentStatus) {
      res.status(400).json({ message: 'At least one of initialAmount, remainingAmount, dueDate, or paymentStatus must be provided' });
      return;
    }

    const order = await prisma.order.findUnique({ where: { id: parseInt(orderId) } });

    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    if (order.distributorId !== distributorId) {
      res.status(403).json({ message: 'You are not authorized to update this order' });
      return;
    }

    const updatedPartialPayment = await prisma.partialPayment.upsert({
      where: { orderId: parseInt(orderId) },
      update: {
        initialAmount: initialAmount || undefined,
        remainingAmount: remainingAmount || undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        paymentStatus: paymentStatus || undefined,
      },
      create: {
        orderId: parseInt(orderId),
        initialAmount: initialAmount || 0,
        remainingAmount: remainingAmount || 0,
        dueDate: dueDate ? new Date(dueDate) : new Date(),
        paymentStatus: paymentStatus || 'pending',
      },
    });

    res.status(200).json({
      message: 'Partial payment updated successfully',
      partialPayment: {
        initialAmount: updatedPartialPayment.initialAmount,
        remainingAmount: updatedPartialPayment.remainingAmount,
        dueDate: updatedPartialPayment.dueDate,
        paymentStatus: updatedPartialPayment.paymentStatus,
      },
    });
  } catch (error) {
    console.error('Error updating partial payment:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
