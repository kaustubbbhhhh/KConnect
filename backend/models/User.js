const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Generate unique participant ID
const generateParticipantId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'KC-';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: false, // Optional now
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  participantId: {
    type: String,
    unique: true,
    sparse: true // Allows null for existing users until backfilled
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  otp: String,
  otpExpires: Date,
  profilePicture: {
    type: String, 
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Generate participantId before saving if not set
UserSchema.pre('save', async function() {
    if (!this.participantId) {
        // Generate and ensure uniqueness
        let id = generateParticipantId();
        let exists = await this.constructor.findOne({ participantId: id });
        while (exists) {
            id = generateParticipantId();
            exists = await this.constructor.findOne({ participantId: id });
        }
        this.participantId = id;
    }

    if (!this.isModified('password')) return;
    
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
