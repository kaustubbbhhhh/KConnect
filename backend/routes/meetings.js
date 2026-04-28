const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const { protect } = require('../middleware/auth');

// Generate short ID
const makeId = (length) => {
    let result = '';
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// @route   POST /api/meetings
// @desc    Create a new meeting
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        const { title, startTime } = req.body;
        
        const meetingId = makeId(10); // like zoom or meet id

        const meeting = await Meeting.create({
            title: title || 'Instant Meeting',
            host: req.user._id,
            participants: [req.user._id],
            meetingId,
            startTime: startTime || Date.now()
        });

        res.status(201).json(meeting);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   GET /api/meetings/:id
// @desc    Get meeting details
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const meeting = await Meeting.findOne({ meetingId: req.params.id }).populate('host', 'username profilePicture');
        
        if (meeting) {
            res.json(meeting);
        } else {
            res.status(404).json({ message: 'Meeting not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
