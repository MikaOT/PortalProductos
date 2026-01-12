import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';

const checkAdmin = (context) => {
  if (!context.user || context.user.role !== 'admin') {
    throw new Error('⛔ Acceso denegado: Se requieren permisos de Administrador');
  }
};

export const resolvers = {
  Query: {
    getProducts: async () => await Product.find({ isActive: true }),
    getMyOrders: async (_, __, context) => {
      if (!context.user) throw new Error('No autorizado');
      return await Order.find({ user: context.user.id }).populate('products.product').sort({ createdAt: -1 });
    },
    getUsers: async (_, __, context) => {
      checkAdmin(context);
      return await User.find();
    },
    getAllOrders: async (_, { status }, context) => {
      checkAdmin(context);
      const filter = status ? { status } : {};
      return await Order.find(filter).populate('user').populate('products.product').sort({ createdAt: -1 });
    }
  },
  Mutation: {
    // --- PEDIDOS ---
    createOrder: async (_, { items }, context) => {
      if (!context.user) throw new Error('Debes iniciar sesión');
      const user = await User.findById(context.user.id);
      let total = 0;
      const orderProducts = [];

      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product || product.stock < item.quantity) throw new Error(`Stock insuficiente: ${product?.name}`);
        total += product.price * item.quantity;
        orderProducts.push({ product: product._id, quantity: item.quantity, price: product.price });
      }

      if (user.balance < total) throw new Error('Saldo insuficiente');
      
      const order = await Order.create({ user: user._id, products: orderProducts, total, status: 'completed' });
      
      user.balance -= total;
      await user.save();
      
      for (const item of items) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
      }
      return await order.populate('products.product');
    },

    // --- GESTIÓN USUARIOS ---
    deleteUser: async (_, { id }, context) => {
      checkAdmin(context);
      await User.findByIdAndDelete(id);
      return "Borrado";
    },
    updateUserRole: async (_, { id, role }, context) => {
      checkAdmin(context);
      return await User.findByIdAndUpdate(id, { role }, { new: true });
    },
    updateOrderStatus: async (_, { id, status }, context) => {
      checkAdmin(context);
      return await Order.findByIdAndUpdate(id, { status }, { new: true }).populate('products.product');
    },

    // --- GESTIÓN PRODUCTOS (NUEVO) ---
    createProduct: async (_, args, context) => {
      checkAdmin(context);
      // Asignamos al admin actual como dueño
      const newProduct = new Product({ ...args, owner: context.user.id });
      return await newProduct.save();
    },
    updateProduct: async (_, { id, ...args }, context) => {
      checkAdmin(context);
      return await Product.findByIdAndUpdate(id, args, { new: true });
    },
    deleteProduct: async (_, { id }, context) => {
      checkAdmin(context);
      // Borrado lógico (isActive: false) o físico. Usamos físico para simplificar la práctica.
      await Product.findByIdAndDelete(id);
      return "Producto eliminado";
    }
  }
};