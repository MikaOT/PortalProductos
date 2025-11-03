import dotenv from 'dotenv';
dotenv.config();


export const config = {
env: process.env.NODE_ENV || 'development',
port: Number(process.env.PORT) || 3000,
mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_productos',
jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:3000'
};