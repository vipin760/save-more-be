exports.generateAmazonAffiliateLink = (productUrl, tag) => {
  const url = new URL(productUrl);
  url.searchParams.set("tag", tag);
  return url.toString();
}