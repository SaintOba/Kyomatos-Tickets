const express = require('express');
const router = express.Router();
const axios = require('axios');

// Paystack integration (replace with your actual secret key)
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_your_key_here';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

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

// Verify payment
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
