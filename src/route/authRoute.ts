import { Router} from 'express';
import { login } from '../controllers/authController';
const authRoute = Router();

authRoute.post("/login", login);

export default authRoute;