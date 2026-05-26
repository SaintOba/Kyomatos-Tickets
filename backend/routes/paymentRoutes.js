const express = require('express');
const router = express.Router();
const axios = require('axios');

// Paystack integration (replace with your actual secret key)
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_your_key_here';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Initialize payment
router.post('/initialize', async (req, res) => {
    try {
        const { email, amount, metadata } = req.body;

        const response = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            {
                email,
                amount: amount * 100, // Convert to kobo
                metadata,
                callback_url: `${BACKEND_URL}/api/pay/verify`
            },
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            success: true,
            message: 'Payment initialized',
            data: response.data.data
        });
    } catch (error) {
        console.error('Payment initialization error:', error);
        res.status(500).json({
            success: false,
            message: 'Payment initialization failed'
        });
    }
});

// Verify payment - handles both Paystack callback and frontend verification
router.get('/verify', async (req, res) => {
    try {
        // Get reference from query params (Paystack callback)
        let reference = req.query.reference || req.query.trxref;
        
        if (!reference) {
            return res.status(400).json({
                success: false,
                message: 'Reference not provided'
            });
        }

        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
                }
            }
        );

        const paymentData = response.data.data;

        if (paymentData.status === 'success') {
            // Payment successful - if this is Paystack callback, redirect to frontend
            // Otherwise return JSON for API calls
            const isPaystackCallback = req.headers.referer && req.headers.referer.includes('paystack');
            
            if (isPaystackCallback || req.headers.accept === 'text/html') {
                // Redirect to frontend about page with reference
                return res.redirect(`${FRONTEND_URL}/about.html?reference=${reference}`);
            }
            
            res.json({
                success: true,
                message: 'Payment verified successfully',
                data: paymentData
            });
        } else {
            // Payment failed - if callback, show error page
            if (req.headers.accept === 'text/html') {
                return res.send(`
                    <html>
                    <head>
                        <title>Payment Failed</title>
                        <style>
                            body { font-family: Arial; background: #f0f0f0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                            .container { background: white; padding: 40px; border-radius: 10px; text-align: center; }
                            h1 { color: #d32f2f; }
                            p { color: #666; margin: 20px 0; }
                            a { color: #1976d2; text-decoration: none; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>❌ Payment Failed</h1>
                            <p>Your payment could not be processed.</p>
                            <p><a href="${FRONTEND_URL}/about.html">← Return to Event</a></p>
                        </div>
                    </body>
                    </html>
                `);
            }
            
            res.status(400).json({
                success: false,
                message: 'Payment verification failed'
            });
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        
        if (req.headers.accept === 'text/html') {
            return res.send(`
                <html>
                <head>
                    <title>Payment Error</title>
                    <style>
                        body { font-family: Arial; background: #f0f0f0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                        .container { background: white; padding: 40px; border-radius: 10px; text-align: center; }
                        h1 { color: #d32f2f; }
                        p { color: #666; margin: 20px 0; }
                        a { color: #1976d2; text-decoration: none; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>⚠️ Payment Error</h1>
                        <p>An error occurred while processing your payment.</p>
                        <p><a href="${FRONTEND_URL}/about.html">← Return to Event</a></p>
                    </div>
                </body>
                </html>
            `);
        }
        
        res.status(500).json({
            success: false,
            message: 'Payment verification failed'
        });
    }
});

// Alternative verify endpoint for API calls (query param format)
router.get('/verify/:reference', async (req, res) => {
    try {
        const { reference } = req.params;

        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
                }
            }
        );

        if (response.data.data.status === 'success') {
            res.json({
                success: true,
                message: 'Payment verified successfully',
                data: response.data.data
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Payment verification failed'
            });
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Payment verification failed'
        });
    }
});

module.exports = router;
