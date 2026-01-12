import mongoose from 'mongoose';
// Fíjate que ahora apuntamos a ./src/... porque estamos en la raíz
import { Product } from './src/models/Product.js';
import { User } from './src/models/User.js';
import { config } from './src/config.js';

mongoose.connect(config.mongoUri).then(async () => {
    console.log("🌱 Reiniciando Tienda...");
    
    // Limpiamos productos antiguos
    await Product.deleteMany({});
    
    // Buscamos al admin para asignarle los productos
    const admin = await User.findOne({ role: 'admin' }); 
    
    // Si no hay admin, creamos productos sin dueño (o fallará si es required)
    // Pero como ya arrancaste el server antes, el admin debería existir.
    const ownerId = admin ? admin._id : null;

    if (!ownerId) {
        console.error("❌ No se encontró un usuario Admin. Arranca el server (node src/server.js) una vez primero para que se cree el admin automáticamente.");
        process.exit(1);
    }
    
    await Product.create([
        { 
            name: "Cámara Sony Alpha", 
            description: "4K Video, Lente 50mm", 
            price: 850, 
            stock: 10, 
            imageUrl: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80",
            owner: ownerId 
        },
        { 
            name: "Laptop Gaming", 
            description: "RTX 4060, 16GB RAM", 
            price: 1200, 
            stock: 5, 
            imageUrl: "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=400&q=80",
            owner: ownerId 
        },
        { 
            name: "Auriculares Noise Cancelling", 
            description: "Batería 30h", 
            price: 150, 
            stock: 50, 
            imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80",
            owner: ownerId 
        }
    ]);

    console.log("✅ Productos creados correctamente");
    process.exit();
}).catch(err => {
    console.error("❌ Error:", err);
    process.exit(1);
});