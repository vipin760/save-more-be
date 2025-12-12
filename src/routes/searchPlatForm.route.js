const express = require('express')
const routes = express()
const searchPlatFormController = require('../controllers/searchPlatForm');
routes.get('/',searchPlatFormController.searchAllPlatform)

module.exports = routes