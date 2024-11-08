import { Request, Response } from 'express';
import { shopkeeperSchema } from '../../schema/salesperson/shopSchema';
import { prisma } from '../../config/db';
import { orderSchema } from '../../schema/salesperson/orderSchema';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dcrkqaq20',
  api_key: process.env.CLOUDINARY_API_KEY || '945669894999448',
  api_secret: process.env.CLOUDINARY_API_SECRET || '0Zn8LRb9E6PCNzvAWMZe0_JgFVU',
});



// Create Shopkeeper Function with Zod Validation

export const createShopkeeper = [
  upload.single('image'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const schema = {
        name: String,
        ownerName: String,
        contactNumber: String,
        email: String,
        gpsLocation: String,
        preferredDeliverySlot: String,
        salespersonId: String,
      };

      // Basic validation
      for (const [key, type] of Object.entries(schema)) {
        // Skip validation for fields that are optional or have default values
        if (key === 'preferredDeliverySlot') continue;
      
        if (!req.body[key] || typeof req.body[key] !== type.name.toLowerCase()) {
          res.status(400).json({ message: `Invalid or missing field: ${key}` });
          return;
        }
      }

      let imageUrl = '';
      
      // Handle image upload to Cloudinary
      if (req.file) {
        try {
          const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'shopkeepers',
            resource_type: 'auto',
          });
          imageUrl = result.secure_url;
          
          // Clean up temporary file
          fs.unlinkSync(req.file.path);
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
          res.status(500).json({ message: 'Image upload failed' });
          return;
        }
      }

      // Create shopkeeper in database
      const newShopkeeper = await prisma.shopkeeper.create({
        data: {
          name: req.body.name,
          ownerName: req.body.ownerName,
          contactNumber: req.body.contactNumber,
          email: req.body.email,
          gpsLocation: req.body.gpsLocation,
          imageUrl,
          preferredDeliverySlot : '11AM - 2PM',
          salespersonId: parseInt(req.body.salespersonId, 10),
        },
      });

      res.status(201).json({
        message: 'Shopkeeper created successfully',
        shopkeeper: newShopkeeper,
      });
    } catch (error) {
      console.error('Error creating shopkeeper:', error);
      res.status(500).json({ 
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? error : undefined 
      });
    } finally {
      // Clean up uploaded file if it exists and hasn't been deleted
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
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
    partialPayment,
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
            ...(item.variantId && { variantId: item.variantId }),
          })),
        },
        ...(paymentTerm === 'PARTIAL' && partialPayment && {
          partialPayment: {
            create: {
              initialAmount: partialPayment.initialAmount,
              remainingAmount: partialPayment.remainingAmount,
              dueDate: new Date(partialPayment.dueDate),
            },
          },
        }),
      },
      include: {
        partialPayment: true,
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
      where: { salespersonId: parseInt(salespersonId, 10) },
      select: {
        id: true,
        orderDate: true,
        deliveryDate: true,
        deliverySlot: true,
        paymentTerm: true,
        orderNote: true,
        totalAmount: true,
        status: true, // Already included
        partialPayment: { // New addition
          select: {
            id: true,
            initialAmount: true,
            remainingAmount: true,
            dueDate: true,
            paymentStatus: true,
            createdAt: true,
            updatedAt: true,
          },
        },
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
            variantId: true, // Include variantId if needed
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
    console.error('Error fetching orders:', error);
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
  
  export const getShopkeepersBySalesperson = async (req: Request, res: Response) => {
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
        // Change this line to return an empty array with a 200 status
        res.status(200).json([]); // Respond with an empty array
        return;
      }
  
      // Respond with the shopkeepers data
      res.status(200).json(shopkeepers);
    } catch (error) {
      console.error('Error fetching shopkeepers:', error);
      res.status(500).json({ message: 'Internal server error.' });
    }
  };
  