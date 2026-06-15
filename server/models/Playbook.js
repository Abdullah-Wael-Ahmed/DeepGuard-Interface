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
        defaultValue: "disabled",
        validate: {
            isIn: [["draft", "active", "disabled"]]
        }
    },
    mitreTags: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
            const v = this.getDataValue("mitreTags");
            if (!v) return [];
            try {
                let parsed = JSON.parse(v);
                if (typeof parsed === "string") parsed = JSON.parse(parsed);
                return parsed;
            } catch(e) { return []; }
        },
        set(v) {
            this.setDataValue("mitreTags", typeof v === "string" ? v : JSON.stringify(v));
        }
    },
    runCounter: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    nodes: {
        type: DataTypes.TEXT,
        allowNull: false,
        get() {
            const v = this.getDataValue("nodes");
            if (!v) return [];
            try {
                let parsed = JSON.parse(v);
                if (typeof parsed === "string") parsed = JSON.parse(parsed);
                return parsed;
            } catch(e) { return []; }
        },
        set(v) {
            this.setDataValue("nodes", typeof v === "string" ? v : JSON.stringify(v));
        }
    },
    edges: {
        type: DataTypes.TEXT,
        allowNull: false,
        get() {
            const v = this.getDataValue("edges");
            if (!v) return [];
            try {
                let parsed = JSON.parse(v);
                if (typeof parsed === "string") parsed = JSON.parse(parsed);
                return parsed;
            } catch(e) { return []; }
        },
        set(v) {
            this.setDataValue("edges", typeof v === "string" ? v : JSON.stringify(v));
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
            if (!v) return null;
            try {
                let parsed = JSON.parse(v);
                if (typeof parsed === "string") parsed = JSON.parse(parsed);
                return parsed;
            } catch(e) { return null; }
        },
        set(v) {
            this.setDataValue("triggerConditions", (typeof v === "string" || !v) ? v : JSON.stringify(v));
        }
    },
    author: {
        type: DataTypes.STRING,
        defaultValue: "admin"
    }
});

module.exports = Playbook;
