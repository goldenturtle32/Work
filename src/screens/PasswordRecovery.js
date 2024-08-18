app.post('/password-recovery', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        // Generate a password reset token (pseudo-code)
        const resetToken = generateResetToken(user._id);

        // Send reset link via email (pseudo-code)
        sendPasswordResetEmail(email, resetToken);

        res.json({ message: 'Password reset link sent!' });
    } catch (error) {
        res.status(500).json({ message: 'Error in password recovery' });
    }
});
