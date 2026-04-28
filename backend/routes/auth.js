const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');
const nodemailer = require('nodemailer');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Email Transporter Setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Helper: Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @route   POST /api/auth/register
// @desc    Register user and send OTP
// @access  Public
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        const user = await User.create({
            firstName,
            lastName,
            username: `${firstName} ${lastName}`,
            email,
            password,
            otp,
            otpExpires
        });

        if (user) {
            // Send OTP Email
            const mailOptions = {
                from: `"KConnect" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: 'KConnect - Email Verification OTP',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
                        <div style="max-width: 600px; margin: auto; background: white; padding: 40px; border-radius: 10px;">
                            <h2 style="color: #000;">Verify Your Email</h2>
                            <p>Hi ${firstName},</p>
                            <p>Welcome to KConnect! Please use the following OTP to verify your email address. This code is valid for 15 minutes.</p>
                            <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; text-align: center; padding: 20px; background: #f0f0f0; border-radius: 5px; margin: 20px 0;">
                                ${otp}
                            </div>
                            <p>If you did not request this, please ignore this email.</p>
                            <p>Best regards,<br/>The KConnect Team</p>
                        </div>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);

            res.status(201).json({
                message: 'Registration successful. Please check your email for OTP.',
                email: user.email
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and activate account
// @access  Public
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: 'Account already verified' });
        }

        if (user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
            participantId: user.participantId,
            token: generateToken(user._id),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/auth/login
// @desc    Authenticate user
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            if (!user.isVerified) {
                return res.status(401).json({ 
                    message: 'Please verify your email before logging in.',
                    unverified: true,
                    email: user.email
                });
            }

            // Backfill participantId and names for existing users
            if (!user.participantId || !user.firstName || !user.lastName) {
                if (!user.firstName) user.firstName = user.username ? user.username.split(' ')[0] : 'Existing';
                if (!user.lastName) {
                    const parts = user.username ? user.username.split(' ') : [];
                    user.lastName = parts.length > 1 ? parts.slice(1).join(' ') : 'User';
                }
                await user.save(); // pre-save hook will generate participantId if missing
            }

            res.json({
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email,
                profilePicture: user.profilePicture,
                participantId: user.participantId,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/auth/google
// @desc    Google OAuth2 login/register
// @access  Public
router.post('/google', async (req, res) => {
    try {
        const { credential } = req.body;
        
        if (!credential) {
            return res.status(400).json({ message: 'No credential provided' });
        }

        // Verify the token with Google
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name;
        const picture = payload.picture;

        let user = await User.findOne({ email });

        if (!user) {
            // For google login, password is required by schema, generate a random complex one
            const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
            user = await User.create({
                firstName: name ? name.split(' ')[0] : 'Google',
                lastName: name ? name.split(' ').slice(1).join(' ') : 'User',
                username: name || email.split('@')[0],
                email: email,
                password: randomPassword,
                profilePicture: picture,
                isVerified: true // Google accounts are pre-verified
            });
        } else if (!user.participantId || !user.firstName || !user.lastName) {
            // Backfill participantId and names for existing Google users
            if (!user.firstName) user.firstName = name ? name.split(' ')[0] : 'Google';
            if (!user.lastName) {
                const parts = name ? name.split(' ') : [];
                user.lastName = parts.length > 1 ? parts.slice(1).join(' ') : 'User';
            }
            await user.save();
        }

        res.json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
            participantId: user.participantId,
            token: generateToken(user._id),
        });

    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(500).json({ message: `Google Authentication Failed: ${error.message}` });
    }
});

module.exports = router;
