const express = require("express");
const dotenv = require("dotenv").config();
const { neode, driver } = require('./configs/db/neo4j');

const app = express();
const port = process.env.PORT || 5000;

app.use(
    "/recommendations",
    require("./routes/recommendationRoutes"), 
);

app.listen(port, () => {
    console.log(`Server running on port ${port}`)
});