// setupTests.js — Jest setup for browser API mocks
require('@testing-library/jest-dom'); // adds toBeInTheDocument etc.

global.fetch = require('node-fetch'); // mock fetch for Firebase
global.Response = require('node-fetch').Response; // mock Response for Firebase
global.TextEncoder = require('util').TextEncoder; // mock TextEncoder for React Router/Firebase