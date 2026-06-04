'use strict';

let handler = null;

exports.handler = async (event, context) => {
  if (!handler) {
    const { createServerlessHandler } = require('../../backend/dist/serverless');
    handler = await createServerlessHandler();
  }
  return handler(event, context);
};
