const app = require('./app');
require('dotenv').config();

// Handling uncaughtException
process.on("uncaughtException", err => {
    console.log(`Error: ${err.message}`);
    console.log('Shutting down the server due to uncaughtException');
    process.exit(1);
});

// Config
// if(process.env.NODE_ENV !== "PRODUCTION"){
//     require("dotenv").config({
//         path: "config/.env"
//     });
// }

const port = process.env.PORT;

// Wrap server startup in async function
async function startServer() {
//    await clearAllTables()
    try {
        // Start the server
        const server = app.listen(port, () => {
            console.log(`Server connected on port ${port}`);
        });

        // Unhandled Promise Rejection
        process.on("unhandledRejection", err => {
            console.log(`Error: ${err.message}`);
            console.log('Shutting down the server due to unhandled promise rejection');
            server.close(() => {
                process.exit(1);
            });
        });

    } catch (err) {
        console.error("Error during server startup:", err);
        process.exit(1);
    }
}

startServer();
