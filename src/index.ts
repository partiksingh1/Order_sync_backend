import express, {Express, Request, Response } from 'express';
import adminRouter from './route/adminRoute';
import authRoute from './route/authRoute';
import salespersonRoute from './route/SalespersonRoute';
import distributorRoute from './route/distributorsRoute';
const app:Express = express();
const port:number = 3000;



// Middleware to parse JSON bodies

app.use(express.json());

app.use("/api/v1/auth",authRoute);
app.use("/api/v1/admin",adminRouter);
app.use("/api/v1/salesperson",salespersonRoute);
app.use("/api/v1/distributor",distributorRoute);

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

export default app;