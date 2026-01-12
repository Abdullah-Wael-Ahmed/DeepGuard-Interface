const User = require('../models/User'); // Adjust path to your User model
const bcrypt = require('bcrypt');

const seedSuperAdmin = async () => {
    try {
        // Check if ANY admin exists
        const adminExists = await User.findOne({ where: { role: 'admin' } });

        if (!adminExists) {
            console.log('⚡ No admin found. Creating Super Admin...');
            
            const hashedPassword = await bcrypt.hash('Password#1', 10);
            
            await User.create({
                name: 'Super Admin',
                email: 'admin@deepguard.sec',
                password: hashedPassword,
                role: 'admin'
            });
            console.log('✅ Super Admin created: admin@deepguard.sec / Password#1');
        } else {
            console.log('✔ Admin check passed.');
        }
    } catch (error) {
        console.error('❌ Seeder failed:', error);
    }
};

module.exports = { seedSuperAdmin };