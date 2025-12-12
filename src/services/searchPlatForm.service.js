// amazonPaapiIndia.js
const axios = require('axios');
const aws4 = require('aws4');

const ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const SECRET_KEY = process.env.AWS_SECRET_KEY;
const PARTNER_TAG = process.env.ASSOCIATE_TAG; // Your India Associate Tag
const HOST = 'webservices.amazon.in';
const REGION = 'us-west-2'; // India region for PA-API

/**
 * Fetch Amazon product details by ASINs or search keyword
 * @param {string|string[]} query - ASIN(s) array or a keyword string
 * @param {number} [limit=5] - max results for keyword search
 */
async function fetchPlatformData(query, limit = 5) {
  try {
    let endpoint = '';
    let body = {};

    if (Array.isArray(query) || /^[A-Z0-9]{10}$/.test(query)) {
      // ASIN(s) request
      const itemIds = Array.isArray(query) ? query : [query];
      endpoint = '/paapi5/getitems';
      body = {
        ItemIds: itemIds,
        PartnerTag: PARTNER_TAG,
        PartnerType: 'Associates',
        Resources: [
          'Images.Primary.Large',
          'ItemInfo.Title',
          'ItemInfo.Features',
          'Offers.Listings.Price',
          'Offers.Listings.Savings'
        ]
      };
    } else {
      // Search by keyword
      endpoint = '/paapi5/searchitems';
      body = {
        Keywords: query,
        PartnerTag: PARTNER_TAG,
        PartnerType: 'Associates',
        SearchIndex: 'All',
        ItemCount: limit,
        Resources: [
          'Images.Primary.Large',
          'ItemInfo.Title',
          'ItemInfo.Features',
          'Offers.Listings.Price',
          'Offers.Listings.Savings'
        ]
      };
    }

    const requestOptions = {
      host: HOST,
      method: 'POST',
      path: endpoint,
      service: 'ProductAdvertisingAPI',
      region: REGION,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(body)
    };

    // Sign the request
    aws4.sign(requestOptions, { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY });

    const { data } = await axios({
      method: 'POST',
      url: `https://${HOST}${endpoint}`,
      headers: requestOptions.headers,
      data: body
    });

    // Extract items
    const items = (data.ItemsResult?.Items || data.SearchResult?.Items || []).map(item => ({
      asin: item.ASIN,
      title: item.ItemInfo?.Title?.DisplayValue || '',
      description: item.ItemInfo?.Features?.DisplayValues?.join(', ') || '',
      price: item.Offers?.Listings?.[0]?.Price?.DisplayAmount || '',
      discountPrice: item.Offers?.Listings?.[0]?.Price?.Amount || '',
      images: item.Images?.Primary?.Large?.URL || '',
      offerPercent: item.Offers?.Listings?.[0]?.Price?.Savings?.Percentage || 0
    }));

    return items;

  } catch (error) {
    console.error('Amazon PA-API error:', error.response?.data || error.message);
    return [];
  }
}

module.exports = { fetchPlatformData };
