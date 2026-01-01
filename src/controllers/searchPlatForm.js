const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { generateAmazonAffiliateLink } = require('../services/generateAffiliateLink');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
};

// Main controller function
exports.searchAllPlatform = async (req, res) => {
    let fetchObj = {}
    const { query: amazon_url } = req.query;
    try {
       const genUrl = generateAmazonAffiliateLink(amazon_url,"savemore760-21")
        // Final success response
        return res.status(200).send({
            status: true,
            genUrl,
            message: "Price comparison fetched successfully",
            data:fetchObj
        });
    } catch (error) {
        console.error("Error in searchAllPlatform:", error.message);
        return res.status(500).send({
            status: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};
