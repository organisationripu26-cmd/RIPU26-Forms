'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { getDbConfig } = require('../netlify/functions/lib/db');

test('getDbConfig returns single DB fallback when no specific env vars set', () => {
  const oldEnv = { ...process.env };
  delete process.env.SUPABASE_URL_FORM1;
  delete process.env.SUPABASE_URL_FORM2;
  delete process.env.SUPABASE_URL_FORM3;
  process.env.SUPABASE_URL = 'https://unified.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'unified-key';

  const cfg1 = getDbConfig(1);
  assert.equal(cfg1.url, 'https://unified.supabase.co');
  assert.equal(cfg1.key, 'unified-key');
  assert.equal(cfg1.isMultiDb, false);

  process.env = oldEnv;
});

test('getDbConfig resolves form-specific DB endpoints when multi-DB env vars set', () => {
  const oldEnv = { ...process.env };
  process.env.SUPABASE_URL_FORM1 = 'https://db1.supabase.co';
  process.env.SUPABASE_SERVICE_KEY_FORM1 = 'key1';
  process.env.SUPABASE_URL_FORM2 = 'https://db2.supabase.co';
  process.env.SUPABASE_SERVICE_KEY_FORM2 = 'key2';
  process.env.SUPABASE_URL_FORM3 = 'https://db3.supabase.co';
  process.env.SUPABASE_SERVICE_KEY_FORM3 = 'key3';

  const cfg1 = getDbConfig(1);
  assert.equal(cfg1.url, 'https://db1.supabase.co');
  assert.equal(cfg1.key, 'key1');
  assert.equal(cfg1.isMultiDb, true);

  const cfg2 = getDbConfig(2);
  assert.equal(cfg2.url, 'https://db2.supabase.co');
  assert.equal(cfg2.key, 'key2');

  const cfg3 = getDbConfig(3);
  assert.equal(cfg3.url, 'https://db3.supabase.co');
  assert.equal(cfg3.key, 'key3');

  const cfgViewArrivals = getDbConfig('arrivees');
  assert.equal(cfgViewArrivals.url, 'https://db2.supabase.co');

  const cfgViewExcursion = getDbConfig('excursion');
  assert.equal(cfgViewExcursion.url, 'https://db3.supabase.co');

  process.env = oldEnv;
});
