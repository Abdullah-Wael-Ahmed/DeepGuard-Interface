const { DataTypes } = require("sequelize");
const db = require("../util/db");

const ThreatFeed = db.define("ThreatFeed", {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    apiKey: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'inactive',
        validate: {
            isIn: [['active', 'inactive', 'error']]
        }
    },
    lastSync: {
        type: DataTypes.DATE,
        allowNull: true
    },
    entryCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    syncInterval: {
        type: DataTypes.INTEGER,
        defaultValue: 60
    }
});

module.exports = ThreatFeed;
