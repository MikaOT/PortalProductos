export const typeDefs = `#graphql
  type Product {
    id: ID!
    name: String!
    description: String
    price: Float
    stock: Int
    imageUrl: String
  }

  type User {
    id: ID!
    username: String
    email: String
    role: String
    balance: Float
  }

  type OrderItem {
    product: Product
    quantity: Int
    price: Float
  }

  type Order {
    id: ID!
    user: User
    total: Float
    status: String
    createdAt: String
    products: [OrderItem]
  }

  input CartItemInput {
    productId: ID!
    quantity: Int!
  }

  type Query {
    getProducts: [Product]
    getMyOrders: [Order]
    getUsers: [User]
    getAllOrders(status: String): [Order]
  }

  type Mutation {
    # 🛍️ Compras
    createOrder(items: [CartItemInput]!): Order

    # 🛠️ Admin - Usuarios y Pedidos
    deleteUser(id: ID!): String
    updateUserRole(id: ID!, role: String!): User
    updateOrderStatus(id: ID!, status: String!): Order

    # 📦 Admin - Productos (NUEVO)
    createProduct(name: String!, description: String, price: Float!, stock: Int!, imageUrl: String): Product
    updateProduct(id: ID!, name: String, description: String, price: Float, stock: Int, imageUrl: String): Product
    deleteProduct(id: ID!): String
  }
`;