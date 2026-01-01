const express = require('express')
const routes = express()
const authController = require('../controllers/auth.controller');
routes.post('/register',authController.RegisterUser)
routes.post('/login',authController.loginUser)
routes.get('/me',authController.getMe)
routes.get('/logout',authController.logoutUser)

module.exports = routes