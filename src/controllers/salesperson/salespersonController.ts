import { Request, Response } from 'express';
import { shopkeeperSchema } from '../../schema/salesperson/shopSchema';
import { prisma } from '../../config/db';
import { orderSchema } from '../../schema/salesperson/orderSchema';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });
cloudinary.config({
  cloud_name: 'dcrkqaq20',
  api_key: '945669894999448',
  api_secret: '0Zn8LRb9E6PCNzvAWMZe0_JgFVU',
});


// Create Shopkeeper Function with Zod Validation

export const createShopkeeper = [
  upload.single('image'), // Use multer to handle 'image' field from form-data
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const {
        name,
        ownerName,
        contactNumber,
        email,
        gpsLocation,
        preferredDeliverySlot,
        salespersonId,
      } = req.body;

      if (
        !name ||
        !ownerName ||
        !contactNumber ||
        !email ||
        !gpsLocation ||
        !preferredDeliverySlot ||
        !salespersonId
      ) {
        res.status(400).json({ message: 'All fields are required' });
        return;
      }

      // Convert salespersonId to an integer
      const salespersonIdInt = parseInt(salespersonId, 10);

      if (isNaN(salespersonIdInt)) {
        res.status(400).json({ message: 'Invalid salesperson ID' });
        return;
      }

      // Upload image to Cloudinary
      let imageUrl = '';
      if (req.file) {
        const result = await cloudinary.uploader.upload(req.file.path);
        if (!result || !result.secure_url) {
          res.status(500).json({ message: 'Image upload failed' });
          return;
        }
        imageUrl = result.secure_url; // Store the uploaded image URL
      }
      console.log("imageurl",imageUrl);
      

      // Proceed with the shopkeeper creation
      const newShopkeeper = await prisma.shopkeeper.create({
        data: {
          name,
          ownerName,
          contactNumber,
          email,
          gpsLocation,
          imageUrl, // Save the Cloudinary image URL
          videoUrl: '', // Add logic if needed for video handling later
          preferredDeliverySlot,
          salespersonId: salespersonIdInt, // Use the converted integer
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
          imageUrl, // Include the image URL in the response
        },
      });
    } catch (error) {
      console.error('Error creating shopkeeper:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  },
];

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  // Validate request body using Zod
  const validation = orderSchema.safeParse(req.body);

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
    // Convert deliveryDate string to Date object
    const deliveryDateObj = new Date(deliveryDate);

    // Separate productIds and variantIds for query
    const productIds: number[] = items.map(item => item.productId);
    const variantIds: number[] = items
      .map(item => item.variantId)
      .filter((id): id is number => id !== undefined); // Filter out undefined variantIds

    // Fetch product and variant prices based on item productIds and variantIds
    const productsWithVariants = await prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
      select: {
        id: true,
        retailerPrice: true, // Assuming retailerPrice is used if no variant
        variants: {
          where: {
            id: { in: variantIds }, // Only query variants that were passed
          },
          select: {
            id: true,
            price: true,
          },
        },
      },
    });

    // Map product and variant prices for easier lookup
    const productVariantPrices = new Map<number, number>();
    productsWithVariants.forEach(product => {
      if (product.variants.length > 0) {
        product.variants.forEach(variant => {
          productVariantPrices.set(variant.id, variant.price);
        });
      } else {
        productVariantPrices.set(product.id, product.retailerPrice);
      }
    });

    // Calculate total amount based on item quantity and price
    const totalAmount = items.reduce((acc, item) => {
      const price = productVariantPrices.get(item.variantId || item.productId) || 0; // Fallback to 0 if no price is found
      return acc + (price * item.quantity);
    }, 0);

    // Create the order with associated items
    const newOrder = await prisma.order.create({
      data: {
        shopkeeperId,
        distributorId,
        salespersonId,
        deliveryDate: deliveryDateObj,
        deliverySlot,
        paymentTerm,
        orderNote,
        totalAmount,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            ...(item.variantId && { variantId: item.variantId }), // Include variantId if present
          })),
        },
      },
    });

    // Return success response with order details
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

export const getSalespersonOrders = async (req: Request, res: Response): Promise<void> => {
    const { salespersonId } = req.params;
  
    try {
      const orders = await prisma.order.findMany({
        where: { salespersonId: parseInt(salespersonId) },
        select: {
          id: true,
          orderDate: true,
          deliveryDate: true,
          deliverySlot: true,
          paymentTerm: true,
          orderNote: true,
          totalAmount: true,
          status: true,
          items: {
            select: {
              id: true,
              orderId: true,
              quantity: true,
              product: {
                select: {
                  name: true,
                  distributorPrice: true,
                  retailerPrice: true,
                  mrp: true,
                },
              },
            },
          },
          shopkeeper: {
            select: {
              name: true,
              ownerName: true,
              contactNumber: true,
            },
          },
          distributor: {
            select: {
              name: true,
              phoneNumber: true,
            },
          },
        },
      });
  
      res.status(200).json(orders);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch orders', error });
    }
  };
export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
    try {
      // Fetch all products from the database
      const products = await prisma.product.findMany(({
        include: {
          variants: true, // Include variants related to each product
        },
      }));
  
      // Check if products are found
      if (products.length === 0) {
        res.status(404).json({ message: 'No products found' });
        return;
      }
  
      // Return the list of products
      res.status(200).json(products);
    } catch (error) {
      console.error('Error fetching products:', error); // Log the error for debugging
      res.status(500).json({ message: 'Internal Server Error' });
    }
  };
  
export const getShopkeepersBySalesperson = async (req:Request, res:Response) => {
    const { salespersonId } = req.params;
  
    try {
      // Fetch shopkeepers for the specified salesperson
      const shopkeepers = await prisma.shopkeeper.findMany({
        where: {
          salespersonId: parseInt(salespersonId), // Convert to integer
        },
      });
  
      // Check if any shopkeepers were found
      if (shopkeepers.length === 0) {
        return res.status(404).json({ message: 'No shopkeepers found for this salesperson.' });
      }
  
      // Respond with the shopkeepers data
      res.status(200).json(shopkeepers);
    } catch (error) {
      console.error('Error fetching shopkeepers:', error);
      res.status(500).json({ message: 'Internal server error.' });
    }
  };