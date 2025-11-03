import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateJWT } from '../middleware/authenticateJWT.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();


// Ejemplo: proteger la página de chat detrás de JWT cuando se sirve desde el backend
router.get('/', authenticateJWT, (req, res) => {
res.sendFile(path.join(__dirname, '..', 'public', 'chat.html'));
});


export default router;