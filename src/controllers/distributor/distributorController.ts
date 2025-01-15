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

    // // Pagination parameters
    // const page = parseInt(req.query.page as string) || 1;
    // const limit = parseInt(req.query.limit as string) || 10;
    // const skip = (page - 1) * limit;

    const [orders, totalOrders] = await Promise.all([
      prisma.order.findMany({
        where: { distributorId },
        // skip,
        // take: limit,
        select: {
          id: true,
          deliveryDate: true,
          totalAmount: true,
          status: true,
          paymentTerm: true,
          shopkeeper: {
            select: { name: true, contactNumber: true },
          },
          items: {
            select: {
              quantity: true,
              product: {
                select: {
                  name: true,
                  retailerPrice: true,
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
      }),
      prisma.order.count({
        where: { distributorId },
      }),
    ]);

    const responseOrders = orders.map(order => ({
      id: order.id,
      deliveryDate: order.deliveryDate,
      totalAmount: order.totalAmount,
      paymentTerm: order.paymentTerm,
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
      // currentPage: page,
      // totalPages: Math.ceil(totalOrders / limit),
      totalOrders,
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
    const { deliveryDate, deliverySlot, status, partialPayment, items } = req.body;

    if (!deliveryDate && !deliverySlot && !status && !partialPayment && !items) {
      res.status(400).json({ message: 'At least one of deliveryDate, deliverySlot, status, partialPayment, or items must be provided' });
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

    let totalAmount = 0; // Variable to store the total amount of the order

    // If items are provided, update the order item quantities
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const { productId, variantId, quantity } = item;

        if (!productId || !quantity) {
          res.status(400).json({ message: 'productId and quantity are required for each item' });
          return;
        }

        const orderItem = await prisma.orderItem.findFirst({
          where: {
            orderId: parseInt(orderId),
            productId,
            variantId: variantId || undefined,
          },
        });

        if (!orderItem) {
          res.status(404).json({ message: `Order item with productId ${productId} not found in this order` });
          return;
        }

        // Fetch product details including price
        const product = await prisma.product.findUnique({
          where: { id: productId },
          include: { variants: true }, // Include variants if necessary
        });

        if (!product) {
          res.status(404).json({ message: `Product with ID ${productId} not found` });
          return;
        }

        const variant = product.variants.find(v => v.id === variantId);

        // If variant is found, update the order item
        if (variant) {
          await prisma.orderItem.update({
            where: { id: orderItem.id },
            data: {
              quantity,
            },
          });

          // Update the total amount based on the quantity and price of this variant
          totalAmount += variant.price * quantity;
        } else {
          // If no variant found, use the base product price
          totalAmount += product.retailerPrice * quantity;
        }
      }
    }

    // Update the total amount for the order
    updatedData.totalAmount = totalAmount;

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
        totalAmount: updatedOrder.totalAmount, // Include updated totalAmount
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
