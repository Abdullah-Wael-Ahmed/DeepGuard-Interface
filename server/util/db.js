const { Sequelize } = require("sequelize");

const db = new Sequelize({
    dialect: "sqlite",
    storage: "./deepguard.sqlite",
    logging: false
});

module.exports = db ;
