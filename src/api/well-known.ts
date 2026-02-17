// well-known.ts

// This file implements the .well-known endpoints for Matrix federation discovery.

import { Request, Response } from 'express';

typedef WellKnownResponse = {  
    "m.server": string;  
};

// Endpoint for .well-known
export const wellKnownHandler = (req: Request, res: Response) => {  
    const response: WellKnownResponse = {  
        "m.server": "matrix.example.com" // Replace with actual Matrix server URL  
    };  
    res.json(response);  
}; 

// Note: To use this handler, you need to set up an Express route:  
// app.get('/.well-known/matrix/server', wellKnownHandler);  
