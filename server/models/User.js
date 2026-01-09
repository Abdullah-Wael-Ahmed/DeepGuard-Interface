const { DataTypes } = require("sequelize")
const db = require("../util/db")

const User = db.define("User", {
    name: { 
        type: DataTypes.STRING,
        allowNull: false
    },
    email: { 
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
    },
    password: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    role: { 
        type: DataTypes.STRING,
        defaultValue: "operator",
        allowNull: false
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: "active"
    }
})

module.exports = User