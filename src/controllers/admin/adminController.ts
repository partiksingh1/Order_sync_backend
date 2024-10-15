import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {prisma} from "../../config/db"
import { adminLoginSchema, adminSignupSchema } from '../../schema/admin/adminAuthSchema';
import imgur, { ImgurClient } from 'imgur';
import multer from 'multer';
import { productSchema } from '../../schema/admin/productSchema';
import { generateSkuId } from '../../helper/generateSkuId';
const saltRounds = 10;
const upload = multer({ dest: 'uploads/' });
const imgurClient = new ImgurClient({
  clientId: process.env.IMGUR_CLIENT_ID,
  clientSecret: process.env.IMGUR_CLIENT_SECRET,
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

// Create Product Function with Image Upload to Imgur

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  // console.log(req.file);
  // Validate request body using Zod
  const validation = productSchema.safeParse(req.body);

  if (!validation.success) {
    const errorMessages = validation.error.errors.map(e => e.message);
    res.status(400).json({ message: errorMessages });
    return;
  }

  const { name, distributorPrice, retailerPrice, mrp, category, inventoryCount,imageUrl } = validation.data;

  // if (!req.file) {
  //   res.status(400).json({ message: 'Image is required' });
  //   return;
  // }

  try {
    // Upload the image to Imgur
    // const response = await imgurClient.upload({
    //   image: req.file?.path, // Path to the file
    //   type: 'stream',
    // });
    // const imageUrl = response.data.link||"";
    // console.log("imageurl",imageUrl);
    

    // Generate SKU ID using your custom function
    const skuId = await generateSkuId();

    // Create a new product entry in the database
    const newProduct = await prisma.product.create({
      data: {
        name,
    distributorPrice, // Pass Float value directly
    retailerPrice,   // Pass Float value directly
    mrp,             // Pass Float value directly
    category,
    skuId,
    inventoryCount,
    imageUrl,
      },
    });

    res.status(201).json({
      message: 'Product created successfully',
      product: newProduct,
    });
  } catch (error) {
    console.log('Error creating product:', error); // Log the error for debugging
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Middleware to handle image upload
export const uploadProductImage = upload.single('productImage');