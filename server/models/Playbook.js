const { DataTypes } = require("sequelize");
const db = require("../util/db");

const Playbook = db.define("Playbook", {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: "draft",
        validate: {
            isIn: [["draft", "active", "disabled"]]
        }
    },
    mitreTags: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: "[]",
        get() {
            const v = this.getDataValue("mitreTags");
            return v ? JSON.parse(v) : [];
        },
        set(v) {
            this.setDataValue("mitreTags", JSON.stringify(v));
        }
    },
    runCounter: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    nodes: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "[]",
        get() {
            const v = this.getDataValue("nodes");
            return v ? JSON.parse(v) : [];
        },
        set(v) {
            this.setDataValue("nodes", JSON.stringify(v));
        }
    },
    edges: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "[]",
        get() {
            const v = this.getDataValue("edges");
            return v ? JSON.parse(v) : [];
        },
        set(v) {
            this.setDataValue("edges", JSON.stringify(v));
        }
    },
    triggerType: {
        type: DataTypes.STRING,
        defaultValue: "manual", // manual, on_incident_created, on_alert
        allowNull: false
    },
    // Used to filter automatic triggers (e.g., only trigger on Critical severity)
    triggerConditions: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
            const v = this.getDataValue("triggerConditions");
            return v ? JSON.parse(v) : null;
        },
        set(v) {
            this.setDataValue("triggerConditions", v ? JSON.stringify(v) : null);
        }
    },
    author: {
        type: DataTypes.STRING,
        defaultValue: "admin"
    }
});

module.exports = Playbook;
