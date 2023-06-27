const asyncHandler = require("express-async-handler");
const { neode, driver } = require("../configs/db/neo4j");

const getMangaRecommendation = asyncHandler(async (req, res) => {
    const { user_id } = req.query;
    const checkUserInteractive = `
        MATCH (p: User { _id: $user_id })-[r:INTERACTIVE]-(:Manga)
        WITH COUNT(r) as interactive
        RETURN
        CASE
        WHEN interactive > 0
        THEN true
        ELSE false END AS isInteractive
    `;

    const session_first = driver.session();
    let result_first = null;
    try {
        result_first = await session_first.run(checkUserInteractive, {
            user_id,
        });
    } catch (e) {
        result_first = null;
    } finally {
        session_first.close();
    }
    let query = '';
    if (result_first && result_first.records && result_first.records.length > 0 && result_first.records[0].get('isInteractive')) {
        query = `
            MATCH (p1:User { _id: $user_id })-[r:INTERACTIVE]->(t:Manga)
            WITH p1, AVG(r.score) AS p1_mean
            MATCH (p1)-[r1:INTERACTIVE]->(t:Manga)<-[r2:INTERACTIVE]-(p2:User)
            WITH p1, p1_mean, p2, COLLECT({r1: r1, r2: r2}) AS ratings WHERE size(ratings) > 0
            MATCH (p2)-[r:INTERACTIVE]->(t:Manga)
            WITH p1, p1_mean, p2, avg(r.score) AS p2_mean, ratings
            UNWIND ratings AS r
            WITH SUM((r.r1.score - p1_mean) * (r.r2.score - p2_mean)) AS nom,
               SQRT( SUM( (r.r1.score - p1_mean)^2) * sum( (r.r2.score - p2_mean) ^2)) AS denom,
               p1, p2
            WHERE denom <> 0
            WITH p1, p2, nom/denom AS pearson_similarty
            WITH p1, p2, pearson_similarty
            ORDER BY pearson_similarty DESC
            LIMIT 15
            OPTIONAL MATCH (p2)-[r:INTERACTIVE]->(t:Manga) WHERE NOT EXISTS( (p1)-[:INTERACTIVE]->(t) )
            RETURN t._id as _id, SUM( pearson_similarty * r.score) AS recommendation
            ORDER BY recommendation DESC LIMIT 9
        `;
    } else {
        query = `
            MATCH (p: User { _id: $user_id })-[r:SIMILAR]-(other:User)
            WITH other, SUM(r.score) as similar_score
            ORDER BY similar_score DESC LIMIT 15
            OPTIONAL MATCH (other)-[r1:INTERACTIVE]-(m:Manga)
            WITH m, similar_score, SUM(r1.score) as recommendation
            ORDER BY recommendation + similar_score DESC
            RETURN m._id as _id, recommendation
            LIMIT 9
        `;
    }

    const session = driver.session();
    let result = null;
    try {
        result = await session.run(query, {
            user_id,
        });
    } catch (e) {
        console.log(e);
        result = null;
    } finally {
        session.close();
    }
    var manga_list_id = []
    if (result) {
        const manga_list = result.records.map(record => {
            return {
                _id: record.get('_id'),
                recommendation: record.get('recommendation')
            }
        });
        manga_list_id = manga_list.map(manga => manga._id);
    }
    res.status(200).json(manga_list_id);
});

module.exports = { getMangaRecommendation };