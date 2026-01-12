# 🚀 Nexus Store (Portal de Productos V2)


> **E-commerce moderno Fullstack** con arquitectura híbrida (REST + GraphQL), comunicación en tiempo real y una interfaz de usuario Premium con estilo Glassmorphism.

![Status](https://img.shields.io/badge/Status-V2%20Stable-success)
![Node](https://img.shields.io/badge/Node.js-v18+-green)
![GraphQL](https://img.shields.io/badge/GraphQL-Apollo-e535ab)
![DB](https://img.shields.io/badge/MongoDB-Mongoose-47a248)
![Socket](https://img.shields.io/badge/Socket.io-RealTime-black)

---

## 📋 Descripción

**Nexus Store** es la evolución (V2) del "Portal de Productos". Esta versión transforma una gestión de inventario básica en una **Tienda Online completa**.

Se ha migrado gran parte de la lógica a **GraphQL** para una gestión de datos eficiente, se ha implementado un sistema de **Chat en Tiempo Real con IA**, y se ha rediseñado el Frontend desde cero utilizando **Vanilla JS + CSS Glassmorphism** para una experiencia de usuario fluida y moderna.

**⚠️ Nota:** Actualmente el proyecto está configurado para despliegue local (On-Premise/Localhost).

---

## ✨ Características Principales

### 🛒 E-commerce & Cliente
* **Catálogo Dinámico:** Visualización de productos con stock en tiempo real.
* **Carrito de Compras Persistente:** Gestión de items con validación de stock y persistencia en LocalStorage.
* **Checkout con GraphQL:** Proceso de compra atómico que genera pedidos y actualiza inventarios.
* **UI Premium:** Diseño responsivo con efectos de desenfoque (Glassmorphism), animaciones y notificaciones Toast.

### 🛠️ Panel de Administración (Backoffice)
* **Gestión de Productos:** CRUD completo (Crear, Editar, Eliminar) mediante Modales interactivos.
* **Control de Usuarios:** Listado de usuarios, cambio de roles y eliminación.
* **Monitorización de Pedidos:** Visión global de todas las transacciones de la plataforma.

### 🔮 Tecnología & Backend
* **API Híbrida:** Conviven endpoints REST (Auth) con una potente API GraphQL (Datos de negocio).
* **Real-time Chat:** Chat global y privado implementado con **Socket.IO**.
* **Integración IA:** Bot asistente integrado en el chat (vía OpenAI API).
* **Seguridad:** Autenticación JWT y protección de rutas por roles.

## 🚀 Instalación y Puesta en Marcha

Sigue estos pasos para levantar el proyecto en tu entorno local.

### 1. Prerrequisitos
* Node.js (v18 o superior).
* MongoDB (corriendo localmente o cluster Atlas).

### 2. Clonar e Instalar
```bash
# Clonar el repositorio
git clone <tu-repositorio-url>
cd portal-productos-v2

# Instalar dependencias
npm install

