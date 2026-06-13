const { DataTypes } = require("sequelize");
const db = require("../util/db");

const Evidence = db.define("Evidence", {
    incidentId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [["alert", "ioc", "log", "note", "network_flow", "screenshot", "file", "url"]]
        }
    },
    referenceId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    metadata: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
            const value = this.getDataValue("metadata");
            return value ? JSON.parse(value) : null;
        },
        set(value) {
            this.setDataValue("metadata", value ? JSON.stringify(value) : null);
        }
    },
    addedBy: {
        type: DataTypes.STRING,
        defaultValue: "system"
    }
});

module.exports = Evidence;
