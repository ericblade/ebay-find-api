const Ebay = require('ebay');

const forceArray = arr => [].concat(arr !== undefined ? arr : []);

let ebay = null;
/**
 * Initialize ebay-find-api
 *
 * @param {object} config
 * @param {object} config.appId - ebay API application identifier (obtained from eBay dev site)
 */
const init = ({ appId }) => {
    ebay = new Ebay({
        app_id: appId,
    });
};

// list of find operations: http://developer.ebay.com/devzone/finding/CallRef/index.html

const productIdTypes = [
    'ReferenceID',
    'ISBN',
    'UPC',
    'EAN',
];

/**
 * Simple flatten object of arrays to flat object, stops when hits array.length !== 1
 *
 * @private
 * @param {any} arr
 * @returns
 */
const flatten = (arr) => {
    for (r in arr) {
        if (Array.isArray(arr[r]) && arr[r].length === 1)
            arr[r] = flatten(arr[r][0]);
    }
    return arr;
}

/**
 * @typedef pagination
 * Detailed information about pagination results in a search
 * @param {integer} pageNumber - pageNumber returned in this search
 * @param {integer} entriesPerPage - number of entries returned per page
 * @param {integer} totalPages - total number of pages available in this search
 * @param {integer} totalEntries - total number of entries available in this search
 */

/**
 * @typedef productSearchResult
 * Contains the results of a product search
 *
 * @param {string} ack - 'Failure' for operation success
 * @param {string} version - Version number of API response - ex: 1.13.0
 * @param {string} timestamp - UTC string timestamp of response
 * @param {integer} searchResultCount - number of results found (may be different from searchResult.length, via pagination)
 * @param {searchResult[]} searchResult - array of the found items/listings
 * @param {pagination} pagination - detailed info about paging results
 * @param {string} intemSearchUrl - the URL to perform the same search on the eBay site
 */

/**
 * Search for items based on product identifier
 *
 * @param {string} type - 'ReferenceID', 'ISBN', 'UPC', 'EAN'
 * @param {string} id - product identifier code (such as a upc code)
 * @param {object} other - other parameters to supply, see http://developer.ebay.com/devzone/finding/CallRef/findItemsByProduct.html
 * @returns {productSearchResult} - product search results
 */
const findItemsByProduct = (type, id, other = {}) => {
    if (!ebay) {
        throw new Error('call ebay-find-api init first');
    }
    if (!productIdTypes.includes(type)) {
        throw new Error(`unknown type ${type}, use ReferenceID, ISBN, UPC, or EAN`);
    }
    return new Promise((resolve, reject) => {
        const params = {
            ...other,
            'OPERATION-NAME': 'findItemsByProduct',
            'productId.@type': type,
            productId: id,
        };
        ebay.get('finding', params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                const { findItemsByProductResponse: response } = flatten(data);

                if (!response) {
                    // Sometimes, a response will come back 100% empty. That's not awesome.
                    reject(new Error('eBay Response Empty'));
                    return;
                }

                const {
                    ack,
                    version,
                    timestamp,
                    searchResult,
                    paginationOutput,
                    itemSearchURL,
                } = response;

                if (searchResult && searchResult.item)
                    searchResult.item = forceArray(searchResult.item);

                if (ack === 'Failure') {
                    reject(response);
                } else {
                    resolve({
                        ack,
                        version,
                        timestamp,
                        searchResultCount: parseInt(searchResult['@count'], 10) || 0,
                        searchResult: searchResult && searchResult.item ? searchResult.item.map(flatten) : [],
                        paginationOutput,
                        itemSearchUrl: itemSearchURL,
                    });
                }
            }
        });
    });
};

/**
 * Search for items based on product UPC code
 *
 * @param {string} upc - product upc code
 * @param {object} other - other parameters, see http://developer.ebay.com/devzone/finding/CallRef/findItemsByProduct.html
 */
const findItemsByUpc = findItemsByProduct.bind(this, 'UPC');

module.exports = {
    init,
    findItemsByProduct,
    findItemsByUpc,
};
