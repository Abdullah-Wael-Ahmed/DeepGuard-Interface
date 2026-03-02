const User = require('./models/User');
const db = require('./util/db');

const checkAdmin = async () => {
    try {
        await db.sync();
        const admin = await User.findOne({ where: { role: 'admin' } });
        
        if (admin) {
            console.log('✅ Admin user found!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('  Name:', admin.name);
            console.log('  Email:', admin.email);
            console.log('  Role:', admin.role);
            console.log('  Status:', admin.status);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('\n🔐 LOGIN CREDENTIALS:');
            console.log('  Email: admin@deepguard.sec');
            console.log('  Password: Password#1');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        } else {
            console.log('❌ No admin user found');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkAdmin();
