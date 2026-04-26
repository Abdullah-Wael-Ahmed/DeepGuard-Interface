const { DataTypes } = require("sequelize");
const db = require("../util/db");

const IncidentEvent = db.define("IncidentEvent", {
    incidentId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [[
                "created", "status_change", "severity_change", "priority_change",
                "assigned", "unassigned", "comment", "evidence_added",
                "evidence_removed", "tag_added", "tag_removed", "escalated",
                "sla_updated", "closed", "reopened"
            ]]
        }
    },
    actor: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "system"
    },
    actorId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    details: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
            const value = this.getDataValue("details");
            return value ? JSON.parse(value) : null;
        },
        set(value) {
            this.setDataValue("details", value ? JSON.stringify(value) : null);
        }
    }
});

module.exports = IncidentEvent;
