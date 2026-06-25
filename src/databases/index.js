const { QuickDB } = require("quick.db");
const { owner } = require("../../config.json");

const lg = new QuickDB({ filePath: "./src/databases/logs.sqlite" });

module.exports = {
    lg,
    owner
};
