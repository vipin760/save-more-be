const axios = require('axios');
const cheerio = require('cheerio');
const stringSimilarity = require('string-similarity');
const puppeteer = require('puppeteer');
const { pipeline } = require('@xenova/transformers');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
};

// Main controller function
exports.searchAllPlatform = async (req, res) => {
    const { query: amazon_url } = req.query;
    try {
        // Step 1: Scrape Amazon
        const amazonData = await scrapeAmazon(amazon_url);
        if (!amazonData || !amazonData.title) {
            return res.status(400).send({
                status: false,
                message: "Failed to fetch product details from Amazon. URL may be invalid or blocked.",
            });
        }

        // Step 2: Search Walmart and eBay
        const [walmartResults, ebayResults, flipkirtResults, shopsyResults] = await Promise.all([
            searchWalmart(amazonData.title),
            searchEbay(amazonData.title),
            searchFlipkart(amazonData.title),
            searchShopsy(amazonData.title)
        ]);

        //  const [shopsyResults] = await Promise.all([
        //     searchShopsy(amazonData.title)
        // ]);
console.log("<><>shopsyResults",shopsyResults);

        // Step 3: Find best matches
        const walmartBest = await findBestMatch(amazonData.title, walmartResults);
        const ebayBest = await findBestMatch(amazonData.title, ebayResults);
        const flipkirtBest = await findBestMatch(amazonData.title, flipkirtResults, 0.45)
        const shopsyBest = await findBestMatch(amazonData.title, shopsyResults,0.45);

        // console.log("<><>flipkirtBest", flipkirtBest);
        console.log("<><>shopsyBest", shopsyBest);

        // Step 4: Build comparison result
        const comparison = [
            {
                platform: "Amazon",
                title: amazonData.title,
                price: amazonData.price,
                image: amazonData.image,
                url: amazon_url,
            },
        ];

        // if (walmartBest) {
        //     comparison.push({
        //         platform: "Walmart",
        //         title: walmartBest.title,
        //         price: walmartBest.price,
        //         url: walmartBest.url,
        //     });
        // }

        // if (ebayBest) {
        //     comparison.push({
        //         platform: "eBay",
        //         title: ebayBest.title,
        //         price: ebayBest.price,
        //         url: ebayBest.url,
        //     });
        // }
        if (flipkirtBest) {
            comparison.push({
                platform: "flipkirt",
                title: flipkirtBest.title,
                price: flipkirtBest.price,
                url: flipkirtBest.url,
                image: flipkirtBest.image
            });
        }

        if (shopsyBest) {
            comparison.push({
                platform: "shopsy",
                title: shopsyBest.title,
                price: shopsyBest.price,
                url: shopsyBest.url,
            });
        }

        // Final success response
        return res.status(200).send({
            status: true,
            message: "Price comparison fetched successfully",
            data: {
                product: amazonData.title,
                comparison: comparison,
            },
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

// =======================
// Scraping Helper Functions
// =======================

let embedder;
async function getEmbedder() {
    if (!embedder) {
        embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return embedder;
}

// Cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
    const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dot / (magA * magB);
}
// AI-Powered Best Match
async function findBestMatch(targetTitle, items, threshold = 0.75) {
    if (!items || items.length === 0) return null;

    // Clean items first - remove junk titles
    const cleanItems = items.filter(item => {
        const t = item.title.toLowerCase();
        return item.title.length > 20 &&
            !t.includes('% off') &&
            !t.startsWith('₹') &&
            /[a-zA-Z]/.test(item.title); // has letters
    });

    if (cleanItems.length === 0) return null;

    const embedder = await getEmbedder();

    // Generate embedding for target
    const targetOutput = await embedder(targetTitle, { pooling: 'mean', normalize: true });
    const targetVector = Array.from(targetOutput.data);

    let best = null;
    let bestScore = 0;

    for (const item of cleanItems) {
        const itemOutput = await embedder(item.title, { pooling: 'mean', normalize: true });
        const itemVector = Array.from(itemOutput.data);

        const score = cosineSimilarity(targetVector, itemVector);

        // Optional: Boost if exact model name match
        const lowerTarget = targetTitle.toLowerCase();
        const lowerItem = item.title.toLowerCase();
        let bonus = 0;
        if (lowerItem.includes('oneplus buds 4') && lowerTarget.includes('oneplus buds 4')) bonus += 0.2;
        if (lowerItem.includes('55db') || lowerItem.includes('anc')) bonus += 0.1;

        const finalScore = score + bonus;

        console.log(`AI Match: "${item.title.substring(0, 60)}..." → Score: ${finalScore.toFixed(3)}`);

        if (finalScore > bestScore && finalScore >= threshold) {
            bestScore = finalScore;
            best = item;
        }
    }

    console.log('AI Best Score:', bestScore.toFixed(3));
    return best;
}

function findBestMatch1(targetTitle, items, threshold = 0.6) {
    if (!items || items.length === 0) return null;

    let best = null;
    let bestScore = 0;

    items.forEach(item => {
        const score = stringSimilarity.compareTwoStrings(
            targetTitle.toLowerCase(),
            item.title.toLowerCase()
        );
        if (score > bestScore && score >= threshold) {
            bestScore = score;
            best = item;
        }
    });

    return best;
}

async function scrapeAmazon(url) {
    try {
        const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });
        const $ = cheerio.load(data);

        const title = $('#productTitle').text().trim();
        if (!title) return null;

        const priceWhole = $('.a-price-whole').first().text().replace(/[^0-9]/g, '');
        const priceFraction = $('.a-price-fraction').first().text().trim();
        const price = priceWhole ? `$${priceWhole}${priceFraction ? '.' + priceFraction : ''}` : 'Price not available';
        const image = $('#landingImage').attr('src') || $('#imgTagWrapperId img').attr('src') || 'No image found';
        return { title, price, image };
    } catch (err) {
        console.error("Amazon scrape failed:", err.message);
        return null;
    }
}

async function searchWalmart(query) {
    try {
        const searchUrl = `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, { headers: HEADERS, timeout: 10000 });
        const $ = cheerio.load(data);

        const results = [];
        $('a[data-automation-id="product-title"]').each((i, el) => {
            if (i >= 8) return; // limit results

            const title = $(el).text().trim();
            const relativeUrl = $(el).attr('href');
            const url = relativeUrl?.startsWith('http') ? relativeUrl : `https://www.walmart.com${relativeUrl}`;

            // Find price in nearby elements
            const priceEl = $(el).closest('div').find('div[data-automation-id="product-price"] .w_iUH7, span[data-automation-id="product-price"] .w_iUH7');
            const price = priceEl.text().trim() || 'N/A';

            if (title && price !== 'N/A') {
                results.push({ title, price, url });
            }
        });

        return results;
    } catch (err) {
        console.error("Walmart search failed:", err.message);
        return [];
    }
}

async function searchEbay(query) {
    try {
        const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sacat=0&LH_TitleDesc=0&rt=nc&LH_BIN=1`;
        const { data } = await axios.get(searchUrl, { headers: HEADERS, timeout: 10000 });
        const $ = cheerio.load(data);

        const results = [];
        $('.s-item').each((i, el) => {
            if (i === 0 || i >= 9) return; // skip ads and limit

            const titleEl = $(el).find('.s-item__title');
            const title = titleEl.text().trim().replace(/New Listing/gi, '');

            const price = $(el).find('.s-item__price').text().trim();
            const url = $(el).find('.s-item__link').attr('href')?.split('?')[0];

            if (title && price && url && !title.includes('Shop on eBay')) {
                results.push({ title, price, url });
            }
        });

        return results;
    } catch (err) {
        console.error("eBay search failed:", err.message);
        return [];
    }
}

async function searchFlipkart(query) {
    let browser;
    try {
        const searchUrl = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36']
        });
        const page = await browser.newPage();

        await page.setViewport({ width: 1366, height: 768 });
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
        });

        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });

        // Wait for any results or sponsored
        await page.waitForSelector('a[href*="/p/"], div._4rR01T, div._30jeq3', { timeout: 10000 }).catch(() => console.log('No quick selectors found'));

        // Use browser-side evaluation for reliable extraction (bypasses Cheerio nesting issues)
        const results = await page.evaluate(() => {
            const products = [];
            // Find all product links
            document.querySelectorAll('a[href*="/p/"]').forEach(a => {
                const tile = a.closest('div'); // Nearest div container (usually the tile)
                if (!tile) return;

                // Title: Common classes or fallback to text
                let titleEl = tile.querySelector('div._4rR01T, div.IRpwTa, div.KzDlHZ, h2, [role="heading"]');
                let title = titleEl ? titleEl.innerText.trim() : a.innerText.trim().split('\n')[0].trim();

                // Price: Common classes
                let priceEl = tile.querySelector('div._30jeq3, div._1_WHN1, div._25b18c, div._30jeq3._1_WHN1');
                let price = priceEl ? priceEl.innerText.trim() : tile.innerText.match(/₹[0-9,]+/)?.[0] || 'N/A';

                // Clean title (remove ratings, extra text)
                title = title.replace(/\s+★.*|Rated.*|Reviews.*/gi, '').trim();

                // Link
                let href = a.getAttribute('href');
                const url = href ? 'https://www.flipkart.com' + (href.startsWith('/') ? href : '/' + href) : null;

                // if (title && title.length > 10 && price !== 'N/A' && url && !title.toLowerCase().includes('sponsored')) {
                //     products.push({ title, price, url });
                // }

                let imgEl = tile.querySelector('img[src*="flipkart"], img[loading="lazy"], img');
                let image = imgEl ? imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || 'No image' : 'No image';

                // Clean image URL (Flipkart often uses low-res thumbnails; replace for higher quality if needed)
                if (image.includes('128/128')) {
                    image = image.replace('128/128', '832/832'); // Upgrade to higher res
                } else if (image.includes('200/200')) {
                    image = image.replace('200/200', '832/832');
                }

                if (title && title.length > 10 && price !== 'N/A' && url && image !== 'No image' && !title.toLowerCase().includes('sponsored')) {
                    products.push({ title, price, url, image });
                }
            });
            return products.slice(0, 8); // Limit to top 8
        });
        if (results.length > 0) {
            console.log('Sample:', results.slice(0, 2));
        } else {
            console.log('No results extracted - page may have no matching products or structure changed');
        }

        return results;
    } catch (err) {
        console.error("Puppeteer Flipkart failed:", err.message);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}


// ----------------------------------------------------------------------------------------------------
async function searchShopsy(query) {
    console.log("<><>query",query);
    
  let browser;
  try {
    const searchUrl = `https://www.shopsy.in/search?q=${encodeURIComponent(query)}`;
    console.log('Fetching Shopsy URL with Puppeteer:', searchUrl);

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });

    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 20000 });

    await page.waitForSelector('a, div._30jeq3, img', { timeout: 10000 })
      .catch(() => console.log('No elements found, continuing extraction...'));

    console.log('Shopsy page loaded – extracting products...');

    const results = await page.evaluate(() => {
      const products = [];

      // Broadest possible: All links that look like product pages
      document.querySelectorAll('a[href*="/p/"], a[href*="/pid/"], a.IRpwTa, a._2UzuFa').forEach(a => {
        if (products.length >= 10) return; // Increase limit to catch lower results

        const tile = a.closest('div') || a.parentElement;

        // Title
        let title = a.getAttribute('title') ||
                    tile.querySelector('div._4rR01T, div.KzDlHZ, div.IRpwTa, h3')?.innerText.trim() ||
                    a.innerText.trim().split('\n')[0].trim() ||
                    'N/A';

        // Price
        let price = tile.querySelector('div._30jeq3, div._1_WHN1, div._25b18c')?.innerText.trim() || 'N/A';

        // Image
        let img = tile.querySelector('img');
        let image = 'https://via.placeholder.com/300?text=No+Image';
        if (img) {
          const src = img.getAttribute('src') || '';
          const srcset = img.getAttribute('srcset') || '';
          if (srcset) {
            image = srcset.split(',').pop().trim().split(' ')[0];
          } else if (src && !src.includes('data:image')) {
            image = src;
          }
          image = image.replace(/_\d+x\d+\.jpg/, '_832x832.jpg').replace(/128\/128/, '832/832');
        }

        // URL
        let href = a.getAttribute('href');
        const url = href ? `https://www.shopsy.in${href.startsWith('/') ? href : '/' + href}` : null;

        title = title.replace(/\s+★.*/g, '').trim();

        if (title && title !== 'N/A' && price !== 'N/A' && url && title.length > 10) {
          products.push({ title, price, url, image });
        }
      });

      return products;
    });

    console.log(`Extracted ${results.length} products from Shopsy`);
    if (results.length > 0) console.log('Sample:', results.slice(0, 2));

    return results;
  } catch (err) {
    console.error('Shopsy Puppeteer failed:', err.message);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}
