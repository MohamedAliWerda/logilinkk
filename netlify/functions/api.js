'use strict';

const path = require('path');
// Load backend/.env before NestJS initializes so all env vars (Supabase, JWT, etc.) are available.
// dotenv/config inside serverless.ts resolves relative to process.cwd() (project root),
// which is NOT the backend directory, so we must point it explicitly here.
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });

let handler = null;

exports.handler = async (event, context) => {
  if (!handler) {
    const { createServerlessHandler } = require('../../backend/dist/serverless');
    handler = await createServerlessHandler();
  }
  return handler(event, context);
};
