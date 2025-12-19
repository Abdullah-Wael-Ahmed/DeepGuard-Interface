const { DataTypes } = require("sequelize");
const db = require("../util/db");

const IOC = db.define("IOC", {
    type: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [['ip', 'domain', 'hash', 'url']]
        }
    },
    value: {
        type: DataTypes.STRING,
        allowNull: false
    },
    threat: {
        type: DataTypes.STRING,
        allowNull: true
    },
    severity: {
        type: DataTypes.STRING,
        defaultValue: 'medium',
        validate: {
            isIn: [['critical', 'high', 'medium', 'low', 'info']]
        }
    },
    source: {
        type: DataTypes.STRING,
        allowNull: true
    },
    confidence: {
        type: DataTypes.INTEGER,
        defaultValue: 50
    },
    firstSeen: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    lastSeen: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    metadata: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
            const value = this.getDataValue('metadata');
            return value ? JSON.parse(value) : null;
        },
        set(value) {
            this.setDataValue('metadata', value ? JSON.stringify(value) : null);
        }
    }
});

module.exports = IOC;
