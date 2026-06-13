const { DataTypes } = require("sequelize");
const db = require("../util/db");

const PlaybookExecution = db.define("PlaybookExecution", {
    playbookId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: "running", // running, success, failed, partial, awaiting_approval, rejected
        validate: {
            isIn: [["running", "success", "failed", "partial", "awaiting_approval", "rejected"]]
        }
    },
    triggerSource: {
        type: DataTypes.STRING,
        allowNull: false // manual, automated
    },
    contextData: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
            const v = this.getDataValue("contextData");
            return v ? JSON.parse(v) : {};
        },
        set(v) {
            this.setDataValue("contextData", JSON.stringify(v));
        }
    },
    logs: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: "[]",
        get() {
            const v = this.getDataValue("logs");
            return v ? JSON.parse(v) : [];
        },
        set(v) {
            this.setDataValue("logs", JSON.stringify(v));
        }
    },
    startedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
});

module.exports = PlaybookExecution;
