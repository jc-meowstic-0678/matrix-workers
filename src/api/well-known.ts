import express from 'express';

const router = express.Router();

// Well-known endpoint for Matrix federation
router.get('/.well-known/matrix/server', (req, res) => {
    res.json({
        names: ["matrix.org"], // Replace with your server name
        "alt-serv": {
            "matrix": [
                {
                    "host": "your-federation-server.com", // Replace with your federation server
                    "port": 443,
                    "transport": "websocket"
                }
            ]
        }
    });
});

export default router;