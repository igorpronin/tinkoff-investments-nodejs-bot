require('dotenv').config();
const OpenAPI = require('@tinkoff/invest-openapi-js-sdk');

const apiURL = process.env.API_URL;
const secretToken = process.env.TINKOFF_TOKEN_SECRET;
const socketURL = process.env.SOCKET_URL;

const connection = new OpenAPI({apiURL, secretToken, socketURL});

module.exports = connection;
