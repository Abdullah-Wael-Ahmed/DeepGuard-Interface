const { DataTypes } = require("sequelize");
const db = require("../util/db");

const BlockedIP = db.define("BlockedIP", {
    ip: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    reason: {
        type: DataTypes.STRING,
        allowNull: false
    },
    source: {
        type: DataTypes.STRING,
        defaultValue: 'manual'
    },
    autoBlocked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
});

module.exports = BlockedIP;
