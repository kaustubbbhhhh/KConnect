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

// @route   GET /api/meetings
// @desc    Get all meetings for current user
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const meetings = await Meeting.find({ 
            $and: [
                {
                    $or: [
                        { host: req.user._id },
                        { participants: req.user._id }
                    ]
                },
                {
                    $or: [
                        { isScheduled: true },
                        { status: 'active' }
                    ]
                }
            ]
        }).sort({ createdAt: -1 });
        res.json(meetings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/meetings
// @desc    Create a new meeting
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        const { title, startTime, meetingId, password } = req.body;
        
        // If no ID provided, generate one
        const finalMeetingId = meetingId || makeId(10);

        // Check if ID already exists
        const existing = await Meeting.findOne({ meetingId: finalMeetingId });
        if (existing) {
            return res.status(400).json({ message: 'Meeting ID already in use. Try a different one.' });
        }

        const meeting = await Meeting.create({
            title: title || 'Instant Meeting',
            host: req.user._id,
            participants: [req.user._id],
            meetingId: finalMeetingId,
            password: password || '',
            startTime: startTime || Date.now(),
            isScheduled: req.body.isScheduled || false
        });

        res.status(201).json(meeting);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/meetings/join
// @desc    Verify meeting ID and password to join
// @access  Private
router.post('/join', protect, async (req, res) => {
    try {
        const { meetingId, password } = req.body;
        
        const meeting = await Meeting.findOne({ meetingId });
        
        if (!meeting) {
            return res.status(404).json({ message: 'Meeting not found' });
        }

        if (meeting.status === 'ended') {
            return res.status(403).json({ message: 'This meeting has already ended' });
        }

        if (meeting.password && meeting.password !== password) {
            return res.status(401).json({ message: 'Incorrect meeting password' });
        }

        // Add user to participants if not already there
        if (!meeting.participants.includes(req.user._id)) {
            meeting.participants.push(req.user._id);
            await meeting.save();
        }

        res.json({ message: 'Joined successfully', meeting });
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
            if (meeting.status === 'ended') {
                return res.status(403).json({ message: 'Meeting has ended' });
            }
            res.json(meeting);
        } else {
            res.status(404).json({ message: 'Meeting not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   DELETE /api/meetings/:id
// @desc    Delete a meeting
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const meeting = await Meeting.findOne({ meetingId: req.params.id });
        
        if (!meeting) {
            return res.status(404).json({ message: 'Meeting not found' });
        }

        // Only host can delete
        if (meeting.host.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'User not authorized to delete this meeting' });
        }

        await Meeting.deleteOne({ meetingId: req.params.id });
        res.json({ message: 'Meeting removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/meetings/:id/end
// @desc    End a meeting
// @access  Private
router.post('/:id/end', protect, async (req, res) => {
    try {
        const meeting = await Meeting.findOne({ meetingId: req.params.id });
        
        if (!meeting) {
            return res.status(404).json({ message: 'Meeting not found' });
        }

        if (meeting.host.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Only host can end meeting' });
        }

        meeting.status = 'ended';
        await meeting.save();
        
        res.json({ message: 'Meeting ended' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
