const { DataTypes } = require("sequelize")
const db = require("../util/db")

const Alert = db.define("Alert", {
    timestamp: { type: DataTypes.STRING, allowNull: false },
    src_ip: { type: DataTypes.STRING, allowNull: false },
    src_port: { type: DataTypes.INTEGER, allowNull: true },
    dest_ip: { type: DataTypes.STRING, allowNull: false },
    dest_port: { type: DataTypes.INTEGER, allowNull: true },
    signature: { type: DataTypes.STRING, allowNull: true },
    severity: { type: DataTypes.INTEGER, validate: { min: 1, max:3} },
    protocol: {type: DataTypes.STRING, allowNull: false}
}) 

module.exports = Alert
