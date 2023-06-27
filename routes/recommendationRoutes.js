const express = require("express");
const router = express.Router();
const { getMangaRecommendation } = require("../controllers/recommendationController");

router.route("/manga")
    .get(getMangaRecommendation);

module.exports = router;