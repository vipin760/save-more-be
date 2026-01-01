const express = require('express')
const cors = require('cors')
const errorMiddleare = require('./middleware/error')
const path = require('path')
const morgan = require('morgan');
const app = express()

app.use('/uploads', express.static(path.join(__dirname,'..', 'uploads')));
// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(morgan('dev'));
//routes
const indexRoutes = require('./routes/index');
const searchPlatFormRoutes = require('./routes/searchPlatForm.route');
const authRoutes = require('./routes/auth.route');
const { connectDB } = require('./config/database');
const cookieParser = require("cookie-parser");
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: "http://localhost:3000", 
    credentials: true
  }));
app.use(express.urlencoded({ extended: true }));
connectDB()

app.use("/", indexRoutes);
app.use("/search", searchPlatFormRoutes);
app.use("/api/auth", authRoutes);

//error middleware
app.use(errorMiddleare);

module.exports = app