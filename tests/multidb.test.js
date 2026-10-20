'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { getDbConfig } = require('../netlify/functions/lib/db');

test('getDbConfig resolves form-specific Google Apps Script endpoints', () => {
  const oldEnv = { ...process.env };
  process.env.GS_URL_FORM1 = 'https://script.google.com/macros/s/gas1/exec';
  process.env.GS_URL_FORM2 = 'https://script.google.com/macros/s/gas2/exec';
  process.env.GS_URL_FORM3 = 'https://script.google.com/macros/s/gas3/exec';

  const cfg1 = getDbConfig(1);
  assert.equal(cfg1.url, 'https://script.google.com/macros/s/gas1/exec');
  assert.equal(cfg1.form, 1);

  const cfg2 = getDbConfig(2);
  assert.equal(cfg2.url, 'https://script.google.com/macros/s/gas2/exec');
  assert.equal(cfg2.form, 2);

  const cfg3 = getDbConfig(3);
  assert.equal(cfg3.url, 'https://script.google.com/macros/s/gas3/exec');
  assert.equal(cfg3.form, 3);

  const cfgViewArrivals = getDbConfig('arrivees');
  assert.equal(cfgViewArrivals.url, 'https://script.google.com/macros/s/gas2/exec');
  assert.equal(cfgViewArrivals.form, 2);

  const cfgViewExcursion = getDbConfig('excursion');
  assert.equal(cfgViewExcursion.url, 'https://script.google.com/macros/s/gas3/exec');
  assert.equal(cfgViewExcursion.form, 3);

  process.env = oldEnv;
});
