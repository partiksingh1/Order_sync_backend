import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import {prisma} from "../../config/db"
import { adminLoginSchema, adminSignupSchema } from '../../schema/admin/adminAuthSchema';
import multer from 'multer';
import { categorySchema, productSchema, productVariantSchema } from '../../schema/admin/productSchema';
import { generateSkuId } from '../../helper/generateSkuId';
import { z } from 'zod';
const saltRounds = 10;
import { v2 as cloudinary } from 'cloudinary';
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

// Signup Function with Zod Validation
export const signup = async (req: Request, res: Response)=> {
  // Validate request body using Zod
  const validation = adminSignupSchema.safeParse(req.body);
  
  if (!validation.success) {
    // Extract error messages from Zod validation
    const errorMessages = validation.error.errors.map(e => e.message);
   res.status(400).json({ message: errorMessages });
   return
  }

  const { email, password } = validation.data; // Safe access to validated data

  try {
    const existingAdmin = await prisma.admin.findUnique({ where: { email } });
    if (existingAdmin) {
       res.status(400).json({ message: 'Email is already registered' });
       return
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newAdmin = await prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

     res.status(201).json({
      message: 'Admin created successfully',
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
      },
    });
    return
  } catch (error) {
     res.status(500).json({ message: 'Internal Server Error' });
     return
  }
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  const validation = categorySchema.safeParse(req.body);

  if (!validation.success) {
    const errorMessages = validation.error.errors.map(e => e.message);
    res.status(400).json({ message: errorMessages });
    return;
  }

  const { name } = validation.data;

  try {
    const newCategory = await prisma.category.create({
      data: {
        name,
      },
    });

    res.status(201).json({
      message: 'Category created successfully',
      category: newCategory,
    });
  } catch (error) {
    console.log('Error creating category:', error); // Log the error for debugging
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const createProduct = [
  upload.single('image'), // Use multer to handle 'image' field from form-data
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Parse and convert req.body fields to expected types
      const parsedBody = {
        ...req.body,
        distributorPrice: parseFloat(req.body.distributorPrice),
        retailerPrice: parseFloat(req.body.retailerPrice),
        mrp: parseFloat(req.body.mrp),
        categoryId: parseInt(req.body.categoryId, 10),
        inventoryCount: parseInt(req.body.inventoryCount, 10),
        variants: req.body.variants ? JSON.parse(req.body.variants) : undefined, // if variants are provided as JSON
      };

      // Validate parsed body against productSchema
      const validation = productSchema.safeParse(parsedBody);

      if (!validation.success) {
        const errorMessages = validation.error.errors.map((e) => e.message);
        res.status(400).json({ message: errorMessages });
        return;
      }

      const { name, distributorPrice, retailerPrice, mrp, categoryId, inventoryCount, variants } = validation.data;
      let imageUrl = '';
      
      // Handle image upload to Cloudinary
      if (req.file) {
        try {
          const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'products',
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

      // Generate SKU ID for the product
      const skuId = await generateSkuId();

      // Prepare data for the new product
      const productData = {
        name,
        distributorPrice,
        retailerPrice,
        mrp,
        categoryId,
        skuId,
        inventoryCount,
        imageUrl,
        ...(variants && variants.length ? { variants: { create: variants } } : {}),
      };

      // Create the new product in the database
      const newProduct = await prisma.product.create({
        data: productData,
      });

      // Send success response
      res.status(201).json({
        message: 'Product created successfully',
        product: {
          id: newProduct.id,
          name: newProduct.name,
          skuId: newProduct.skuId,
          imageUrl: newProduct.imageUrl,
          mrp: newProduct.mrp,
        },
      });
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
    finally{
      // Clean up uploaded file if it exists and hasn't been deleted
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
  },
];



export const addVariantToProduct = async (req: Request, res: Response): Promise<void> => {
  // Validate the incoming request body
  const validation = z.array(productVariantSchema).safeParse(req.body.variants); // expects an array of variants

  if (!validation.success) {
    const errorMessages = validation.error.errors.map(e => e.message);
    res.status(400).json({ message: errorMessages });
    return;
  }

  const { productId } = req.params; // Expecting productId as a route parameter
  const variants = validation.data; // Extract validated variants

  try {
    // Add the new variants to the existing product
    const updatedProduct = await prisma.product.update({
      where: { id: Number(productId) },
      data: {
        variants: {
          create: variants.map((variant) => ({
            variantName: variant.variantName,
            variantValue: variant.variantValue,
            price: variant.price,
            stockQuantity: variant.stockQuantity,
          })),
        },
      },
      include: { variants: true }, // Include variants in the response
    });

    res.status(200).json({
      message: 'Variants added successfully',
      product: updatedProduct,
    });
  } catch (error) {
    console.log('Error adding variants:', error); // Log the error for debugging
    res.status(500).json({ message: 'Internal Server Error' });
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
export const editProduct = async (req: Request, res: Response): Promise<void> => {
  const productId = Number(req.params.id); // Extract product ID from the request parameters

  // Validate incoming data but allow partial updates
  const validation = productSchema.partial().safeParse(req.body); // Use .partial() to allow optional fields

  if (!validation.success) {
    const errorMessages = validation.error.errors.map(e => e.message);
    res.status(400).json({ message: errorMessages });
    return;
  }

  // Extract validated data
  const {
    name,
    distributorPrice,
    retailerPrice,
    mrp,
    categoryId,
    inventoryCount,
    imageUrl,
  } = validation.data;

  try {
    // Check if the product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existingProduct) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    // Create a data object with only the fields that need to be updated
    const updateData: any = {};
    if (name) updateData.name = name;
    if (distributorPrice) updateData.distributorPrice = distributorPrice;
    if (retailerPrice) updateData.retailerPrice = retailerPrice;
    if (mrp) updateData.mrp = mrp;
    if (categoryId) updateData.category = categoryId;
    if (inventoryCount) updateData.inventoryCount = inventoryCount;
    if (imageUrl) updateData.imageUrl = imageUrl;

    // Update the product entry in the database with only the specified fields
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
    });

    res.status(200).json({
      message: 'Product updated successfully',
      product: updatedProduct,
    });
  } catch (error) {
    console.error('Error updating product:', error); // Log the error for debugging
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
export const getCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    // Fetch all category from the database
    const category = await prisma.category.findMany();

    // Return the category in the response
    res.status(200).json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const deleteProduct= async (req: Request, res: Response): Promise<void> => {
  const productId = Number(req.params.id)

  try {
    // Check for dependent records in OrderItem
    const orderItems = await prisma.orderItem.findMany({
      where: { productId: productId },
    });

    if (orderItems.length > 0) {
      res.status(400).json({ error: 'Cannot delete product. It has associated order items.' });
      return
    }

    // If no dependencies, proceed to delete
    await prisma.product.delete({
      where: { id: productId },
    });

    res.status(200).json({ message: 'Product deleted successfully.' });
    return
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product.' });
    return
  }
}
// export const exportProductsToExcel = async (req: Request, res: Response): Promise<void> => {
//   try {
//     // Fetch all products from the database
//     const products = await prisma.product.findMany({
//       include: {
//         variants: true, // Include variants related to each product
//       },
//     });

//     // Check if products are found
//     if (products.length === 0) {
//       res.status(404).json({ message: 'No products found' });
//       return;
//     }

//     // Prepare data for XLSX
//     const exportData = products.map(product => ({
//       ProductName: product.name,
//       DistributorPrice: product.distributorPrice,
//       RetailerPrice: product.retailerPrice,
//       MRP: product.mrp,
//       InventoryCount: product.inventoryCount,
//       SKU: product.skuId,
//       Variants: product.variants.map(variant => `${variant.variantName}: ${variant.variantValue}`).join(', '),
//     }));

//     // Create a new workbook and a new worksheet
//     const workbook = XLSX.utils.book_new();
//     const worksheet = XLSX.utils.json_to_sheet(exportData);

//     // Append the worksheet to the workbook
//     XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

//     // Set the response headers to indicate a file download
//     res.setHeader('Content-Disposition', 'attachment; filename=products.xlsx');
//     res.setHeader('Content-Type', 'application/octet-stream');

//     // Write the workbook to the response
//     XLSX.writeFile(workbook, 'products.xlsx', { bookType: 'xlsx', type: 'buffer' });
//     res.end();
//   } catch (error) {
//     console.error('Error exporting products to Excel:', error);
//     res.status(500).json({ message: 'Internal Server Error' });
//   }
// };

export const getAllOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        shopkeeper: {
          select: {
            name: true,
            contactNumber: true,
          },
        },
        distributor: {
          select: {
            name: true,
            address: true,
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
              },
            },
          },
        },
      },
    });

    // Fetch variant details for each order item with a variantId
    const responseData = await Promise.all(
      orders.map(async (order) => {
        const itemsWithVariants = await Promise.all(
          order.items.map(async (item) => {
            if (item.variantId) {
              const variant = await prisma.productVariant.findUnique({
                where: { id: item.variantId },
                select: {
                  variantName: true,
                  variantValue: true,
                },
              });
              return {
                ...item,
                variant: variant
                  ? `${variant.variantName}: ${variant.variantValue}`
                  : 'No Variant', // Handle if variant data is missing
              };
            } else {
              return {
                ...item,
                variant: 'No Variant', // If there's no variant ID
              };
            }
          })
        );

        return {
          shopName: order.shopkeeper.name,
          employeeName: order.salesperson?.name || 'Not Assigned',
          distributorName: order.distributor?.name || 'Not Assigned',
          orderDate: order.orderDate,
          contactNumber: order.shopkeeper.contactNumber,
          products: itemsWithVariants.map((item) => ({
            productName: item.product.name,
            variant: item.variant,
            quantity: item.quantity,
          })),
          totalAmount: order.totalAmount,
          paymentType: order.paymentTerm,
          deliveryDate: order.deliveryDate,
          deliverySlot: order.deliverySlot,
          status: order.status,
        };
      })
    );

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error retrieving orders:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


// Controller to get all distributors
export const getAllDistributors = async (req: Request, res: Response): Promise<void> => {
  try {
    // Fetch all distributors from the database
    const distributors = await prisma.distributor.findMany();

    // Return the distributors in the response
    res.status(200).json(distributors);
  } catch (error) {
    console.error('Error fetching distributors:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
// Controller to get all salesperson
export const getAllSalesperson = async (req: Request, res: Response): Promise<void> => {
  try {
    // Fetch all salesperson from the database
    const salesperson = await prisma.salesperson.findMany();

    // Return the salesperson in the response
    res.status(200).json(salesperson);
  } catch (error) {
    console.error('Error fetching salesperson:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const deleteDistributor = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params; // Get the ID from the request parameters

  try {
    // Find the distributor by ID
    const distributor = await prisma.distributor.findUnique({
      where: { id: Number(id) }, // Convert id to number since it's defined as Int in your schema
    });

    if (!distributor) {
      // If distributor is not found, return a 404 error
      res.status(404).json({ message: 'Distributor not found' });
      return;
    }

    // Delete the distributor
    await prisma.distributor.delete({
      where: { id: Number(id) },
    });

    // Return a success message
    res.status(200).json({ message: 'Distributor deleted successfully' });
  } catch (error) {
    console.error('Error deleting distributor:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const editDistributor = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params; // Get the ID from the request parameters
  const { name, email, phoneNumber, gstNumber, pan, address } = req.body; // Get the updated data from the request body

  try {
    // Find the distributor by ID
    const distributor = await prisma.distributor.findUnique({
      where: { id: Number(id) }, // Convert id to number since it's defined as Int in your schema
    });

    if (!distributor) {
      // If distributor is not found, return a 404 error
      res.status(404).json({ message: 'Distributor not found' });
      return;
    }

    // Update the distributor with the provided data
    const updatedDistributor = await prisma.distributor.update({
      where: { id: Number(id) },
      data: {
        name: name || distributor.name, // If a field is not provided, retain the original value
        email: email || distributor.email,
        phoneNumber: phoneNumber || distributor.phoneNumber,
        gstNumber: gstNumber || distributor.gstNumber,
        pan: pan || distributor.pan,
        address: address || distributor.address,
      },
    });

    // Return the updated distributor
    res.status(200).json({
      message: 'Distributor updated successfully',
      distributor: updatedDistributor,
    });
  } catch (error) {
    console.error('Error updating distributor:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getShops = async (req: Request, res: Response): Promise<void> => {
  try {
    // Fetch all shopkeepers with their salesperson's name
    const shopkeepers = await prisma.shopkeeper.findMany({
      include: {
        salesperson: {
          select: {
            name: true,  // Only fetch the name of the salesperson
          },
        },
      },
    });

    // Return the shopkeeper data with salesperson name
    res.status(200).json(shopkeepers);
  } catch (error) {
    console.error('Error fetching shopkeeper:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
