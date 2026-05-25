const axios = require("axios");

exports.initializePayment = async (req, res) => {
    const { email, amount } = req.body;

    try {
        const response = await axios.post(
            "https://api.paystack.co/transaction/initialize",
            {
                email,
                amount: amount * 100
            },
            {
                headers: {
                    Authorization: `Bearer YOUR_PAYSTACK_SECRET_KEY`,
                    "Content-Type": "application/json"
                }
            }
        );

        res.json({
            status: true,
            link: response.data.data.authorization_url
        });

    } catch (err) {
        res.json({ status: false, error: err.message });
    }
};
